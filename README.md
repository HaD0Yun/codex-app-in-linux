# Codex App on Linux

<p align="center">
  <img src="assets/codex-app-linux-running.png" alt="Codex App running on Linux" width="900">
</p>

<p align="center">
  <strong>Proof that the Codex desktop app can run locally on Linux via an unofficial wrapper build.</strong>
</p>

<p align="center">
  <a href="reports/latest-26.623.70822-validation.md">Latest validation report</a> ·
  <a href="evidence/build/build-info.json">Build info</a> ·
  <a href="evidence/gui/latest-26.623.70822-webview-smoke.json">Latest smoke test</a>
</p>

> [!WARNING]
> Experimental proof of concept. This is **not** an official OpenAI Linux release and does **not** redistribute Codex Desktop, `Codex.dmg`, or generated app bundles.

## Summary

OpenAI ships the Codex desktop app for macOS and Windows. Linux is officially supported through Codex CLI, not a native desktop app. This repo documents a working Linux proof using an unofficial wrapper build that converts the upstream macOS `Codex.dmg` into a Linux Electron app.

Latest refresh tested on Ubuntu 24.04 LTS / GNOME session / x64. Earlier visual proof was captured on Ubuntu 24.04.4 LTS / GNOME Wayland / x64.

## Result

| Check | Result |
| --- | --- |
| Local wrapper build | Passed |
| Generated Electron app launch | Passed with current Linux patch set; Owl binding fallback recorded in patch report |
| Webview server | Passed on `127.0.0.1:5175` |
| Electron process tree | Passed |
| Codex CLI app-server handshake | Passed |
| Login/account readiness | Not reverified in latest refresh; sign-in QA still recommended |
| Native install / updater / service | Not used |
| Project/thread/shell approval manual QA | Still recommended |

Smoke result (latest refresh, 2026-06-30):

```text
http://127.0.0.1:5175/ -> HTTP 200
launcher_phase=webview_ready=true
Codex CLI initialized=true
app routes mounted=true
Handled 'ready' message=true
browser_use_iab_backend_startup_ready=true
release=26.623.70822
```

## Reproduce safely
### Computer Use / Chrome prerequisites

The wrapper build can start without Linux Computer Use support when the bundled plugin build is skipped. Before building, install a working Rust toolchain and the desktop-control helper so Chrome/Computer Use support is not accidentally omitted:

```bash
sudo apt-get install -y cargo rustc ydotool
cargo --version
```

Use Cargo `1.78.0` or newer. If `cargo` is missing or too old during the wrapper build, treat the build as incomplete and rebuild after fixing Rust/Cargo instead of debugging the Codex app UI.

First proof path avoids system-wide install.

```bash
git clone <wrapper-source-url> upstream/codex-linux-wrapper
cd upstream/codex-linux-wrapper
git checkout 9772c4ae2ba4ec604c8546e9b70ea5d95fd1a5df

# Download Codex.dmg separately, then verify:
sha256sum /path/to/Codex.dmg
# latest expected: 75e670b8948d262ac8ea3ad8f61149e3d0240a04e6ca0b6bc249ac54fd83d43e

make build-app DMG=/absolute/path/to/Codex.dmg
./codex-app/start.sh
```

Optional smoke check:

```bash
python3 - <<'PY'
import urllib.request
with urllib.request.urlopen('http://127.0.0.1:5175/', timeout=3) as r:
    print(r.status, r.read(80))
PY
```

## Proof metadata

| Field | Value |
| --- | --- |
| Wrapper commit | `9772c4ae2ba4ec604c8546e9b70ea5d95fd1a5df` |
| Wrapper version | `0.8.6` |
| Codex app version | `26.623.70822` |
| Electron version | `42.1.0` |
| DMG size | `529745413` bytes |
| DMG SHA256 | `75e670b8948d262ac8ea3ad8f61149e3d0240a04e6ca0b6bc249ac54fd83d43e` |

## Evidence

```text
reports/latest-26.623.70822-validation.md Latest refresh validation report
reports/final-validation.md              Original validation report
reports/worker-*-wrapper-audit.md        Audit notes
evidence/build/build-info.json           Generated app metadata
evidence/build/patch-report.json         Wrapper patch report
evidence/reports/latest-26.623.70822/latest-upgrade-summary.json Latest refresh summary
evidence/gui/latest-26.623.70822-webview-smoke.json Latest HTTP/log smoke result
evidence/gui/process-evidence.txt        Original Electron/webview process evidence
assets/codex-app-linux-running.png       Screenshot
```

Large/generated artifacts are intentionally ignored, including `upstream/`, `Codex.dmg`, generated app bundles, and `.gjc/state/`.

## Do not run first

Avoid these until after visual/login/project/thread/shell-approval QA passes:

```text
make bootstrap-native
make install-native
make setup-native
make update-native
make package / make install / make deb / make rpm / make pacman / make appimage
make service-enable
sudo / pkexec / systemctl / package-manager installs
```

## Known issue

If the app shows:

```text
Oops, an error has occurred
```

and logs mention a failed dynamic module fetch, the local webview server likely got stale. A clean restart fixed it during testing:

```bash
cd /path/to/codex-linux-wrapper
./codex-app/start.sh
```

## Remaining QA

Completed for latest refresh: wrapper build, loopback webview smoke, Codex CLI app-server handshake evidence, renderer route mount evidence, Browser Use IAB backend readiness evidence.

Still recommended: native package install/update-manager QA, sign in, open a disposable project, create a thread, test shell/file approval UI.

## Security note

Codex can access local files, repositories, credentials, shell commands, plugins, browser state, and computer-use surfaces. Treat unofficial wrappers as high-trust code. Start with a disposable project and avoid native install/updater/service paths until you trust the behavior.

## Official alternatives

For supported Linux use, run Codex CLI on Linux. For the official desktop app experience with Linux files, run Codex App on macOS/Windows and connect to the Linux host over SSH.
