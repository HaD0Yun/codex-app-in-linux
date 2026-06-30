import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
HELPER = REPO_ROOT / "scripts" / "codex-multi-model-config.py"
README = REPO_ROOT / "README.md"
FIRST_PASS_REPORT = REPO_ROOT / "reports" / "multi-model-selection-first-pass.md"


class CodexMultiModelConfigTests(unittest.TestCase):
    def run_helper(self, *args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, str(HELPER), *args],
            cwd=REPO_ROOT,
            text=True,
            capture_output=True,
            check=False,
        )

    def test_default_snippet_targets_cliproxyapi_data_plane(self) -> None:
        result = self.run_helper("--print-env")
        self.assertEqual(result.returncode, 0, result.stderr)
        output = result.stdout
        self.assertIn("model = \"cliproxyapi/default\"", output)
        self.assertIn("model_provider = \"cliproxyapi\"", output)
        self.assertIn("base_url = \"http://127.0.0.1:8317/v1\"", output)
        self.assertIn("env_key = \"CLIPROXYAPI_PROXY_CLIENT_KEY\"", output)
        self.assertIn("export CLIPROXYAPI_BASE_URL='http://127.0.0.1:8317/v1'", output)
        self.assertIn("export CLIPROXYAPI_PROXY_CLIENT_KEY=${CLIPROXYAPI_PROXY_CLIENT_KEY:-cliproxyapi-client-token}", output)
        self.assertNotIn("opencodex/default", output.lower())
        self.assertNotIn("127.0.0.1:10100", output)
        self.assertNotIn("LOCAL_RESPONSES_API_KEY", output)

    def test_refuses_privileged_management_key_as_data_plane_key(self) -> None:
        result = self.run_helper("--env-key", "CLIPROXYAPI_MANAGEMENT_KEY")
        self.assertNotEqual(result.returncode, 0)
        combined = result.stdout + result.stderr
        self.assertIn("Refusing to use privileged management key", combined)
        self.assertNotIn("cliproxyapi-client-token", combined)

    def test_append_dry_run_does_not_modify_target_and_refusal_still_applies(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            target = Path(tmpdir) / "config.toml"
            target.write_text("# existing config\n", encoding="utf-8")

            dry_run = self.run_helper("--append", str(target), "--dry-run")
            self.assertEqual(dry_run.returncode, 0, dry_run.stderr)
            self.assertEqual(target.read_text(encoding="utf-8"), "# existing config\n")
            self.assertIn("Dry run: would append provider 'cliproxyapi'", dry_run.stderr)

            append = self.run_helper("--append", str(target))
            self.assertEqual(append.returncode, 0, append.stderr)
            written = target.read_text(encoding="utf-8")
            self.assertIn("[model_providers.cliproxyapi]", written)

            refusal = self.run_helper("--append", str(target))
            self.assertNotEqual(refusal.returncode, 0)
            self.assertIn("Refusing to append", refusal.stderr)

    def test_docs_record_cliproxyapi_superseding_opencodex_guidance_without_live_claim(self) -> None:
        docs = "\n".join(
            [README.read_text(encoding="utf-8"), FIRST_PASS_REPORT.read_text(encoding="utf-8")]
        )
        self.assertIn("CLIProxyAPI", docs)
        self.assertIn("127.0.0.1:8317", docs)
        self.assertIn("bridge/BFF", docs)
        self.assertIn("bubble path", docs)
        self.assertIn("OpenCodex `10100`", docs)
        self.assertNotIn("live routing was performed", docs.lower())
        self.assertNotIn("CLIPROXYAPI_MANAGEMENT_KEY\"", docs)


if __name__ == "__main__":
    unittest.main()
