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
  redactValue,
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
    authMode: overrides.authMode,
    localProxy: overrides.localProxy,
    management: overrides.management,
  };
}

test("provider presets include OpenAI-compatible targets", () => {
  const ids = PRESETS.map((preset) => preset.id);
  assert.deepEqual(ids, ["openai", "openrouter", "local-openai-compatible", "open-bigmodel", "z-ai", "cliproxyapi"]);
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

test("setup metadata captures local proxy mode without leaking secrets", () => {
  const root = tempDir();
  const configPath = path.join(root, "provider-studio.json");
  const statePath = path.join(root, "state.json");
  applyProvider(
    configPath,
    providerInput({
      id: "cliproxyapi",
      displayName: "CLIProxyAPI",
      baseUrl: "http://127.0.0.1:8317/v1",
      defaultModel: "gpt-5.5",
      authMode: "local-proxy",
      apiKey: "sk-local-secret",
      localProxy: { enabled: true, baseUrl: "http://127.0.0.1:8317/v1" },
      management: { url: "http://127.0.0.1:8317/v0/management", keyEnv: "CLIPROXY_MANAGEMENT_KEY", secretKey: "sk-management-secret" },
    }),
  );
  const state = exportAppBridgeState(statePath, readConfig(configPath));
  const serialized = JSON.stringify(state);
  assert.equal(state.provider.setup.authMode, "local-proxy");
  assert.equal(state.provider.setup.credentialSource.type, "proxy-managed");
  assert.equal(state.provider.setup.management.url, "http://127.0.0.1:8317/v0/management");
  assert.equal(serialized.includes("sk-local-secret"), false);
  assert.equal(serialized.includes("sk-management-secret"), false);
});

test("redaction covers management key value aliases", () => {
  const redacted = redactValue({
    management: {
      keyValue: "mgmt-super-secret-token",
      managementKey: "mgmt-key",
      password: "mgmt-password",
      safeEnvKey: "CLIPROXY_MANAGEMENT_KEY",
    },
  });
  const serialized = JSON.stringify(redacted);
  assert.equal(serialized.includes("mgmt-super-secret-token"), false);
  assert.equal(serialized.includes("mgmt-key"), false);
  assert.equal(serialized.includes("mgmt-password"), false);
  assert.equal(serialized.includes("CLIPROXY_MANAGEMENT_KEY"), true);
});

test("local proxy mode requires loopback URLs", () => {
  assert.throws(
    () => applyProvider(
      path.join(tempDir(), "provider-studio.json"),
      providerInput({ authMode: "local-proxy", baseUrl: "https://example.com/v1" }),
    ),
    (error) => error && error.code === "LOCAL_PROXY_NOT_LOOPBACK",
  );
  assert.throws(
    () => applyProvider(
      path.join(tempDir(), "provider-studio.json"),
      providerInput({
        authMode: "local-proxy",
        baseUrl: "http://127.0.0.1:8317/v1",
        management: { url: "https://example.com/v0/management" },
      }),
    ),
    (error) => error && error.code === "LOCAL_MANAGEMENT_NOT_LOOPBACK",
  );
});

test("direct api key mode stays disabled until secure local secret storage exists", () => {
  assert.throws(
    () => applyProvider(
      path.join(tempDir(), "provider-studio.json"),
      providerInput({ authMode: "direct-api-key", apiKey: "sk-local-secret" }),
    ),
    (error) => error && error.code === "AUTH_MODE_UNSUPPORTED",
  );
});


test("Codex config apply creates backup and restore recovers original", () => {
  const root = tempDir();
  const codexConfigPath = path.join(root, "config.toml");
  fs.writeFileSync(codexConfigPath, "model = \"old-model\"\nprofile = \"work\"\n\n[profiles.work]\nmodel_provider = \"old-profile-provider\"\napproval_policy = \"never\"\n\n[features]\njs_repl = false\n", { mode: 0o600 });
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
  assert.match(merged, /profile = "work"/);
  assert.match(merged, /\[profiles\.work\]/);
  assert.match(merged, /model_provider = "old-profile-provider"/);
  const result = applyCodexConfigFragment(codexConfigPath, fragment, { backupPath: path.join(root, "backup.toml") });
  assert.equal(result.changed, true);
  assert.match(fs.readFileSync(codexConfigPath, "utf8"), /model_provider = "provider-studio-mock-b"/);
  restoreCodexConfigBackup(codexConfigPath, result.backupPath);
  assert.equal(fs.readFileSync(codexConfigPath, "utf8"), "model = \"old-model\"\nprofile = \"work\"\n\n[profiles.work]\nmodel_provider = \"old-profile-provider\"\napproval_policy = \"never\"\n\n[features]\njs_repl = false\n");
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
  const bridgeCheck = [
    "import importlib.util, pathlib",
    `p = pathlib.Path(${JSON.stringify(serverPath)})`,
    "spec = importlib.util.spec_from_file_location('webview_server_under_test', p)",
    "m = importlib.util.module_from_spec(spec)",
    "spec.loader.exec_module(m)",
    "existing = 'model=\"old\"\\nmodel_provider=\"old-root\"\\nprofile = \"work\"\\n\\n[profiles.work] # keep\\nmodel_provider = \"old-profile-provider\"\\n'",
    "fragment = 'model = \"new\"\\nmodel_provider = \"provider-studio-new\"\\n\\n[model_providers.provider-studio-new]\\nbase_url = \"http://127.0.0.1:8317/v1\"\\n'",
    "merged = m._ps_merge(existing, fragment)",
    "assert 'model=\"old\"' not in merged",
    "assert 'model_provider=\"old-root\"' not in merged",
    "assert 'profile = \"work\"' in merged",
    "assert '[profiles.work] # keep' in merged",
    "assert 'model_provider = \"old-profile-provider\"' in merged",
  ].join("\n");
  execFileSync("python3", ["-c", bridgeCheck], { stdio: "pipe" });
});
test("visible Provider Studio overlay does not trap keyboard input globally", () => {
  const source = fs.readFileSync(path.join(__dirname, "visible-ui.js"), "utf8");
  assert.doesNotMatch(source, /'keydown'/);
  assert.doesNotMatch(source, /'keyup'/);
  assert.doesNotMatch(source, /'input'/);
  assert.doesNotMatch(source, /'change'/);
  assert.doesNotMatch(source, /'wheel'/);
  assert.match(source, /document\.addEventListener\('pointerdown'/);
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
