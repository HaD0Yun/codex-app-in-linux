# Provider Studio Visible UI Integration Plan — Pending Approval

## Status
Pending approval. Product-source edits are intentionally paused until this plan is approved.

## Goal
Expose Provider Studio provider/model switching from the Codex Desktop Linux UI, not only from CLI/bridge files, while preserving app launch and avoiding brittle hashed/minified renderer bundle patches.

## Consensus inputs
- Planner: APPROACH VIABLE. Use wrapper-level overlay UI/API as the interim integration path.
- Architect: WATCH / REQUEST CHANGES. Do not patch hashed/minified renderer bundles; harden local API and config mutation before product use.
- Critic: BLOCK until the implementation is source-owned/idempotent, tokened, restorable, and verified with visible UI acceptance.

## Approved execution scope
1. Source-owned visible UI asset: add `provider-studio-wave2/visible-ui.js`; installer copies it to `content/webview/provider-studio-ui.js`; idempotently inject a self-hosted script tag into `index.html`; do not edit hashed assets.
2. Source-owned webview API patch: installer patches webview server with `GET /provider-studio/api/state`, `POST /provider-studio/api/apply`, and `POST /provider-studio/api/restore`; loopback only; JSON only; max body size; validate provider id, URL, model, env key; no permissive CORS.
3. Config mutation safety: timestamped backups, restore endpoint/button, atomic temp write + rename where possible, 0600 mode, no raw API keys, env-key references only.
4. UI behavior: visible Provider Studio button/panel in Codex Desktop webview; provider selector; base URL/model/env key inputs; apply/restore; redacted status; runtime boundary messaging.
5. Verification: provider tests/smokes, webview HTTP 200, script/API HTTP checks, apply/restore in temp CODEX_HOME, app restart smoke, sentinel secret scan, invalid input rejection.

## Non-goals
- No native Settings route inside minified React bundles.
- No direct edits to hashed `assets/*.js`.
- No real provider API-key testing.
- No native installer/updater/service changes.
- No claim that current thread live-switches provider unless verified.

## Rollback
Remove injected script tag and `provider-studio-ui.js`; restore webview server backup; restore Codex config backup; restart app and verify HTTP 200.

## Approval request
Approve this plan to proceed with product-code edits under Ultragoal G001.
