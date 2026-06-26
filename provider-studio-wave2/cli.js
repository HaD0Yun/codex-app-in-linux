#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  PRESETS,
  applyProvider,
  doctorProvider,
  exportReport,
  readConfig,
  restorePrevious,
  startMockProvider,
} = require("./core.js");

function argValue(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1] || null;
}

function tempRoot(args) {
  const requested = argValue(args, "--tmp-dir");
  if (requested) {
    fs.mkdirSync(requested, { recursive: true });
    return requested;
  }
  return fs.mkdtempSync(path.join(os.tmpdir(), "provider-studio-wave2-"));
}

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function runSmoke(args) {
  const root = tempRoot(args);
  const mock = await startMockProvider(["feedback-model-a", "feedback-model-b"]);
  try {
    const configPath = path.join(root, "codex-provider-studio.json");
    const reportPath = path.join(root, "provider-report.json");
    const provider = {
      id: "mock-openai-compatible",
      displayName: "Mock OpenAI-compatible",
      baseUrl: mock.baseUrl,
      modelListPath: "/v1/models",
      compatibility: "openai-compatible",
      authType: "bearer",
      apiKey: "sk-smoke-secret-123",
      credentialRef: "env:MOCK_PROVIDER_API_KEY",
      defaultModel: "feedback-model-a",
    };
    const doctor = await doctorProvider(provider);
    assertCondition(PRESETS.length >= 3, "expected provider presets");
    assertCondition(doctor.status === "pass", "doctor did not pass");
    assertCondition(doctor.models.includes("feedback-model-a"), "model discovery failed");
    const applied = applyProvider(configPath, provider);
    assertCondition(applied.config.active.modelId === "feedback-model-a", "active model not applied");
    const report = exportReport(reportPath, { provider, doctor, applied });
    assertCondition(JSON.stringify(report).includes("[REDACTED]"), "report was not redacted");
    assertCondition(!fs.readFileSync(reportPath, "utf8").includes("sk-smoke-secret-123"), "raw secret leaked");
    restorePrevious(configPath);
    assertCondition(readConfig(configPath).active === null, "restore did not return previous config");
    console.log(`PASS smoke tmp=${root} report=${reportPath}`);
  } finally {
    await mock.close();
  }
}

async function runRedactionCheck(args) {
  const root = tempRoot(args);
  const secret = argValue(args, "--secret") || "sk-feedback-SECRET-123";
  const reportPath = path.join(root, "redaction-report.json");
  const payload = {
    apiKey: secret,
    authorization: `Bearer ${secret}`,
    nested: { token: secret, visible: "provider-studio" },
  };
  exportReport(reportPath, payload);
  const reportText = fs.readFileSync(reportPath, "utf8");
  assertCondition(!reportText.includes(secret), "raw secret leaked");
  assertCondition(reportText.includes("[REDACTED]"), "redaction marker missing");
  console.log(`PASS redaction tmp=${root} report=${reportPath}`);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "smoke") {
    await runSmoke(args);
    return;
  }
  if (command === "redaction-check") {
    await runRedactionCheck(args);
    return;
  }
  console.error("Usage: node provider-studio-wave2/cli.js <smoke|redaction-check> [--tmp-dir DIR]");
  process.exitCode = 2;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

