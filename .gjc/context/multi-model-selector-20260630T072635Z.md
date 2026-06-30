# Multi-model selector team context

## Task statement
Add a first-pass direction and implementation plan for enabling multiple model/provider selection in `HaD0Yun/codex-app-in-linux`.

## Desired outcome
A team run should produce concrete repo changes and evidence that the Linux Codex App proof can document and/or prototype a safe multi-model selection path. The preferred architecture is a local OpenCodex-style Responses API proxy plus Codex config/model-provider injection, not invasive Codex Desktop binary patching.

## Known facts/evidence
- This repository is currently an evidence-backed proof that Codex Desktop can run on Linux via an unofficial wrapper build.
- README documents generated Electron app launch, local webview server at `127.0.0.1:5175`, app-server handshake, and login/account readiness.
- The repo intentionally does not redistribute Codex Desktop, `Codex.dmg`, or generated bundles.
- The safest multi-model reference is `lidge-jun/opencodex`: Linux-supported local proxy translating Codex `/v1/responses` to Anthropic, Google, xAI, Kimi, Ollama, OpenRouter, Azure, DeepSeek, GLM, and OpenAI-compatible endpoints.
- `AITabby/opencodex` is useful for Desktop UX/model catalog/dashboard ideas, but is more macOS/Windows Desktop-oriented.
- `RyensX/OpenCodex` is mainly remote browser/mobile access, not the core multi-provider model proxy.

## Constraints
- Do not run native install/updater/service paths, sudo/pkexec/systemctl/package-manager installs, or redistribute proprietary artifacts.
- Keep the Linux wrapper focused on launching Codex Desktop; add model selection through documented local proxy/config integration where possible.
- Prefer documentation/prototype scripts/config examples over deep binary/app bundle patching for the first pass.
- Verification should be evidence-backed: static inspection plus focused command/tests available in this repo. Do not claim live provider routing without credentials and a running Codex app.

## Unknowns/open questions
- Whether the current wrapper build exposes the same Codex config/model-provider surfaces as Codex CLI/App on Linux.
- Whether a bundled or external proxy should be recommended for first release.
- Whether the repo should vendor code, add scripts, or only document integration with an external `opencodex` install.
- Which minimal smoke test can run without Codex credentials and without generated app artifacts.

## Likely codebase touchpoints
- `README.md` for the user-facing feature direction and safe usage path.
- `reports/` for architecture/validation notes.
- `evidence/` for generated inspection/test evidence if any.
- Potential new helper under `scripts/` only if it is small, non-invasive, and testable without proprietary artifacts.
