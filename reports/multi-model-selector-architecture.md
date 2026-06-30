# Multi-model selection architecture notes

Date: 2026-06-30
Lane: C — Architecture
Status: WATCH

## Scope

This note assesses the safest first-pass integration shape for multi-model selection in this Linux Codex Desktop wrapper repository. It compares three similarly named OpenCodex projects and intentionally avoids app binary patches, native install/update/service flows, sudo, package-manager installs, generated bundles, and proprietary artifact redistribution.

## Recommendation

Use a local Responses API proxy plus Codex model-provider configuration as the first-pass shape.

For this repo, the least invasive pattern is:

1. Keep the Linux wrapper and generated Codex Desktop app unchanged.
2. Run a separately installed local proxy on loopback only, preferably `127.0.0.1`.
3. Point Codex at that proxy with `~/.codex/config.toml` using `wire_api = "responses"` and a local `base_url`.
4. Let the proxy translate Codex `/v1/responses` traffic to upstream provider APIs and publish models into the Codex model picker/catalog where the proxy supports that.
5. Document reset/recovery clearly because provider mappings, model aliases, and conversation metadata can become gateway-dependent.

A minimal provider block shape is:

```toml
model_provider = "opencodex"
model = "provider/model-name"

[model_providers.opencodex]
name = "opencodex"
base_url = "http://127.0.0.1:10100/v1"
wire_api = "responses"
```

This keeps the feature reversible and preserves the repo's current safety boundary: no privileged install path, no updater/service enablement, no app bundle redistribution, and no binary patching.

## Project comparison

| Project | Architecture fit | Notes | First-pass decision |
| --- | --- | --- | --- |
| `lidge-jun/opencodex` | Strong fit for a universal local Responses API proxy. | README describes Codex CLI/App/SDK sending `/v1/responses` to `opencodex`, which translates to Anthropic, Google, xAI, Kimi, Ollama Cloud, Groq, OpenRouter, Azure, DeepSeek, GLM, OpenAI-compatible endpoints, and OpenAI itself. It documents `localhost:10100`, model routing with `provider/model`, Codex App model picker integration, and loopback-by-default behavior. | Best baseline for README/helper guidance. Recommend loopback manual start (`ocx start`) for first pass; defer service/shim/autostart paths. |
| `AITabby/opencodex` | Strong desktop-centric gateway fit, but broader than the first pass. | README describes a Codex Desktop local gateway at `127.0.0.1:8765`, dashboard, managed `~/.codex/config.toml`, custom model catalog under `~/.opencodex/custom_model_catalog.json`, native GPT pass-through, third-party `/chat/completions` translation, model continuity notes, Vision Bridge, and Computer Use/voice features. Prerequisites focus on macOS/Windows; Linux is not the documented target. | Useful reference for model catalog/continuity UX and reset warnings. Do not adopt Computer Use, voice, restart, or platform-specific companion pieces in this repo's first pass. |
| `RyensX/OpenCodex` | Not a model-provider proxy. | README describes a browser/LAN middleware for operating Codex Desktop from phone/tablet/another computer. It supports local/LAN/remote-LAN access, password auth, launcher configuration, and Codex Desktop bundle discovery. Linux is noted as untested. | Out of scope for multi-model selection. Mention only as a non-goal to prevent confusing it with provider routing. |

## Safest integration shape

### Boundary

The repo should provide documentation and optional helper material only. The helper may print or write a user-owned Codex config snippet, but it should not:

- patch the Codex Desktop app binary or generated app bundle;
- modify wrapper source under `upstream/`;
- install system services or autostart units;
- invoke `sudo`, `systemctl`, package-manager installs, `make install-*`, `make setup-*`, `make update-*`, or native service paths;
- collect or store provider API keys in this repo;
- redistribute OpenAI, Codex Desktop, or provider artifacts.

### Runtime flow

```text
Codex Desktop / CLI
  -> ~/.codex/config.toml model_provider = opencodex
  -> http://127.0.0.1:<proxy-port>/v1/responses
  -> local proxy provider router
  -> upstream provider API or local model endpoint
```

The wrapper remains responsible only for launching Codex Desktop on Linux. The proxy remains an external user-run dependency.

### Config and model picker

Prefer a provider config block with `wire_api = "responses"`. Do not rely on undocumented app internals when the Codex config surface can already route Responses API traffic.

For model picker support, prefer proxy-managed catalogs where available (`lidge-jun/opencodex` model picker support or `AITabby/opencodex` custom model catalog). This repo should document the concept, not synthesize or mutate private catalog files unless a future task verifies the exact current Codex catalog contract.

### Loopback and auth

Keep first-pass examples on `127.0.0.1`. If users intentionally bind a proxy to LAN (`0.0.0.0`), require explicit bearer-token guidance and warn that the data-plane carries prompts, files, tool calls, and potentially credentials. `lidge-jun/opencodex` documents refusing non-loopback start without `OPENCODEX_API_AUTH_TOKEN`; preserve that safety posture in repo guidance.

### Conversation compatibility

Document that gateway-touched conversations may depend on the gateway's provider mappings, model aliases, translated reasoning/history items, and model catalog. A native Codex conversation may usually continue through a gateway because Codex sends visible context, but a gateway-touched conversation is not guaranteed to continue after removing the gateway.

This is a core UX risk, not an implementation bug. Reset instructions must say that removing the proxy/config may restore native routing while leaving some conversations requiring the same gateway/catalog to resume reliably.

## Risks and constraints

- **Provider terms/account risk:** `lidge-jun/opencodex` explicitly warns that some providers, notably Anthropic, may suspend or restrict accounts for third-party proxy routing. User guidance must tell users to review provider terms before connecting accounts or keys.
- **Credential handling:** Proxy dashboards/configs store provider credentials outside this repo. Do not create repo-local credential files or example secrets.
- **Protocol mismatch:** Many upstreams expose Chat Completions, not Responses. Tool calls, streaming, images, and reasoning metadata depend on proxy translation quality.
- **Model catalog drift:** Codex Desktop model picker behavior may change. Prefer external proxy-managed injection and keep this repo's support documented as best-effort.
- **Loopback exposure:** A local proxy can access prompts, files, tool calls, images, and browser/computer-use data. Keep examples on loopback and treat LAN mode as advanced/high risk.
- **Service/autostart risk:** Proxy service/shim installation mutates user shell/runtime state. It may be appropriate for upstream proxy docs, but not for this repo's first-pass safe path.
- **Linux parity:** AITabby and RyensX focus on macOS/Windows or mark Linux untested. Do not import their desktop/remote-control features into the Linux wrapper without dedicated Linux QA.
- **Remote-control confusion:** RyensX/OpenCodex solves browser/LAN operation, not model selection. Keep it out of first-pass model-provider instructions.

## Follow-up constraints

1. Lane A docs/helpers should name the chosen proxy pattern as optional and external, not bundled.
2. Lane A should include a dry-run config snippet and rollback notes, not service installation.
3. Lane B should verify docs/helpers with commands that do not require credentials, generated app bundles, or proprietary artifacts.
4. Future implementation that mutates `~/.codex/config.toml` should make a timestamped backup and support restore before it becomes a default recommendation.
5. Future app model-picker validation should use a disposable `CODEX_HOME`/home directory and avoid personal Codex credentials.

## Source inspection

- `lidge-jun/opencodex` README, fetched 2026-06-30: universal provider proxy; `/v1/responses`; `localhost:10100`; model routing; Codex App picker; loopback auth and provider terms warning.
- `AITabby/opencodex` README, fetched 2026-06-30: Codex Desktop gateway; `127.0.0.1:8765`; managed config; custom model catalog; continuity/reset model; dashboard; Vision Bridge; macOS/Windows focus.
- `RyensX/OpenCodex` README, fetched 2026-06-30: browser/LAN middleware for remote operation of Codex Desktop; password-protected gateway; mobile optimization; Linux untested.

## Verdict

WATCH. A local Responses API proxy plus Codex config/provider injection is the safest first-pass direction, but the repo should ship it as documented optional integration guidance rather than an invasive wrapper feature. The primary unresolved risks are provider-account policy, gateway-dependent conversation continuity, credential handling, and model catalog drift.
