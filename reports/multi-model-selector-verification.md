# Multi-model selector verification notes

## Scope

Lane B verified the repository's safe baseline and added a credential-free static evidence artifact for the first-pass multi-model selector direction. This lane did not run Codex, native install/updater/service flows, package-manager installs, generated app bundles, or proprietary artifacts.

The preferred first-pass direction remains documentation/prototype integration around an external OpenCodex-style local Responses API proxy plus Codex config/model-provider injection. Verification is limited to repo files and commands that can run without provider credentials.

## Static evidence

Evidence file: `evidence/reports/multi-model-selector-static-check.json`

Result: PASS

Checked files:

- `.gitignore`
- `README.md`
- `reports/final-validation.md`
- `reports/multi-model-selector-verification.md`

Checks performed:

- PASS — README warns unofficial/no redistribution: README warning keeps proprietary redistribution boundary visible.
- PASS — README documents denied native install/service paths: Dangerous native/service/package flows remain listed under Do not run first.
- PASS — README keeps loopback-only webview proof: Existing launch proof still scopes webview to localhost.
- PASS — Final validation denies system/native flows: Validation report records that native install/updater/service flows were not needed.
- PASS — Generated/proprietary artifacts ignored: .gitignore excludes wrapper checkout, upstream DMG copies, and team state.
- PASS — Current baseline has no live provider-routing claim: Baseline README does not claim provider routing before delivery/architecture docs are integrated.
- PASS — Verification report defines integration acceptance criteria: Lane B report records credential-free checks required for integrated docs/helpers.
- PASS — Local markdown/html evidence links resolve: 3 local links checked; missing=[].

## Acceptance criteria for Lane A/C integration

Before claiming first-pass multi-model selection support as documented, rerun static checks after merging the delivery/architecture lanes and confirm the integrated docs/helpers meet these constraints:

1. Keep the Linux wrapper focused on launching Codex Desktop; do not patch proprietary app binaries for provider routing.
2. Document a local proxy boundary, preferably loopback-only, translating Codex `/v1/responses` traffic to external providers.
3. Document Codex config/model-provider injection as a user-controlled step; do not bundle credentials or provider defaults that imply live routing works without user setup.
4. Preserve existing safety boundaries: no redistribution of `Codex.dmg`, generated app bundles, or proprietary artifacts; no `sudo`, `pkexec`, `systemctl`, package-manager installs, native install, native updater, or service enablement for this feature path.
5. Any helper must support a dry-run or static validation mode that succeeds without Codex credentials and without a generated app bundle.

## Focused verification commands

The evidence artifact was validated with:

```bash
python3 -m json.tool evidence/reports/multi-model-selector-static-check.json
```

A later integration pass can add a repo-local smoke command for any helper script, but live provider routing remains out of scope without credentials and an explicitly running Codex/proxy setup.
