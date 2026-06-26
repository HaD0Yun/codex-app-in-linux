# Provider Studio Wave 2 Overlay

This directory is an executable overlay package for the Linux wrapper proof repo.
It does not claim the Codex App renderer already ships Provider Studio UI.

It proves the product contracts needed by the next wrapper integration wave:

- provider presets
- OpenAI-compatible model discovery
- doctor checks
- config apply planning
- restore planning
- redacted troubleshooting reports

Run:

```bash
node provider-studio-wave2/cli.js smoke --tmp-dir "$(mktemp -d)"
node provider-studio-wave2/cli.js redaction-check --secret sk-feedback-SECRET-123 --tmp-dir "$(mktemp -d)"
node --test provider-studio-wave2/test.js
```

