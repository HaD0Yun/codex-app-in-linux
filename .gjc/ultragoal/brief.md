Improve Provider Studio beyond the current visible Codex App UI by borrowing the useful operator patterns from router-for-me/CLIProxyAPI.

Context:
- Current branch: feature/provider-studio-wave1 in /home/yun/tmp/codex-app-in-linux.
- Current Provider Studio UI is good and must be preserved as the visible Codex App entrypoint.
- Current setup still makes login/auth/provider setup too hard: users need local env files, raw API keys, profile details, and proxy wiring knowledge.
- CLIProxyAPI shows the target direction: a local proxy service, management API, auth-dir/account pool, OAuth/key-based auth flows, health/status visibility, model catalog endpoints, routing/failover, and hot config changes.

Goal:
Make Provider Studio feel like a first-class provider/login setup panel for Codex App, not a manual config editor. It should guide users through adding credentials/accounts, starting or detecting the local proxy, selecting providers/models, applying Codex config, and showing health/status/errors in the same visible UI.

Constraints:
- Preserve existing visible Provider Studio UI in Codex App.
- Keep secrets redacted and never commit real tokens.
- Prefer local-only loopback services and files under user config directories.
- Keep Codex App launch working.
- Avoid brittle generated bundle mutation beyond the existing safe visible-ui injection path.
- Use CLIProxyAPI only as a reference unless embedding/running it is deliberately implemented and verified.
- Verification must cover UI state, config generation, local proxy endpoints, redaction, and at least a mock/provider-compatible runtime path.

Desired improvements:
- Add a setup wizard or guided panels for provider auth modes: env key, direct API key stored in local secret file, local proxy, and future OAuth/account pool.
- Add local proxy lifecycle controls: detect running proxy, start/stop when Provider Studio owns it, show base URL/model endpoint health.
- Add account/provider status cards: active provider, credential source, health, last error, model catalog availability, rate-limit/upstream failure messages.
- Add CLIProxyAPI-compatible/import path where Provider Studio can point Codex at an existing CLIProxyAPI service and management endpoint without manual TOML editing.
- Add safer config/profile handling so applying Provider Studio does not damage unrelated Codex config.
- Add tests and smoke checks for auth redaction, proxy lifecycle/state, UI generation, and Codex config output.
