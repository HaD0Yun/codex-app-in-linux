# Provider Studio App Integration Context

Timestamp: 20260626T060450Z

## Task statement
Develop the updated feature/provider-studio-wave1 branch so Provider Studio moves beyond the Wave 2 standalone overlay toward real Codex App integration. The current user goal is to make provider/model switching work from the installed Linux Codex App, not only from an isolated CLI smoke test.

## Desired outcome
- Integrate or advance Provider Studio behavior in the active Linux wrapper/app workspace as far as safely possible.
- Preserve existing app launch behavior.
- Verify provider switching with concrete evidence.
- Clearly report what became product-integrated versus what remains overlay-only.

## Known facts/evidence
- Repo: /home/yun/tmp/codex-app-in-linux
- Branch: feature/provider-studio-wave1
- Latest observed commit: 51829ea Add Provider Studio Wave 2 overlay
- Wave 1 was scaffold/evidence only.
- Wave 2 adds executable overlay in provider-studio-wave2/ with core.js, cli.js, tests.
- Wave 2 tests pass: smoke, redaction-check, node --test.
- Overlay provider switching passes for two mock providers: mock-a/model-a2 -> mock-b/model-b1 -> restore mock-a/model-a2.
- Installed app webview smoke passes at http://127.0.0.1:5175/ HTTP 200.
- Current app-server generated schema does not include providerStudio/provider-studio methods.
- Installed renderer/webview assets do not contain Provider Studio UI strings.

## Constraints
- Do not break existing Codex App launch.
- Do not commit/push unless explicitly requested.
- Do not expose real API keys or secrets.
- Prefer mock providers and local JSON configs for verification.
- Keep changes reviewable and focused.
- Use tests and smoke checks before reporting completion.

## Unknowns/open questions
- Whether the proof repo contains enough upstream wrapper/app-server source to wire true app-server endpoints without editing generated/minified app bundles.
- Exact Codex runtime config schema for custom providers in this installed CLI/app version.
- Whether app UI patching is practical against the latest DMG assets in this branch.

## Likely touchpoints
- provider-studio-wave2/core.js
- provider-studio-wave2/cli.js
- provider-studio-wave2/test.js
- reports/provider-studio-wave2.md
- README.md
- upstream/codex-desktop-linux/codex-app/.codex-linux/provider-studio-wave2
- possible wrapper feature locations under upstream/codex-desktop-linux/linux-features or scripts/patches if safe

## Suggested team lanes
1. Integration lane: find the safest path to expose Provider Studio behavior to the installed wrapper/app surface without breaking launch.
2. Runtime/config lane: determine whether actual Codex config/runtime provider switching can be wired or only planned; implement local config bridge if safe.
3. Verification lane: expand mock provider switching tests, redaction tests, and app smoke evidence.
