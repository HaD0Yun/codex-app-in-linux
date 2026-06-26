"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const test = require("node:test");
const {
  PRESETS,
  applyCodexConfigFragment,
  applyProvider,
  createAppBridge,
  createCodexConfigFragment,
  doctorProvider,
  exportAppBridgeState,
  exportCodexConfigFragment,
  exportReport,
  installAppSurface,
  mergeCodexConfigText,
  readConfig,
  restoreCodexConfigBackup,
  restorePrevious,
  startMockProvider,
} = require("./core.js");

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "provider-studio-wave2-test-"));
}

function providerInput(overrides = {}) {
  return {
    id: overrides.id || "local",
    displayName: overrides.displayName || "Local",
    baseUrl: overrides.baseUrl || "http://127.0.0.1:1234",
    modelListPath: "/v1/models",
    compatibility: "openai-compatible",
    authType: "optional-bearer",
    apiKey: overrides.apiKey,
    credentialRef: overrides.credentialRef || "env:LOCAL_KEY",
    defaultModel: overrides.defaultModel || "local-model",
  };
}

test("provider presets include OpenAI-compatible targets", () => {
  const ids = PRESETS.map((preset) => preset.id);
  assert.deepEqual(ids, ["openai", "openrouter", "local-openai-compatible", "open-bigmodel", "z-ai"]);
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
  const result = applyProvider(configPath, providerInput());
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

test("Codex config fragment maps active provider without secrets", () => {
  const config = {
    providers: [
      {
        id: "mock-b",
        displayName: "Mock B",
        baseUrl: "http://127.0.0.1:9999",
        compatibility: "openai-compatible",
        auth: { type: "bearer", credentialRef: "env:MOCK_B_KEY" },
        defaultModel: "model-b1",
      },
    ],
    active: { providerId: "mock-b", modelId: "model-b1" },
    backups: [],
  };
  const fragment = createCodexConfigFragment(config);
  assert.match(fragment, /model = "model-b1"/);
  assert.match(fragment, /model_provider = "provider-studio-mock-b"/);
  assert.match(fragment, /env_key = "MOCK_B_KEY"/);
  assert.doesNotMatch(fragment, /sk-/);
});

test("app bridge switches providers, exports redacted state, and restores", async () => {
  const root = tempDir();
  const configPath = path.join(root, "provider-studio.json");
  const statePath = path.join(root, ".codex-linux", "provider-studio", "state.json");
  const reportPath = path.join(root, "report.json");
  const bridge = createAppBridge({ configPath, reportPath, statePath });
  const mockA = await startMockProvider(["model-a1", "model-a2"]);
  const mockB = await startMockProvider(["model-b1", "model-b2"]);
  try {
    const providerA = providerInput({
      id: "mock-a",
      displayName: "Mock A",
      baseUrl: mockA.baseUrl,
      apiKey: "sk-a-secret",
      credentialRef: "env:MOCK_A_KEY",
      defaultModel: "model-a2",
    });
    const providerB = providerInput({
      id: "mock-b",
      displayName: "Mock B",
      baseUrl: mockB.baseUrl,
      apiKey: "sk-b-secret",
      credentialRef: "env:MOCK_B_KEY",
      defaultModel: "model-b1",
    });
    assert.equal((await bridge.handle("providerStudio.doctor", { provider: providerA })).status, "pass");
    await bridge.handle("providerStudio.apply", { provider: providerA });
    await bridge.handle("providerStudio.apply", { provider: providerB });
    const state = await bridge.handle("providerStudio.exportAppBridgeState");
    assert.equal(state.active.providerId, "mock-b");
    assert.equal(state.codex.model, "model-b1");
    assert.equal(fs.readFileSync(statePath, "utf8").includes("sk-b-secret"), false);
    await bridge.handle("providerStudio.exportReport", { report: { state, apiKey: "sk-b-secret" } });
    assert.equal(fs.readFileSync(reportPath, "utf8").includes("sk-b-secret"), false);
    await bridge.handle("providerStudio.restore");
    assert.equal(readConfig(configPath).active.providerId, "mock-a");
  } finally {
    await mockA.close();
    await mockB.close();
  }
});


test("direct app bridge state export reflects selected provider", () => {
  const root = tempDir();
  const configPath = path.join(root, "provider-studio.json");
  const statePath = path.join(root, ".codex-linux", "provider-studio", "state.json");
  applyProvider(configPath, providerInput({ id: "mock-c", defaultModel: "model-c1" }));
  const state = exportAppBridgeState(statePath, readConfig(configPath));
  assert.equal(state.active.providerId, "mock-c");
  assert.equal(state.codex.model, "model-c1");
  assert.equal(fs.existsSync(statePath), true);
});


test("Codex config apply creates backup and restore recovers original", () => {
  const root = tempDir();
  const codexConfigPath = path.join(root, "config.toml");
  fs.writeFileSync(codexConfigPath, "model = \"old-model\"\n\n[features]\njs_repl = false\n", { mode: 0o600 });
  const fragment = createCodexConfigFragment({
    providers: [
      {
        id: "mock-b",
        displayName: "Mock B",
        baseUrl: "http://127.0.0.1:9999",
        compatibility: "openai-compatible",
        auth: { type: "bearer", credentialRef: "env:MOCK_B_KEY" },
        defaultModel: "model-b1",
      },
    ],
    active: { providerId: "mock-b", modelId: "model-b1" },
    backups: [],
  });
  const merged = mergeCodexConfigText(fs.readFileSync(codexConfigPath, "utf8"), fragment);
  assert.match(merged, /model = "model-b1"/);
  assert.match(merged, /\[features\]/);
  assert.doesNotMatch(merged, /old-model/);
  const result = applyCodexConfigFragment(codexConfigPath, fragment, { backupPath: path.join(root, "backup.toml") });
  assert.equal(result.changed, true);
  assert.match(fs.readFileSync(codexConfigPath, "utf8"), /model_provider = "provider-studio-mock-b"/);
  restoreCodexConfigBackup(codexConfigPath, result.backupPath);
  assert.equal(fs.readFileSync(codexConfigPath, "utf8"), "model = \"old-model\"\n\n[features]\njs_repl = false\n");
});

test("installAppSurface writes state, fragment, report, and html", () => {
  const root = tempDir();
  const appDir = path.join(root, "codex-app");
  const result = installAppSurface(appDir, {
    providers: [
      {
        id: "mock-b",
        displayName: "Mock B",
        baseUrl: "http://127.0.0.1:9999",
        compatibility: "openai-compatible",
        auth: { type: "bearer", credentialRef: "env:MOCK_B_KEY" },
        defaultModel: "model-b1",
      },
    ],
    active: { providerId: "mock-b", modelId: "model-b1" },
    backups: [],
  });
  for (const file of [result.statePath, result.fragmentPath, result.reportPath, result.htmlPath]) {
    assert.equal(fs.existsSync(file), true);
  }
  assert.match(fs.readFileSync(result.fragmentPath, "utf8"), /env_key = "MOCK_B_KEY"/);
});


function createFakeCodexApp(root, overrides = {}) {
  const appDir = path.join(root, "codex-app");
  const webviewDir = path.join(appDir, "content", "webview");
  const serverDir = path.join(appDir, ".codex-linux");
  fs.mkdirSync(webviewDir, { recursive: true });
  fs.mkdirSync(serverDir, { recursive: true });
  fs.writeFileSync(
    path.join(webviewDir, "index.html"),
    overrides.indexHtml || "<!doctype html><html><body><main>Codex</main></body></html>\n",
  );
  fs.writeFileSync(
    path.join(serverDir, "webview-server.py"),
    overrides.serverText || [
      "import functools",
      "import http.server",
      "",
      "class CodexWebviewHandler(http.server.SimpleHTTPRequestHandler):",
      "    pass",
      "",
    ].join("\n"),
  );
  return appDir;
}

test("non-env credential references are omitted from Codex fragments and redacted state", () => {
  const root = tempDir();
  const configPath = path.join(root, "provider-studio.json");
  const statePath = path.join(root, "state.json");
  const fragmentPath = path.join(root, "fragment.toml");
  applyProvider(configPath, providerInput({ credentialRef: "plain-secret-value", apiKey: "plain-secret-value" }));
  const config = readConfig(configPath);
  assert.equal(config.providers[0].auth.credentialRef, null);
  const state = exportAppBridgeState(statePath, config);
  const fragment = exportCodexConfigFragment(fragmentPath, config);
  assert.equal(JSON.stringify(state).includes("plain-secret-value"), false);
  assert.equal(fragment.includes("plain-secret-value"), false);
  assert.doesNotMatch(fragment, /credential_ref/);
});

test("install-visible-ui patches a fake app idempotently and emits valid Python", () => {
  const root = tempDir();
  const appDir = createFakeCodexApp(root);
  const cliPath = path.join(__dirname, "cli.js");
  execFileSync(process.execPath, [cliPath, "install-visible-ui", "--app-dir", appDir], { stdio: "pipe" });
  execFileSync(process.execPath, [cliPath, "install-visible-ui", "--app-dir", appDir], { stdio: "pipe" });
  const indexText = fs.readFileSync(path.join(appDir, "content", "webview", "index.html"), "utf8");
  const serverPath = path.join(appDir, ".codex-linux", "webview-server.py");
  assert.equal((indexText.match(/provider-studio-ui\.js/g) || []).length, 1);
  assert.equal(fs.existsSync(path.join(appDir, "content", "webview", "provider-studio-ui.js")), true);
  execFileSync("python3", ["-m", "py_compile", serverPath], { stdio: "pipe" });
});

test("install-visible-ui fails closed when app anchors drift", () => {
  const root = tempDir();
  const cliPath = path.join(__dirname, "cli.js");
  const badIndexApp = createFakeCodexApp(path.join(root, "bad-index"), { indexHtml: "<html><main>no body close</main></html>" });
  assert.throws(() => execFileSync(process.execPath, [cliPath, "install-visible-ui", "--app-dir", badIndexApp], { stdio: "pipe" }), /Provider Studio injection/);
  const badServerApp = createFakeCodexApp(path.join(root, "bad-server"), { serverText: "import functools\nimport http.server\nclass OtherHandler:\n    pass\n" });
  const badServerIndexPath = path.join(badServerApp, "content", "webview", "index.html");
  const badServerUiPath = path.join(badServerApp, "content", "webview", "provider-studio-ui.js");
  const beforeBadServerIndex = fs.readFileSync(badServerIndexPath, "utf8");
  assert.throws(() => execFileSync(process.execPath, [cliPath, "install-visible-ui", "--app-dir", badServerApp], { stdio: "pipe" }), /Provider Studio API injection/);
  assert.equal(fs.readFileSync(badServerIndexPath, "utf8"), beforeBadServerIndex);
  assert.equal(fs.existsSync(badServerUiPath), false);
});
