#!/usr/bin/env python3
"""Tiny local Responses API adapter for OpenAI-compatible chat providers.

Provider Studio uses this when Codex requires `wire_api = "responses"` but a
third-party provider only exposes `/chat/completions`.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


def _response_text(chat_payload: dict) -> str:
    choice = (chat_payload.get("choices") or [{}])[0]
    message = choice.get("message") or {}
    content = message.get("content", "")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(str(part.get("text", part)) for part in content)
    return str(content)


def _messages_from_responses(payload: dict) -> list[dict]:
    if isinstance(payload.get("messages"), list):
        return payload["messages"]
    value = payload.get("input", "")
    if isinstance(value, str):
        return [{"role": "user", "content": value}]
    if isinstance(value, list):
        messages = []
        for item in value:
            if not isinstance(item, dict):
                continue
            role = item.get("role") or "user"
            content = item.get("content", "")
            if isinstance(content, list):
                parts = []
                for part in content:
                    if isinstance(part, dict):
                        parts.append(str(part.get("text") or part.get("input_text") or part.get("output_text") or ""))
                    else:
                        parts.append(str(part))
                content = "".join(parts)
            messages.append({"role": role, "content": str(content)})
        if messages:
            return messages
    return [{"role": "user", "content": str(value)}]


def _responses_usage(chat_usage: dict | None, text: str) -> dict:
    chat_usage = chat_usage or {}
    input_tokens = int(chat_usage.get("prompt_tokens") or chat_usage.get("input_tokens") or 0)
    output_tokens = int(chat_usage.get("completion_tokens") or chat_usage.get("output_tokens") or max(1, len(text) // 4))
    total_tokens = int(chat_usage.get("total_tokens") or input_tokens + output_tokens)
    return {
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": total_tokens,
        "input_tokens_details": {"cached_tokens": 0},
        "output_tokens_details": {"reasoning_tokens": 0},
    }


def _responses_payload(model: str, text: str, usage: dict | None = None) -> dict:
    now = int(time.time())
    return {
        "id": f"resp_provider_studio_{now}",
        "object": "response",
        "created_at": now,
        "status": "completed",
        "model": model,
        "output": [
            {
                "id": f"msg_provider_studio_{now}",
                "type": "message",
                "status": "completed",
                "role": "assistant",
                "content": [{"type": "output_text", "text": text, "annotations": []}],
            }
        ],
        "usage": _responses_usage(usage, text),
    }


def _sse_line(event: str, payload: dict) -> bytes:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n".encode("utf-8")


class Handler(BaseHTTPRequestHandler):
    server_version = "ProviderStudioResponsesProxy/1.0"

    def _json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _sse_response(self, model: str, text: str, usage: dict | None = None) -> None:
        now = int(time.time())
        response_id = f"resp_provider_studio_{now}"
        message_id = f"msg_provider_studio_{now}"
        response_base = {"id": response_id, "object": "response", "created_at": now, "status": "in_progress", "model": model}
        output_item = {"id": message_id, "type": "message", "status": "in_progress", "role": "assistant", "content": []}
        self.send_response(200)
        self.send_header("content-type", "text/event-stream")
        self.send_header("cache-control", "no-cache")
        self.send_header("connection", "close")
        self.end_headers()
        events = [
            ("response.created", {"type": "response.created", "response": response_base}),
            ("response.in_progress", {"type": "response.in_progress", "response": response_base}),
            ("response.output_item.added", {"type": "response.output_item.added", "output_index": 0, "item": output_item}),
            ("response.content_part.added", {"type": "response.content_part.added", "item_id": message_id, "output_index": 0, "content_index": 0, "part": {"type": "output_text", "text": "", "annotations": []}}),
            ("response.output_text.delta", {"type": "response.output_text.delta", "item_id": message_id, "output_index": 0, "content_index": 0, "delta": text}),
            ("response.output_text.done", {"type": "response.output_text.done", "item_id": message_id, "output_index": 0, "content_index": 0, "text": text}),
            ("response.content_part.done", {"type": "response.content_part.done", "item_id": message_id, "output_index": 0, "content_index": 0, "part": {"type": "output_text", "text": text, "annotations": []}}),
            ("response.output_item.done", {"type": "response.output_item.done", "output_index": 0, "item": {**output_item, "status": "completed", "content": [{"type": "output_text", "text": text, "annotations": []}]}}),
            ("response.completed", {"type": "response.completed", "response": {**response_base, "status": "completed", "output": [{**output_item, "status": "completed", "content": [{"type": "output_text", "text": text, "annotations": []}]}], "usage": _responses_usage(usage, text)}}),
        ]
        for event, payload in events:
            self.wfile.write(_sse_line(event, payload))
            self.wfile.flush()
        self.wfile.write(b"data: [DONE]\n\n")
        self.wfile.flush()

    def log_message(self, fmt: str, *args) -> None:  # keep app logs quiet
        return

    def do_GET(self) -> None:
        if self.path in ("/health", "/v1/health"):
            self._json(200, {"ok": True})
            return
        if self.path.startswith("/v1/models") or self.path.startswith("/models"):
            model = os.environ.get("PROVIDER_STUDIO_PROXY_MODEL") or "glm-5.2"
            model_row = {"id": model, "slug": model, "name": model, "display_name": model, "supported_reasoning_levels": []}
            self._json(200, {"models": [model_row], "object": "list", "data": [{"id": model, "object": "model", "owned_by": "provider-studio"}]})
            return
        self._json(404, {"error": {"message": "not found"}})

    def do_POST(self) -> None:
        if not self.path.endswith("/responses"):
            self._json(404, {"error": {"message": "expected /responses"}})
            return
        try:
            length = int(self.headers.get("content-length") or "0")
            payload = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
            model = str(payload.get("model") or os.environ.get("PROVIDER_STUDIO_PROXY_MODEL") or "glm-5.2")
            chat_body = {
                "model": model,
                "messages": _messages_from_responses(payload),
                "stream": False,
            }
            for key in ("temperature", "top_p", "max_tokens"):
                if key in payload:
                    chat_body[key] = payload[key]
            data = json.dumps(chat_body).encode("utf-8")
            req = urllib.request.Request(
                os.environ["PROVIDER_STUDIO_CHAT_COMPLETIONS_URL"],
                data=data,
                method="POST",
                headers={
                    "content-type": "application/json",
                    "authorization": f"Bearer {os.environ['PROVIDER_STUDIO_API_KEY']}",
                },
            )
            with urllib.request.urlopen(req, timeout=float(os.environ.get("PROVIDER_STUDIO_PROXY_TIMEOUT", "120"))) as res:
                chat_payload = json.loads(res.read().decode("utf-8"))
            text = _response_text(chat_payload)
            if payload.get("stream") is True:
                self._sse_response(model, text, chat_payload.get("usage"))
            else:
                self._json(200, _responses_payload(model, text, chat_payload.get("usage")))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", "replace")[:1000]
            self._json(exc.code, {"error": {"message": detail}})
        except Exception as exc:
            self._json(500, {"error": {"message": str(exc)}})


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=int(os.environ.get("PROVIDER_STUDIO_PROXY_PORT", "8787")))
    args = parser.parse_args()
    missing = [key for key in ("PROVIDER_STUDIO_CHAT_COMPLETIONS_URL", "PROVIDER_STUDIO_API_KEY") if not os.environ.get(key)]
    if missing:
        print(f"missing env: {', '.join(missing)}", file=sys.stderr)
        return 2
    with ThreadingHTTPServer((args.host, args.port), Handler) as httpd:
        httpd.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
