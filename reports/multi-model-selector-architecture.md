# CLIProxyAPI bubble architecture notes

Date: 2026-06-30
Lane: C — Architecture/manual QA
Status: WATCH

## Scope

This note supersedes the earlier OpenCodex/opencodex `localhost:10100` first-pass direction. The approved direction is CLIProxyAPI on loopback, with Codex data-plane traffic proved first and dashboard-like controls surfaced through a wrapper-owned bubble backed by a privileged bridge/BFF.

This repository still preserves the Linux wrapper safety boundary: no app binary patches, no generated/proprietary bundle patching, no native install/update/service flows, no sudo/package-manager mutation, and no proprietary artifact redistribution.

## Current decision

Use CLIProxyAPI as the execution backend, not an OpenCodex dashboard flow.

```text
Codex Desktop / CLI
  -> ~/.codex/config.toml model_provider = cliproxyapi
  -> http://127.0.0.1:8317/v1/responses
  -> CLIProxyAPI data-plane router
  -> upstream provider API, account pool, or local model endpoint
```

The expected management surface is `http://localhost:8317/v0/management`, but renderer code must not call it directly. Management requests require a bearer token or `X-Management-Key`, even on localhost, so the key belongs only in a privileged wrapper-owned bridge/BFF process.

A minimal Codex provider shape is:

```toml
model = "cliproxyapi/default"
model_provider = "cliproxyapi"

[model_providers.cliproxyapi]
name = "CLIProxyAPI"
base_url = "http://127.0.0.1:8317/v1"
env_key = "CLIPROXYAPI_PROXY_CLIENT_KEY"
wire_api = "responses"
```

`CLIPROXYAPI_PROXY_CLIENT_KEY` is a data-plane proxy client key. It is distinct from the CLIProxyAPI management key, upstream provider secrets, and Codex OAuth/auth state.

## Data-plane proof gate

No bubble, overlay, live-routing, or model-selection success claim is valid until a credentialed local QA pass proves the data plane with disposable credentials/accounts.

Required proof sequence:

1. Use a disposable `CODEX_HOME` or disposable `~/.codex/config.toml` path.
2. Configure Codex against `http://127.0.0.1:8317/v1` with `wire_api = "responses"`.
3. Use the data-plane proxy client key only for Codex request authentication.
4. Run a non-streaming Responses request.
5. Run a streaming Responses request.
6. Exercise tool/function-call behavior, or record an explicit unsupported result.
7. Confirm the selected model/provider alias reaches CLIProxyAPI.
8. Restore the original Codex config from backup.

Stop rule: if any data-plane item fails, do not implement or claim overlay routing. Revise architecture or add a narrow adapter plan based on the observed protocol gap.

## Privileged management bridge/BFF

The bridge/BFF is the only component allowed to hold the CLIProxyAPI management key. Renderer code receives typed, redacted DTOs only.

Allowed renderer-facing operations:

- `getStatus`
- `listRedactedProviders`
- `listRedactedModels`
- `syncCodexProvider`
- `restoreCodexProvider`
- `toggleProviderDisabled`
- `resetQuotaByAuthIndex`
- `fetchRedactedUsageSummary`

Explicitly forbidden renderer-facing behavior:

- raw passthrough to `/config.yaml`, logs, auth files, or arbitrary management endpoints;
- exposure of management key, data-plane proxy client key, upstream provider secrets, Codex OAuth/auth state, raw prompts, request payloads, or full provider config;
- persistence of secrets in DOM, localStorage, screenshots, logs, IPC payloads, or evidence artifacts;
- repeated unauthenticated management retries without backoff, because CLIProxyAPI may temporarily ban after repeated auth failures.

Bridge responses should redact token-like fields by default and expose only status, labels, model IDs/aliases, enabled/disabled flags, health/quota summaries, and restore availability.

## Wrapper-owned bubble first path

The safe first UI path is a wrapper-owned companion bubble/overlay, not a direct patch inside the generated Codex app bundle.

Required states:

- hidden
- opening
- probing proxy
- connected
- unauthorized
- disconnected
- degraded
- sync pending
- rollback available
- recovery

Minimum visible features:

- redacted provider/account/model status;
- active model/provider selection;
- quota/health summary;
- sync Codex config;
- restore native Codex config;
- safe quota reset with explicit confirmation.

The external CLIProxyAPI dashboard may remain a recovery/admin fallback only. It is not the product UX and should not be required for the normal bubble path.

## Direct overlay gating

A direct in-Codex overlay remains a later gated target. It requires:

1. successful data-plane proof;
2. implemented bridge/BFF redaction boundary;
3. wrapper-owned bubble fallback;
4. architect approval of a non-proprietary seam.

Stop immediately if the only feasible path is proprietary generated bundle patching, private asset rewriting, or renderer secret exposure. Reuse the same bridge/BFF and redacted DTO contract if a direct seam is later approved.

## Config sync and rollback

Any config-writing path must be reversible:

1. create a timestamped backup of the previous Codex config;
2. write through a temporary file and atomic rename where the filesystem supports it;
3. read back and validate the expected provider block;
4. expose restore availability in the bubble;
5. restore the previous config on user request;
6. hide/disable the bubble without deleting CLIProxyAPI credentials.

Do not delete CLIProxyAPI credentials, upstream provider credentials, or Codex auth files unless the user explicitly requests that action outside the normal rollback path.

## Manual QA checklist

Credential-free checks:

- helper syntax and dry-run output generate CLIProxyAPI defaults without live credentials;
- static docs mention CLIProxyAPI `8317`, bridge/BFF management key ownership, data-plane proxy client key distinction, wrapper-owned bubble first path, rollback, and OpenCodex `10100` supersession;
- evidence contains no secret-like sample values beyond placeholder names.

Credentialed local CLIProxyAPI checks:

- management unauthenticated probe returns unauthorized and triggers backoff, not retry spam;
- bridge authenticated status call returns only redacted provider/model/account DTOs;
- non-streaming data-plane request succeeds through `127.0.0.1:8317/v1`;
- streaming data-plane request succeeds or records the exact unsupported behavior;
- tool/function-call behavior succeeds or is explicitly documented as unsupported;
- selected model/provider alias reaches CLIProxyAPI;
- Codex config backup/readback/restore works against disposable config.

UI checks after bridge and wrapper bubble exist:

- bubble opens from the wrapper-owned surface without requiring a separate user-facing dashboard address;
- connected, unauthorized, disconnected, degraded, rollback available, and recovery states render correctly;
- renderer globals, DOM, localStorage, logs, screenshots, IPC captures, and evidence contain no management key, proxy client key, upstream provider secrets, Codex OAuth/auth state, raw prompts, or request payloads;
- direct overlay code path is disabled unless the direct-overlay gate is explicitly satisfied.

## Rollback and stop rules

Rollback:

- restore the timestamped Codex config backup;
- remove or disable the CLIProxyAPI provider block;
- hide/disable the wrapper-owned bubble;
- leave CLIProxyAPI credentials untouched unless separately requested.

Stop rules:

- stop UI work if data-plane proof fails;
- stop bridge work if management redaction cannot be enforced;
- stop direct overlay exploration if it requires generated/proprietary bundle patching;
- stop live QA if a secret appears in renderer/evidence/log output;
- stop credentialed testing if disposable credentials/accounts are unavailable.

## Follow-up constraints

1. Lane A docs/helpers should default to CLIProxyAPI loopback data-plane guidance, not OpenCodex/opencodex `10100`.
2. Lane B static checks should verify the data-plane/management-key split and absence of live-routing claims.
3. Future implementation should keep bridge/BFF operations typed and narrow; no raw management proxying.
4. Wrapper-owned bubble remains the first UI path until a direct seam is proven and approved.

## Verdict

WATCH. CLIProxyAPI is the approved backend and wrapper-owned bubble/BFF is the safe UI architecture, but live routing and UI success remain gated by data-plane proof, credential isolation, and manual QA. This report does not claim live CLIProxyAPI routing was performed.
