# CLIProxyAPI Bubble Execution Context

## Task statement
Implement the approved direction from ralplan: pivot `codex-app-in-linux` multi-model work from OpenCodex/opencodex dashboard UX to CLIProxyAPI-backed execution with an in-Codex-App bubble/overlay plan and test-driven, manually QA-ready changes.

## Desired outcome
Commit repo changes that update docs/helpers/evidence toward CLIProxyAPI as backend, add testable config/helper behavior, and create verification artifacts. The first execution slice should not claim live UI overlay if it cannot be safely implemented without generated/proprietary bundle patching. It should follow the pending plan gates: data-plane proof first, management bridge/BFF boundary, wrapper-owned overlay as safe UI path.

## Known facts/evidence
- Pending plan: `.gjc/_session-019f1765-c09c-7000-92ab-94340c0fda96/plans/ralplan/019f1765-c09c-7000-92ab-94340c0fda96/pending-approval.md`.
- Current branch: `feature/multi-model-selector`.
- Existing PR #1 documents an OpenCodex/opencodex-style first pass and must be superseded by CLIProxyAPI wording.
- CLIProxyAPI management API base: `http://localhost:8317/v0/management`; management auth requires bearer or `X-Management-Key` even on localhost.
- CLIProxyAPI data plane is expected around `http://127.0.0.1:8317/v1` with Codex/OpenAI Responses compatibility, but must be proven before live-routing claims.

## Constraints
- Do not use sudo, package-manager installs, native install/updater/service flows, or redistribute proprietary/generated Codex artifacts.
- Do not expose management key, proxy client API key, upstream provider secrets, or Codex OAuth in renderer/docs/evidence.
- Commit final changes after focused verification.
- Use TDD: add/adjust helper tests or self-tests before/with helper changes where practical.

## Unknowns/open questions
- Whether there is a safe non-proprietary UI seam for a direct bubble; first implementation should document/gate it rather than patch proprietary bundles.
- Exact CLIProxyAPI local runtime availability and credential availability for live data-plane proof.
- Whether helper should remain Python or be replaced/renamed for CLIProxyAPI semantics.

## Likely codebase touchpoints
- `README.md`
- `scripts/codex-multi-model-config.py`
- `reports/multi-model-selection-first-pass.md`
- `reports/multi-model-selector-architecture.md`
- `reports/multi-model-selector-verification.md`
- `evidence/reports/multi-model-selector-static-check.json`
- Potential tests under `scripts/` or `tests/` if added.
