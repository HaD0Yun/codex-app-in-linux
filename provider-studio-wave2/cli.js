#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  PRESETS,
  applyCodexConfigFragment,
  applyProvider,
  createAppBridge,
  doctorProvider,
  exportAppBridgeState,
  exportCodexConfigFragment,
  installAppSurface,
  exportReport,
  readConfig,
  restoreCodexConfigBackup,
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

function providerInput(overrides) {
  return {
    id: "mock-openai-compatible",
    displayName: "Mock OpenAI-compatible",
    baseUrl: overrides.baseUrl,
    modelListPath: "/v1/models",
    compatibility: "openai-compatible",
    authType: "bearer",
    apiKey: overrides.apiKey || "sk-smoke-secret-123",
    credentialRef: overrides.credentialRef || "env:MOCK_PROVIDER_API_KEY",
    defaultModel: overrides.defaultModel,
  };
}

async function runSmoke(args) {
  const root = tempRoot(args);
  const mock = await startMockProvider(["feedback-model-a", "feedback-model-b"]);
  try {
    const configPath = path.join(root, "codex-provider-studio.json");
    const reportPath = path.join(root, "provider-report.json");
    const provider = providerInput({ baseUrl: mock.baseUrl, defaultModel: "feedback-model-a" });
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

async function runSwitchingSmoke(args) {
  const root = tempRoot(args);
  const mockA = await startMockProvider(["model-a1", "model-a2"]);
  const mockB = await startMockProvider(["model-b1", "model-b2"]);
  try {
    const configPath = path.join(root, "codex-provider-studio.json");
    const statePath = path.join(root, ".codex-linux", "provider-studio", "state.json");
    const providerA = providerInput({
      id: "mock-a",
      displayName: "Mock A",
      baseUrl: mockA.baseUrl,
      apiKey: "sk-a-secret",
      credentialRef: "env:MOCK_A_KEY",
      defaultModel: "model-a2",
    });
    providerA.id = "mock-a";
    providerA.displayName = "Mock A";
    const providerB = providerInput({
      id: "mock-b",
      displayName: "Mock B",
      baseUrl: mockB.baseUrl,
      apiKey: "sk-b-secret",
      credentialRef: "env:MOCK_B_KEY",
      defaultModel: "model-b1",
    });
    providerB.id = "mock-b";
    providerB.displayName = "Mock B";

    assertCondition((await doctorProvider(providerA)).status === "pass", "provider A doctor failed");
    assertCondition((await doctorProvider(providerB)).status === "pass", "provider B doctor failed");
    applyProvider(configPath, providerA);
    const afterA = readConfig(configPath).active;
    applyProvider(configPath, providerB);
    const afterB = readConfig(configPath).active;
    const bridgeState = exportAppBridgeState(statePath, readConfig(configPath));
    assertCondition(afterA.providerId === "mock-a" && afterA.modelId === "model-a2", "provider A not active");
    assertCondition(afterB.providerId === "mock-b" && afterB.modelId === "model-b1", "provider B not active");
    assertCondition(bridgeState.codex.model === "model-b1", "bridge state did not reflect provider B");
    assertCondition(!fs.readFileSync(statePath, "utf8").includes("sk-b-secret"), "bridge state leaked provider B secret");
    restorePrevious(configPath);
    const restored = readConfig(configPath).active;
    assertCondition(restored.providerId === "mock-a" && restored.modelId === "model-a2", "restore did not return provider A");
    console.log(`PASS switching tmp=${root} bridge=${statePath}`);
  } finally {
    await mockA.close();
    await mockB.close();
  }
}

async function runBridgeSmoke(args) {
  const root = tempRoot(args);
  const mockA = await startMockProvider(["bridge-model-a1", "bridge-model-a2"]);
  const mockB = await startMockProvider(["bridge-model-b1", "bridge-model-b2"]);
  try {
    const configPath = path.join(root, "codex-provider-studio.json");
    const reportPath = path.join(root, "provider-report.json");
    const statePath = path.join(root, ".codex-linux", "provider-studio", "state.json");
    const fragmentPath = path.join(root, "codex-config.provider-studio.toml");
    const bridge = createAppBridge({ configPath, reportPath, statePath });
    const providerA = providerInput({
      baseUrl: mockA.baseUrl,
      apiKey: "sk-a-secret",
      credentialRef: "env:MOCK_A_KEY",
      defaultModel: "bridge-model-a2",
    });
    providerA.id = "mock-a";
    providerA.displayName = "Mock A";
    const providerB = providerInput({
      baseUrl: mockB.baseUrl,
      apiKey: "sk-b-secret",
      credentialRef: "env:MOCK_B_KEY",
      defaultModel: "bridge-model-b1",
    });
    providerB.id = "mock-b";
    providerB.displayName = "Mock B";

    assertCondition((await bridge.handle("providerStudio.doctor", { provider: providerA })).status === "pass", "bridge doctor A failed");
    await bridge.handle("providerStudio.apply", { provider: providerA });
    await bridge.handle("providerStudio.apply", { provider: providerB });
    const state = await bridge.handle("providerStudio.exportAppBridgeState");
    const fragment = exportCodexConfigFragment(fragmentPath, readConfig(configPath));
    await bridge.handle("providerStudio.exportReport", { report: { state, active: readConfig(configPath).active } });
    assertCondition(state.active.providerId === "mock-b", "bridge did not switch to provider B");
    assertCondition(fragment.includes('model = "bridge-model-b1"'), "Codex fragment did not select provider B model");
    assertCondition(!fs.readFileSync(statePath, "utf8").includes("sk-b-secret"), "app bridge state leaked secret");
    assertCondition(!fs.readFileSync(reportPath, "utf8").includes("sk-b-secret"), "bridge report leaked secret");
    await bridge.handle("providerStudio.restore");
    assertCondition(readConfig(configPath).active.providerId === "mock-a", "bridge restore did not return provider A");
    console.log(`PASS bridge-smoke tmp=${root} state=${statePath} fragment=${fragmentPath}`);
  } finally {
    await mockA.close();
    await mockB.close();
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

function runExportCodexFragment(args) {
  const configPath = argValue(args, "--config");
  const outPath = argValue(args, "--out");
  assertCondition(configPath, "--config is required");
  assertCondition(outPath, "--out is required");
  const fragment = exportCodexConfigFragment(outPath, readConfig(configPath));
  assertCondition(!/sk-[A-Za-z0-9_-]+/.test(fragment), "bridge fragment leaked secret-looking material");
  console.log(`PASS codex-fragment out=${outPath}`);
}


function runApplyCodexConfig(args) {
  const configPath = argValue(args, "--provider-config");
  const codexConfigPath = argValue(args, "--codex-config") || path.join(os.homedir(), ".codex", "config.toml");
  assertCondition(configPath, "--provider-config is required");
  const fragmentPath = argValue(args, "--fragment-out") || path.join(tempRoot(args), "codex-config.provider-studio.toml");
  const fragment = exportCodexConfigFragment(fragmentPath, readConfig(configPath));
  const result = applyCodexConfigFragment(codexConfigPath, fragment);
  console.log(`PASS apply-codex-config config=${result.configPath} backup=${result.backupPath} changed=${result.changed}`);
}

function runRestoreCodexConfig(args) {
  const codexConfigPath = argValue(args, "--codex-config") || path.join(os.homedir(), ".codex", "config.toml");
  const backupPath = argValue(args, "--backup");
  const result = restoreCodexConfigBackup(codexConfigPath, backupPath || undefined);
  console.log(`PASS restore-codex-config config=${result.configPath} backup=${result.backupPath}`);
}

function runInstallAppSurface(args) {
  const configPath = argValue(args, "--provider-config");
  const appDir = argValue(args, "--app-dir") || "/home/yun/tmp/codex-app-in-linux/upstream/codex-desktop-linux/codex-app";
  assertCondition(configPath, "--provider-config is required");
  const result = installAppSurface(appDir, readConfig(configPath));
  console.log(`PASS install-app-surface root=${result.root} state=${result.statePath} fragment=${result.fragmentPath} html=${result.htmlPath}`);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "smoke") {
    await runSmoke(args);
    return;
  }
  if (command === "switching-smoke") {
    await runSwitchingSmoke(args);
    return;
  }
  if (command === "bridge-smoke" || command === "app-bridge-smoke") {
    await runBridgeSmoke(args);
    return;
  }
  if (command === "redaction-check") {
    await runRedactionCheck(args);
    return;
  }
  if (command === "apply-codex-config") {
    runApplyCodexConfig(args);
    return;
  }
  if (command === "restore-codex-config") {
    runRestoreCodexConfig(args);
    return;
  }
  if (command === "install-app-surface") {
    runInstallAppSurface(args);
    return;
  }
  if (command === "export-codex-fragment") {
    runExportCodexFragment(args);
    return;
  }
  console.error("Usage: node provider-studio-wave2/cli.js <smoke|switching-smoke|bridge-smoke|redaction-check|export-codex-fragment|apply-codex-config|restore-codex-config|install-app-surface> [--tmp-dir DIR] [--config FILE --out FILE]");
  process.exitCode = 2;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
