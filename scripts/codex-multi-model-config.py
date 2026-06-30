#!/usr/bin/env python3
"""Generate or append a Codex config snippet for the CLIProxyAPI data plane.

This helper is intentionally offline-only: it does not contact Codex, OpenAI,
CLIProxyAPI, or any upstream provider. By default it prints a snippet that
points Codex at the loopback CLIProxyAPI data-plane `/v1` API.
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path
import sys

DEFAULT_PROVIDER = "cliproxyapi"
DEFAULT_NAME = "CLIProxyAPI Data Plane"
DEFAULT_BASE_URL = "http://127.0.0.1:8317/v1"
DEFAULT_MODEL = "cliproxyapi/default"
DEFAULT_BASE_URL_ENV_KEY = "CLIPROXYAPI_BASE_URL"
DEFAULT_ENV_KEY = "CLIPROXYAPI_PROXY_CLIENT_KEY"
MANAGEMENT_ENV_KEY = "CLIPROXYAPI_MANAGEMENT_KEY"


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
        "# CLIProxyAPI data-plane route for Codex multi-model selection.",
        "# Start CLIProxyAPI separately, then select the upstream model through",
        "# the bridge/BFF bubble path or set model to the data-plane route name.",
        f"model = {toml_string(args.model)}",
        f"model_provider = {toml_string(args.provider)}",
        "",
        f"[model_providers.{args.provider}]",
        f"name = {toml_string(args.name)}",
        f"base_url = {toml_string(args.base_url.rstrip('/'))}",
        f"env_key = {toml_string(args.env_key)}",
        'wire_api = "responses"',
        "",
        f"# Data-plane client key only; do not use {MANAGEMENT_ENV_KEY} here.",
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


def append_snippet(path: Path, snippet: str, force: bool, provider: str, dry_run: bool) -> None:
    existing = path.read_text(encoding="utf-8") if path.exists() else ""
    marker = f"[model_providers.{provider}]"
    if marker in existing and not force:
        raise SystemExit(
            f"Refusing to append: {path} already contains {marker}. "
            "Use --force to append another block intentionally."
        )
    if dry_run:
        print(f"Dry run: would append provider {provider!r} to {path}", file=sys.stderr)
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    separator = "" if not existing or existing.endswith("\n") else "\n"
    path.write_text(existing + separator + "\n" + snippet, encoding="utf-8")


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate Codex config for the loopback CLIProxyAPI data plane."
    )
    parser.add_argument("--provider", default=DEFAULT_PROVIDER)
    parser.add_argument("--name", default=DEFAULT_NAME)
    parser.add_argument("--base-url", default=os.environ.get(DEFAULT_BASE_URL_ENV_KEY, DEFAULT_BASE_URL))
    parser.add_argument("--model", default=os.environ.get("CODEX_MODEL", DEFAULT_MODEL))
    parser.add_argument("--env-key", default=DEFAULT_ENV_KEY)
    parser.add_argument(
        "--append",
        metavar="PATH",
        help="Append the snippet to a Codex config file, e.g. ~/.codex/config.toml. Default prints only.",
    )
    parser.add_argument("--force", action="store_true", help="Allow appending when the provider marker already exists.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="With --append, validate and print what would be written without modifying the target file.",
    )
    parser.add_argument(
        "--requires-openai-key",
        action="store_true",
        help="Add a reminder for bridges that forward to OpenAI. Does not print secrets.",
    )
    parser.add_argument(
        "--print-env",
        action="store_true",
        help="Also print shell exports for the selected proxy URL and dummy local auth token.",
    )
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    if args.env_key == MANAGEMENT_ENV_KEY:
        raise SystemExit(
            f"Refusing to use privileged management key {MANAGEMENT_ENV_KEY} as a Codex data-plane env_key."
        )
    snippet = build_snippet(args)
    if args.print_env:
        print(f"export {DEFAULT_BASE_URL_ENV_KEY}={shell_quote(args.base_url.rstrip('/'))}")
        print(f"export {args.env_key}=${{{args.env_key}:-cliproxyapi-client-token}}")
        print()
    print(snippet, end="")
    if args.append:
        append_snippet(Path(args.append).expanduser(), snippet, args.force, args.provider, args.dry_run)
        if not args.dry_run:
            print(f"\nAppended provider {args.provider!r} to {args.append}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
