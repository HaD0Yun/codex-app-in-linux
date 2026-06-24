# Codex Provider Studio

This crate is the Wave 1 scaffold for future provider setup, diagnostics, and reporting contracts.
It intentionally contains no provider behavior, config mutation, server endpoints, CLI integration, or UI.

## Stable surfaces

- The Cargo package is `codex-provider-studio`.
- The Rust library crate name is `codex_provider_studio`.
- Public items exported from `src/lib.rs` are the only stable Rust surface in Wave 1.

## Unstable surfaces

- Module layout under `src/` is private implementation detail unless re-exported by `src/lib.rs`.
- Placeholder contract fields and enum variants may change before behavior is implemented.
- Any future server, CLI, config, doctor, or UI integration remains outside this scaffold.

## Wave 1 non-goals

- No provider presets or provider selection behavior.
- No config writes, restore flows, or migration logic.
- No doctor probes, network calls, or external provider requests.
- No app-server endpoints, CLI commands, UI assets, or `codex-core` changes.
