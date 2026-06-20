# Mac-parity QA run manifest

Run: `mac-parity-qa-20260620`
Team: `execute-the-approved-ralplan-q-c4bf70ad`
Lane owner: worker-1 / Lane A — matrix, oracle, evidence marshal
Created: 2026-06-20T15:23:36Z

## Scope

QA-only campaign for unofficial Linux Codex desktop wrapper behavior against official Codex app documentation and any available supported-platform oracle. This run must not claim official Linux desktop support.

## Approved plan source

- Plan: `/home/yun/tmp/.gjc/plans/ralplan/2026-06-18-0625-a191/pending-approval.md`
- Decision shape: Option B — official macOS baseline plus Linux local generated-app QA, with native install/updater/service/package work out of scope unless separately approved.

## Hard gates for this run

Denied globally unless a separate explicit approval record exists:

- `sudo`, `pkexec`, package-manager commands, `systemctl`
- native package install, updater, service enablement, native host install mutation
- personal browser profiles
- production remote push / PR
- sensitive signed-in websites
- Computer Use helper install
- wrapper/source-code edits
- commit or push

## Host and tool pins

- Host kernel: Linux 6.17.0-35-generic x86_64 GNU/Linux
- Distro/session from existing evidence: Ubuntu 24.04.4 LTS, GNOME, Wayland, x64
- Desktop environment at run start: `ubuntu:GNOME/wayland/ubuntu`
- GJC version observed: `gjc/0.6.3`

## Existing Linux wrapper evidence imported as seed

- `reports/final-validation.md`
- `evidence/reports/latest-upgrade-summary.json`
- `evidence/reports/interactive-qa-summary.json`
- `evidence/reports/build-info.json`
- `evidence/gui/process-evidence.txt`
- `evidence/gui/webview-smoke-result.txt`

Seeded pins from imported evidence:

- Wrapper commit: `9125911c8347c35177dfc76e2f5bce2b8b2e41d4`
- Latest observed upstream app version: `26.616.41845`
- Electron version: `42.1.0`
- Latest observed DMG SHA256: `7de4cce5ec6e39478b9f0630e2b9257aadd1d02dd6a0fdc00c2ecdf0f536022d`
- Current local proof verdict: PASS WITH LIMITATIONS

## Official source oracle set

- App overview: https://developers.openai.com/codex/app
- Feature docs: https://developers.openai.com/codex/app/features
- In-app browser / Browser Use / Developer Mode: https://developers.openai.com/codex/app/browser
- Chrome extension: https://developers.openai.com/codex/app/chrome-extension
- Computer Use: https://developers.openai.com/codex/app/computer-use
- Review/Git UI: https://developers.openai.com/codex/app/review
- Help Center account/enterprise controls: https://help.openai.com/en/articles/11369540-codex-in-chatgpt

## Evidence directory contract

- `feature-matrix.csv` and `feature-matrix.md`: canonical row set and current verdicts.
- `taxonomy.md`: verdict and evidence semantics.
- `gates.md`: global and lane-specific gate ledger.
- `lane-evidence-index.md`: where lanes B/C add proof artifacts and handoffs.
- `final-verdict.md`: run-level support boundary and recommendation after all lanes complete.

