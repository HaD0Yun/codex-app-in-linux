# Multi-model selector verification notes

## Scope

Lane B verified the CLIProxyAPI helper and documentation path with credential-free tests and static evidence. This lane did not run Codex, CLIProxyAPI, native install/updater/service flows, package-manager installs, generated app bundles, or proprietary artifacts.

The preferred first-pass direction is now CLIProxyAPI data-plane routing on `127.0.0.1:8317/v1`, with privileged management isolated behind the bridge/BFF and wrapper-owned bubble path. Verification is limited to repo files and commands that can run without provider credentials.

## Static evidence

Evidence files: `evidence/reports/multi-model-selector-static-check.json`, `evidence/reports/cliproxyapi-helper-verification.json`

Result: PASS

Checked files:

- `scripts/codex-multi-model-config.py`
- `tests/test_codex_multi_model_config.py`
- `README.md`
- `reports/multi-model-selection-first-pass.md`
- `reports/final-validation.md`
- `reports/multi-model-selector-verification.md`

Checks performed:

- PASS — Helper syntax compiles without credentials or generated app artifacts.
- PASS — Default helper output targets CLIProxyAPI data plane: `cliproxyapi`, `cliproxyapi/default`, `http://127.0.0.1:8317/v1`, and `CLIPROXYAPI_PROXY_CLIENT_KEY`.
- PASS — Helper refuses the privileged `CLIPROXYAPI_MANAGEMENT_KEY` as a Codex data-plane `env_key`.
- PASS — Helper `--append --dry-run` leaves the target file unchanged, regular append writes the provider block, and duplicate append refuses without `--force`.
- PASS — README/report docs state OpenCodex `10100` guidance is superseded by CLIProxyAPI `8317` plus bridge/BFF and bubble path.
- PASS — Verification uses placeholder token names only and makes no live routing claim.

## Acceptance criteria for Lane A/C integration

Before claiming live CLIProxyAPI routing support, rerun static checks after merging the delivery/architecture lanes and confirm the integrated docs/helpers meet these constraints:

1. Keep the Linux wrapper focused on launching Codex Desktop; do not patch proprietary app binaries for provider routing.
2. Document the CLIProxyAPI data-plane boundary on loopback, translating Codex `/v1/responses` traffic to external providers.
3. Document Codex config/model-provider injection as a user-controlled step; do not bundle credentials or provider defaults that imply live routing works without user setup.
4. Keep privileged management and upstream provider keys outside Codex config; renderer-facing docs must use only the scoped data-plane client key.
5. Preserve existing safety boundaries: no redistribution of `Codex.dmg`, generated app bundles, or proprietary artifacts; no `sudo`, `pkexec`, `systemctl`, package-manager installs, native install, native updater, or service enablement for this feature path.

## Focused verification commands

The evidence artifacts and tests were validated with:

```bash
python3 -m py_compile scripts/codex-multi-model-config.py tests/test_codex_multi_model_config.py
python3 -m unittest tests.test_codex_multi_model_config
python3 -m json.tool evidence/reports/cliproxyapi-helper-verification.json
```

Live provider routing remains out of scope without credentials and an explicitly running Codex/CLIProxyAPI setup.
