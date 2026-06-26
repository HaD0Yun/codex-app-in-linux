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
- App-server-style Provider Studio bridge methods for list/read/doctor/apply/restore/export actions.
- Linux app bridge state export at `.codex-linux/provider-studio/state.json` for wrapper consumption.
- Reviewable Codex config TOML fragment export that maps the active Provider Studio provider/model to `model`, `model_provider`, and `[model_providers.*]` without embedding raw secrets.
- Safe Codex config apply/restore commands with timestamped backups.
- App surface installer that writes `.codex-linux/provider-studio/state.json`, `codex-config.provider-studio.toml`, `report.json`, and `index.html`.
- CLI smoke checks that exercise list, discover, apply, restore, app bridge state, Codex fragment generation, and report generation.
- Secret redaction checks that fail if raw API keys appear in output artifacts.

## Why This Is Different From Wave 1

Wave 1 was a scaffold and evidence bundle. It explicitly treated UI, app-server endpoints, provider behavior, config mutation, and runtime integration as non-goals.

Wave 2 adds executable behavior that can be applied or ported into the active wrapper workspace. It still does not pretend to patch minified renderer bundles in this proof repo. The next integration step is to mount the bridge in the real app-server process and wire a Settings entry to those methods.

## Verification Surface

Run:

```bash
node provider-studio-wave2/cli.js smoke --tmp-dir "$(mktemp -d)"
node provider-studio-wave2/cli.js switching-smoke --tmp-dir "$(mktemp -d)"
node provider-studio-wave2/cli.js bridge-smoke --tmp-dir "$(mktemp -d)"
node provider-studio-wave2/cli.js redaction-check --secret sk-feedback-SECRET-123 --tmp-dir "$(mktemp -d)"
node provider-studio-wave2/cli.js install-app-surface --provider-config /path/to/codex-provider-studio.json --app-dir /path/to/codex-app
node provider-studio-wave2/cli.js apply-codex-config --provider-config /path/to/codex-provider-studio.json --codex-config ~/.codex/config.toml
node provider-studio-wave2/cli.js restore-codex-config --codex-config ~/.codex/config.toml
node --test provider-studio-wave2/test.js
```

The smoke command starts a mock provider, discovers models, applies a selected model to a temporary config file, writes a redacted report, restores the previous config, and prints `PASS`.

The switching smoke command starts two mock providers, switches the active provider/model from provider A to provider B, exports `.codex-linux/provider-studio/state.json`, verifies no raw secret leaked, restores provider A, and prints `PASS`.

The bridge smoke command exercises the app-server-style bridge surface: doctor, apply twice, export app bridge state, export a Codex config TOML fragment, export a redacted report, restore, and print `PASS`.

The redaction check writes a report containing provider metadata while proving the raw secret is absent.

## Remaining Product Integration

To satisfy the full feedback as shipped product behavior, the active wrapper workspace still needs:

- Settings > Provider Studio entry.
- Renderer calls to the provider-studio bridge methods.
- Mounting the bridge methods in the real app-server process once upstream wrapper source is available.
- Runtime config reload or a clear "new thread only" application boundary.
- Patch-drift handling for the latest Codex DMG and hashed renderer bundles.

This branch now provides a concrete behavior package, bridge contract, app bridge state export, Codex config fragment export, and tests for that integration instead of only describing future work.

## Latest Development Pass

The follow-up team pass added the final safe surfaces possible in this proof repository: config apply/restore with backups, installable app surface files, and tests for both. Generated renderer UI and real app-server mounting still require upstream source/bundle patch work and are intentionally not faked here.
