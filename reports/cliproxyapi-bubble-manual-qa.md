# CLIProxyAPI bubble manual QA plan

Date: 2026-06-30
Lane: C — Architecture/manual QA
Status: ready for later live QA; no live routing claimed

## Purpose

This checklist turns the approved CLIProxyAPI bubble architecture into an actionable QA path. It is intentionally split into credential-free checks, local CLIProxyAPI data-plane proof, bridge/BFF validation, wrapper-owned bubble validation, rollback, and stop rules.

## Preconditions

- Use disposable CLIProxyAPI credentials/accounts for live checks.
- Use a disposable Codex home/config path for config write tests.
- Keep CLIProxyAPI data-plane on `http://127.0.0.1:8317/v1` unless a test explicitly documents another loopback value.
- Treat `http://localhost:8317/v0/management` as privileged management API; it requires bearer or `X-Management-Key` auth even on localhost.
- Do not run sudo, package-manager installs, native service/updater/install flows, or generated/proprietary bundle patching.

## Credential taxonomy

| Credential/state | Owner | Renderer exposure | Notes |
| --- | --- | --- | --- |
| CLIProxyAPI data-plane proxy client key | Codex config / privileged config sync | No | Used by Codex request path through `/v1`; distinct from management key. |
| CLIProxyAPI management key | Bridge/BFF only | Never | Used for typed management operations and redacted DTO generation. |
| Upstream provider secrets/OAuth | CLIProxyAPI only | Never | Must not appear in repo, renderer, logs, screenshots, or evidence. |
| Codex OAuth/auth state | Codex app/config only | Never | Do not copy into bridge logs or evidence. |
| Raw prompts/request payloads | Data plane only | Never in management DTOs | Do not include in screenshots or QA artifacts. |

## Phase 1 — data-plane proof gate

Pass criteria before any UI claim:

1. Disposable Codex config contains a CLIProxyAPI provider block using `base_url = "http://127.0.0.1:8317/v1"` and `wire_api = "responses"`.
2. Non-streaming Responses request succeeds through CLIProxyAPI.
3. Streaming Responses request succeeds through CLIProxyAPI, or the unsupported behavior is captured exactly and UI work remains blocked.
4. Tool/function-call behavior succeeds, or unsupported behavior is captured exactly and UI work remains blocked for any feature depending on tools.
5. Selected model/provider alias is observed in CLIProxyAPI routing/status evidence.
6. Original Codex config is restored from backup.

Stop if data-plane proof fails. Do not continue to overlay/bubble live-routing validation.

## Phase 2 — bridge/BFF validation

Required checks:

- Management auth failure returns an unauthorized state and backs off; it does not retry in a tight loop.
- Authenticated bridge calls never return management key, proxy client key, upstream provider secrets, Codex OAuth/auth state, raw prompts, request payloads, config file contents, or logs.
- Renderer-facing API surface is limited to typed operations: `getStatus`, `listRedactedProviders`, `listRedactedModels`, `syncCodexProvider`, `restoreCodexProvider`, `toggleProviderDisabled`, `resetQuotaByAuthIndex`, and `fetchRedactedUsageSummary`.
- No raw passthrough exists to arbitrary management endpoints.
- Redacted DTOs include only labels, IDs/aliases, health, quota summary, enabled/disabled state, and restore availability.

Stop if redaction cannot be enforced.

## Phase 3 — wrapper-owned bubble validation

Required visible states:

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

Required UX checks:

- Bubble opens from the wrapper-owned surface without a separate user-facing dashboard address.
- External CLIProxyAPI dashboard is presented only as recovery/admin fallback.
- Active model/provider selection is redacted and matches bridge DTOs.
- Sync Codex config creates backup, writes provider block, reads back, and exposes rollback availability.
- Restore native Codex config returns the disposable config to the previous state.
- Quota reset requires explicit confirmation and uses only the typed bridge operation.

Secret isolation checks:

- DOM, renderer globals, localStorage/sessionStorage, IPC payload captures, logs, screenshots, and evidence files contain no management key, proxy client key, upstream provider secrets, Codex OAuth/auth state, raw prompts, or request payloads.

## Phase 4 — direct overlay gate

Do not enable a direct Codex-app overlay unless all of these are true:

1. data-plane proof passed;
2. bridge/BFF redaction passed;
3. wrapper-owned bubble exists as fallback;
4. a non-proprietary UI seam is identified and architect-approved;
5. implementation does not patch generated/proprietary bundles or expose secrets to renderer code.

Stop if direct overlay requires generated bundle patching, private asset rewriting, or renderer access to privileged credentials.

## Rollback checklist

- Restore the timestamped Codex config backup.
- Disable or remove the CLIProxyAPI provider block from the disposable config.
- Hide/disable the bubble.
- Leave CLIProxyAPI credentials and upstream provider credentials intact unless explicitly requested.
- Record the restore command/output or file comparison in evidence.

## Evidence to capture later

- Exact command lines for credential-free static checks.
- Redacted data-plane request/response proof for non-streaming and streaming requests.
- Redacted bridge DTO examples.
- Screenshots only after secret isolation checks pass.
- Config backup/readback/restore proof using disposable paths.

## Non-claims

This plan does not claim that live CLIProxyAPI routing, bridge/BFF implementation, wrapper bubble UI, or direct overlay behavior has already been performed. It defines the checks required before those claims are valid.
