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
- app-server-style bridge methods for Provider Studio actions
- Linux app bridge state export for `.codex-linux/provider-studio/state.json`
- reviewable Codex config fragment export using `env_key` references instead of raw secrets
- safe Codex config apply/restore with timestamped backups
- installable app surface files under `.codex-linux/provider-studio/`
- two-provider switching verification

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

`bridge-smoke` exercises the closest safe integration surface available in this proof repository: bridge-style methods, app bridge state export, a generated Codex config TOML fragment, redacted report export, two-provider switching, and restore.

`apply-codex-config` always writes a `*.provider-studio-backup-*` file before mutating the target Codex config. Use `restore-codex-config` to roll back the latest Provider Studio backup.
