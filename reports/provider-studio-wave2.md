# Provider Studio Wave 2

This branch now carries an executable Provider Studio overlay package in `provider-studio-wave2/`.

The important boundary is unchanged: this proof repository does not contain the generated Codex renderer, app-server, or upstream wrapper source tree. The `upstream/` checkout is intentionally ignored. Because of that, Wave 2 does not claim that Provider Studio is already visible inside the installed Codex App UI.

This work is intended for the `feature/provider-studio-wave1` branch line only. It must not be pushed directly to `master`.

## What Wave 2 Adds

- Provider presets for OpenAI, OpenRouter, and local OpenAI-compatible endpoints.
- Mock OpenAI-compatible model discovery.
- Doctor-style reachability and model-list checks.
- Config apply and restore planning against a local JSON config surface.
- Redacted troubleshooting report export.
- CLI smoke checks that exercise list, discover, apply, restore, and report generation.
- Secret redaction checks that fail if raw API keys appear in output artifacts.

## Why This Is Different From Wave 1

Wave 1 was a scaffold and evidence bundle. It explicitly treated UI, app-server endpoints, provider behavior, config mutation, and runtime integration as non-goals.

Wave 2 adds executable behavior that can be applied or ported into the active wrapper workspace. It still does not pretend to patch minified renderer bundles in this proof repo. The next integration step is to copy the overlay contracts into the real wrapper/app-server workspace and wire them to a Settings entry.

## Verification Surface

Run:

```bash
node provider-studio-wave2/cli.js smoke --tmp-dir "$(mktemp -d)"
node provider-studio-wave2/cli.js redaction-check --secret sk-feedback-SECRET-123 --tmp-dir "$(mktemp -d)"
node --test provider-studio-wave2/test.js
```

The smoke command starts a mock provider, discovers models, applies a selected model to a temporary config file, writes a redacted report, restores the previous config, and prints `PASS`.

The redaction check writes a report containing provider metadata while proving the raw secret is absent.

## Remaining Product Integration

To satisfy the full feedback as shipped product behavior, the active wrapper workspace still needs:

- Settings > Provider Studio entry.
- Renderer calls to provider-studio list, discover, doctor, apply, restore, and export report actions.
- App-server endpoints that wrap these contracts.
- Runtime config reload or a clear "new thread only" application boundary.
- Patch-drift handling for the latest Codex DMG and hashed renderer bundles.

This branch now provides a concrete behavior package and tests for that integration instead of only describing future work.
