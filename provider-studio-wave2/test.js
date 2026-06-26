"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  PRESETS,
  applyProvider,
  doctorProvider,
  exportReport,
  readConfig,
  restorePrevious,
  startMockProvider,
} = require("./core.js");

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "provider-studio-wave2-test-"));
}

test("provider presets include OpenAI-compatible targets", () => {
  const ids = PRESETS.map((preset) => preset.id);
  assert.deepEqual(ids, ["openai", "openrouter", "local-openai-compatible"]);
});

test("doctor discovers models from a mock OpenAI-compatible provider", async () => {
  const mock = await startMockProvider(["model-one", "model-two"]);
  try {
    const result = await doctorProvider({
      baseUrl: mock.baseUrl,
      modelListPath: "/v1/models",
      apiKey: "sk-test-secret",
    });
    assert.equal(result.status, "pass");
    assert.deepEqual(result.models, ["model-one", "model-two"]);
  } finally {
    await mock.close();
  }
});

test("apply stores credential reference and restore recovers previous config", () => {
  const root = tempDir();
  const configPath = path.join(root, "config.json");
  const result = applyProvider(configPath, {
    id: "local",
    displayName: "Local",
    baseUrl: "http://127.0.0.1:1234",
    compatibility: "openai-compatible",
    authType: "optional-bearer",
    credentialRef: "env:LOCAL_KEY",
    defaultModel: "local-model",
  });
  assert.equal(result.config.active.modelId, "local-model");
  assert.equal(result.config.providers[0].auth.credentialRef, "env:LOCAL_KEY");
  restorePrevious(configPath);
  assert.deepEqual(readConfig(configPath), { providers: [], active: null, backups: [] });
});

test("exportReport redacts secrets recursively", () => {
  const root = tempDir();
  const reportPath = path.join(root, "report.json");
  exportReport(reportPath, {
    apiKey: "sk-feedback-SECRET-123",
    child: { authorization: "Bearer sk-feedback-SECRET-123" },
  });
  const report = fs.readFileSync(reportPath, "utf8");
  assert.equal(report.includes("sk-feedback-SECRET-123"), false);
  assert.equal(report.includes("[REDACTED]"), true);
});
