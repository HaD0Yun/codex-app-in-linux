# Codex Desktop Linux workaround validation

## Result

PASS for local non-system proof: the wrapper built a Linux Electron Codex app from the latest observed upstream Codex DMG (`26.616.41845`), and the generated app started on Linux without the prior `electron_common_owl_features` startup failure. The current proof shows the renderer mounted, the ready message was handled, the app-server handshake worked, an existing signed-in account was readable, and Browser Use IAB backend startup reached ready state.

The latest DMG required local wrapper compatibility patches for upstream drift in tray setup detection, the subagent metadata webview bundle pattern, and OpenAI's custom `electron_common_owl_features` native binding. The compatibility diff is recorded at `evidence/reports/wrapper-latest-compat.patch`.

Screenshot capture was not rerun in this latest smoke pass; the prior GNOME/Wayland proof attempt was blocked by `org.freedesktop.DBus.Error.AccessDenied` and X root capture failed with `BadMatch`. Visual screenshot evidence remains incomplete, but startup failure modal absence is backed by current app logs (`bootstrapFailed=false`, `owlBindingError=false`) rather than HTTP-only webview reachability.

## Source and artifact pinning

- Wrapper repo: `<wrapper-source-url>`
- Wrapper commit used for successful build: `9125911c8347c35177dfc76e2f5bce2b8b2e41d4`
- Upstream DMG URL: `https://persistent.oaistatic.com/codex-app-prod/Codex.dmg`
- DMG size: `520180841`
- DMG SHA256: `7de4cce5ec6e39478b9f0630e2b9257aadd1d02dd6a0fdc00c2ecdf0f536022d`
- Upstream app version from build-info: `26.616.41845`
- Electron version from build-info: `42.1.0`
- Target: Ubuntu 24.04.4 LTS, x64, GNOME Wayland, `.deb` family profile
- Wrapper compatibility patch: `evidence/reports/wrapper-latest-compat.patch`

## Commands actually used for successful proof

Allowed non-system proof path:

```bash
git clone <wrapper-source-url> upstream/codex-desktop-linux
# latest DMG was downloaded separately and checksum recorded
make build-app DMG=/home/yun/tmp/codex-linux-app-proof/evidence/upstream/Codex.dmg
./codex-app/start.sh
```

No `sudo`, `pkexec`, package manager, service enablement, native package install, or updater command was needed for the successful proof.

## Build evidence

- Generated app directory exists: `upstream/codex-desktop-linux/codex-app/`
- Build metadata copied to `evidence/build/build-info.json`
- Patch report copied to `evidence/build/patch-report.json`
- Latest upgrade summary copied to `evidence/reports/latest-upgrade-summary.json`
- Build output showed:
  - system dependencies found using `7z`
  - provided frozen DMG used
  - ASAR extracted and patched
  - native modules rebuilt for Electron `42.1.0`
  - Linux Computer Use backend compiled
  - `codex-app/start.sh` generated
  - `linux-owl-feature-binding-noop` required patch applied

## Launch / smoke evidence

Evidence files:

- `evidence/gui/process-evidence.txt`
- `evidence/gui/webview-smoke-result.txt`
- `evidence/gui/gnome-screenshot-result.txt`
- `evidence/gui/codex-app-window-probe.log`
- `evidence/gui/codex-app-webview-smoke.log`

Observed during launch:

- `start.sh` process stayed alive until smoke-test termination.
- Webview server process started on loopback only:
  - `python3 ... webview-server.py 5175 --bind 127.0.0.1`
- Electron main process started:
  - `electron --no-sandbox --class=codex-desktop --app-id=codex-desktop ...`
- Electron zygote/gpu/utility/renderer processes started.
- Local webview responded on `http://127.0.0.1:5175/` with HTTP 200 and HTML prefix:
  - `<!doctype html><html lang="en" ...>`
- Current Sentry scope/log evidence showed:
  - `bootstrapFailed=false`
  - `owlBindingError=false`
  - `[startup][renderer] app routes mounted`
  - `Handled 'ready' message`
  - `account/read` succeeded for an existing signed-in `chatgpt` user
  - `browser_use_iab_backend_startup_ready`

This proves the generated Linux app launches its local UI server, imports the main app without the Owl native binding crash, mounts the renderer, and connects to the local Codex app-server on this Linux host.

## Manual QA status

Completed:

- Audit gate and allowlist/denylist.
- Latest upstream DMG checksum.
- Local non-system build.
- Generated app launch smoke.
- Loopback-only webview server check.
- Electron process tree check.
- Required upstream patch validation after local compatibility patches.
- Existing signed-in account readiness check.
- Browser Use IAB backend startup readiness check.

Not completed:

- Visual screenshot proof, because GNOME/Wayland denied screenshot over DBus and X root capture failed.
- Fresh unauthenticated login/sign-in flow from a clean profile.
- Disposable project/thread/shell approval QA.

## Security notes

Denied for this proof and still not run:

- `make bootstrap-native`
- `make install-native`
- `make setup-native`
- `make update-native`
- `make package`
- `make install`
- `make deb/rpm/pacman/appimage`
- `sudo`, `pkexec`, package managers, `systemctl`, service/updater enablement

Risk surfaces confirmed by audit:

- The wrapper downloads/transforms proprietary upstream DMG content.
- The generated app bundles/stages plugin resources and Linux Computer Use backend resources.
- Native packages introduce updater/service/polkit surfaces; those were intentionally avoided.
- Webview server bind was loopback (`127.0.0.1`) in the successful launch evidence.

## Recommendation

Use this wrapper path when the immediate goal is opening Codex Desktop GUI locally on Linux. Keep using the local generated app first. Do not install the native package or enable updater/service surfaces until visual/login/manual QA is finished.

For daily supported work, keep the official fallback ready: Codex CLI on Linux, or official Codex App on macOS/Windows connected to this Linux host over SSH.
