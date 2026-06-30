# Latest Codex App Linux proof refresh — 26.623.70822

Generated: 2026-06-30T10:59:05Z

## Result

The previous appcast-only blocker is resolved for the wrapper proof path: the current production `Codex.dmg` endpoint is available and contains Codex App `26.623.70822`. The wrapper build was regenerated from that DMG using `ilysenko/codex-desktop-linux` `9772c4ae2ba4ec604c8546e9b70ea5d95fd1a5df` (`0.8.6`).

## Selected artifact

| Field | Value |
| --- | --- |
| URL | `https://persistent.oaistatic.com/codex-app-prod/Codex.dmg` |
| Size | `529745413` |
| SHA256 | `75e670b8948d262ac8ea3ad8f61149e3d0240a04e6ca0b6bc249ac54fd83d43e` |
| App version | `26.623.70822` |
| Electron | `42.1.0` |
| Wrapper commit | `9772c4ae2ba4ec604c8546e9b70ea5d95fd1a5df` |
| Wrapper version | `0.8.6` |
| Wrapper dirty | `False` |

The Sparkle appcast still advertises `Codex-darwin-arm64-26.623.70822.zip` as the latest update enclosure. That ZIP was useful for appcast detection, but the Linux wrapper continues to use the current `Codex.dmg` endpoint for the reproducible build path.

## Verification

- `make build-app DMG=/home/yun/t2/repo/evidence/downloads/Codex.dmg` passed.
- Required core patch summary passed: applied/already-applied required patches are recorded in `evidence/build/patch-report.json`.
- Launch/webview smoke passed: see `evidence/gui/latest-26.623.70822-webview-smoke.json`.
- Runtime log evidence included `launcher_phase=webview_ready`, successful Codex CLI app-server handshake, renderer route mount, and `browser_use_iab_backend_startup_ready` for release `26.623.70822`.

## Remaining caution

This remains an unofficial Linux proof. Native package install/update-manager QA and manual project/thread/shell approval QA are still recommended before treating it as a daily-driver installation.
