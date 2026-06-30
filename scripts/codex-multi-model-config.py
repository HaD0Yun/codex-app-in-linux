#!/usr/bin/env python3
"""Generate or append a Codex config snippet for a local Responses API proxy.

This helper is intentionally offline-only: it does not contact Codex, OpenAI, or a
proxy. By default it prints a snippet that points Codex at an OpenCodex-style
loopback service exposing an OpenAI Responses-compatible `/v1` API.
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path
import sys

DEFAULT_PROVIDER = "local-responses"
DEFAULT_NAME = "Local Responses Proxy"
DEFAULT_BASE_URL = "http://127.0.0.1:8787/v1"
DEFAULT_MODEL = "opencodex/default"
DEFAULT_ENV_KEY = "LOCAL_RESPONSES_API_KEY"


def shell_quote(value: str) -> str:
    return "'" + value.replace("'", "'\"'\"'") + "'"


def toml_string(value: str) -> str:
    escaped = (
        value.replace("\\", "\\\\")
        .replace('"', '\\"')
        .replace("\b", "\\b")
        .replace("\t", "\\t")
        .replace("\n", "\\n")
        .replace("\f", "\\f")
        .replace("\r", "\\r")
    )
    return f'"{escaped}"'


def build_snippet(args: argparse.Namespace) -> str:
    lines = [
        "# First-pass multi-model selection via a local Responses API proxy.",
        "# Start your proxy separately, then select the upstream model there or set",
        "# model to the proxy route/model name you want Codex to request.",
        f"model = {toml_string(args.model)}",
        f"model_provider = {toml_string(args.provider)}",
        "",
        f"[model_providers.{args.provider}]",
        f"name = {toml_string(args.name)}",
        f"base_url = {toml_string(args.base_url.rstrip('/'))}",
        f"env_key = {toml_string(args.env_key)}",
        'wire_api = "responses"',
    ]
    if args.requires_openai_key:
        lines.extend(
            [
                "",
                "# Some proxies forward to OpenAI as one backend; keep that key scoped to",
                "# the proxy process instead of storing it in Codex config.",
            ]
        )
    return "\n".join(lines) + "\n"


def append_snippet(path: Path, snippet: str, force: bool, provider: str) -> None:
    existing = path.read_text(encoding="utf-8") if path.exists() else ""
    marker = f"[model_providers.{provider}]"
    if marker in existing and not force:
        raise SystemExit(
            f"Refusing to append: {path} already contains {marker}. "
            "Use --force to append another block intentionally."
        )
    path.parent.mkdir(parents=True, exist_ok=True)
    separator = "" if not existing or existing.endswith("\n") else "\n"
    path.write_text(existing + separator + "\n" + snippet, encoding="utf-8")


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate Codex config for a loopback Responses API proxy."
    )
    parser.add_argument("--provider", default=DEFAULT_PROVIDER)
    parser.add_argument("--name", default=DEFAULT_NAME)
    parser.add_argument("--base-url", default=os.environ.get("LOCAL_RESPONSES_BASE_URL", DEFAULT_BASE_URL))
    parser.add_argument("--model", default=os.environ.get("CODEX_MODEL", DEFAULT_MODEL))
    parser.add_argument("--env-key", default=DEFAULT_ENV_KEY)
    parser.add_argument(
        "--append",
        metavar="PATH",
        help="Append the snippet to a Codex config file, e.g. ~/.codex/config.toml. Default prints only.",
    )
    parser.add_argument("--force", action="store_true", help="Allow appending when the provider marker already exists.")
    parser.add_argument(
        "--requires-openai-key",
        action="store_true",
        help="Add a reminder for proxies that also forward to OpenAI. Does not print secrets.",
    )
    parser.add_argument(
        "--print-env",
        action="store_true",
        help="Also print shell exports for the selected proxy URL and dummy local auth token.",
    )
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    snippet = build_snippet(args)
    if args.print_env:
        print(f"export LOCAL_RESPONSES_BASE_URL={shell_quote(args.base_url.rstrip('/'))}")
        print(f"export {args.env_key}=${{{args.env_key}:-local-proxy-token}}")
        print()
    print(snippet, end="")
    if args.append:
        append_snippet(Path(args.append).expanduser(), snippet, args.force, args.provider)
        print(f"\nAppended provider {args.provider!r} to {args.append}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
