# Provider Studio Wave 1

This branch records the first Provider Studio improvement package for the Linux Codex desktop wrapper direction.

It does not claim that the current proof repo already ships Provider Studio in the app UI. The repo is evidence-first, so this branch adds the verified implementation package as reviewable artifacts:

- `evidence/provider-studio-wave1/source/codex-rs/provider-studio/`: Rust crate scaffold for future provider setup, diagnostics, and reporting contracts.
- `evidence/provider-studio-wave1/source/linux-features/provider-studio/`: disabled-by-default Linux feature scaffold.
- `evidence/provider-studio-wave1/patches/`: patch files for applying the scaffold to the upstream Codex Rust workspace and Linux feature wrapper.
- `evidence/provider-studio-wave1/*test*.txt`: command transcripts proving the scaffold tests passed.
- `evidence/provider-studio-wave1/quality-gate.json`: artifact-backed quality gate for this wave.

## Result

PASS for Wave 1 foundation work:

- `codex-provider-studio` crate is workspace-registered and testable.
- Linux `provider-studio` feature remains opt-in and disabled by default.
- No committed `linux-features/features.json` enablement is introduced.
- App-server mock-provider fixture covers healthy models, missing models, responses 404, streaming assistant, streaming tool call, and auth-required 401.
- `just bazel-lock-update` was run; `MODULE.bazel.lock` did not require a diff.

## Commands Proven

```text
just test -p codex-provider-studio
node --test linux-features/provider-studio/test.js
just test -p codex-app-server provider_studio_mock
just fmt
cargo clippy -p codex-provider-studio --all-targets -- -D warnings
just bazel-lock-update
```

## Next Integration Step

To turn this evidence package into product behavior, apply the patch artifacts to the active wrapper/upstream integration workspace, then add a real Settings/launcher entry that consumes the disabled `provider-studio` feature. Keep the feature disabled by default until the UI has restore/rollback, no-secret logging, and local-only health checks.
