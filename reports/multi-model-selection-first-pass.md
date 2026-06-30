# First-pass multi-model selection support

## Status

This repo now includes a non-invasive helper path for testing multi-model selection with the Linux Codex wrapper proof: keep the generated app untouched, run an OpenCodex-style local service that exposes an OpenAI Responses-compatible API on loopback, and point Codex config at that service through a custom model provider.

No proprietary app artifacts, native install paths, updater/service commands, sudo, or package-manager flows are required by this first pass.

## Delivery shape

The safest first-pass integration is configuration injection rather than binary patching:

1. Start a local model-selection proxy on `127.0.0.1` that accepts OpenAI Responses API requests under `/v1`.
2. Let the proxy route the requested model name to the desired backend/model.
3. Add a Codex config provider with `wire_api = "responses"` and a loopback `base_url`.
4. Select that provider/model in Codex config before launching the wrapper app.

The helper at `scripts/codex-multi-model-config.py` generates the Codex config snippet without contacting any network service or requiring credentials.

## Example

Print a default snippet:

```bash
python3 scripts/codex-multi-model-config.py
```

Print a snippet for a specific proxy route/model:

```bash
python3 scripts/codex-multi-model-config.py \
  --base-url http://127.0.0.1:8787/v1 \
  --model anthropic/claude-sonnet-4-20250514 \
  --print-env
```

Append intentionally to a disposable Codex config file:

```bash
python3 scripts/codex-multi-model-config.py \
  --model openrouter/google/gemini-2.5-pro \
  --append /tmp/codex-config.toml
```

The generated provider block has this shape:

```toml
model = "opencodex/default"
model_provider = "local-responses"

[model_providers.local-responses]
name = "Local Responses Proxy"
base_url = "http://127.0.0.1:8787/v1"
env_key = "LOCAL_RESPONSES_API_KEY"
wire_api = "responses"
```

Set `LOCAL_RESPONSES_API_KEY` to a local placeholder token when the proxy expects an `Authorization` header. Keep real upstream provider keys scoped to the proxy process rather than writing them into Codex config.

## Constraints

- Treat the local proxy as high-trust code: it can see prompts, tool calls, responses, and potentially repository context.
- Bind the proxy to loopback by default. Do not expose it on a LAN interface without authentication and transport protections.
- Do not store upstream API keys in this repo or in generated evidence files.
- Do not patch generated Electron bundles for this feature until config injection is proven insufficient.
- Keep native install/updater/service targets out of first-pass validation.

## Verification performed

The helper was validated offline with Python syntax compilation and snippet generation. These checks do not require Codex credentials, a generated app bundle, a running proxy, or proprietary artifacts.
