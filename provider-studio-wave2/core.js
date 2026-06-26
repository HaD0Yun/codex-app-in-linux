"use strict";

const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const path = require("node:path");

const PRESETS = Object.freeze([
  Object.freeze({
    id: "openai",
    displayName: "OpenAI",
    baseUrl: "https://api.openai.com",
    authType: "bearer",
    modelListPath: "/v1/models",
    compatibility: "responses",
  }),
  Object.freeze({
    id: "openrouter",
    displayName: "OpenRouter",
    baseUrl: "https://openrouter.ai/api",
    authType: "bearer",
    modelListPath: "/v1/models",
    compatibility: "openai-compatible",
  }),
  Object.freeze({
    id: "local-openai-compatible",
    displayName: "Local OpenAI-compatible",
    baseUrl: "http://127.0.0.1:11434",
    authType: "optional-bearer",
    modelListPath: "/v1/models",
    compatibility: "openai-compatible",
  }),
  Object.freeze({
    id: "open-bigmodel",
    displayName: "open.bigmodel",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    authType: "bearer",
    modelListPath: "/models",
    compatibility: "openai-compatible",
  }),
  Object.freeze({
    id: "z-ai",
    displayName: "z.ai",
    baseUrl: "https://api.z.ai/api/coding/paas/v4",
    authType: "bearer",
    modelListPath: "/models",
    compatibility: "openai-compatible",
  }),
]);

class ProviderStudioError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ProviderStudioError";
    this.code = code;
  }
}

function redactString(value) {
  return value.replace(/sk-[A-Za-z0-9_-]+/g, "sk-...redacted");
}

function redactValue(value) {
  if (typeof value === "string") {
    return redactString(value);
  }
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }
  if (value && typeof value === "object") {
    const redacted = {};
    for (const [key, child] of Object.entries(value)) {
      redacted[key] = /apiKey|token|authorization|secret|credentialRef/i.test(key)
        ? "[REDACTED]"
        : redactValue(child);
    }
    return redacted;
  }
  return value;
}

function readConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    return { providers: [], active: null, backups: [] };
  }
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

function providerForApply(input) {
  return {
    id: input.id,
    displayName: input.displayName,
    baseUrl: input.baseUrl,
    modelListPath: input.modelListPath || "/v1/models",
    compatibility: input.compatibility,
    auth: {
      type: input.authType,
      credentialRef: envKeyFromCredentialRef(input.credentialRef) ? input.credentialRef : null,
    },
    defaultModel: input.defaultModel,
  };
}

function createApplyPlan(config, provider) {
  const nextProviders = config.providers.filter((item) => item.id !== provider.id);
  nextProviders.push(provider);
  return {
    previousActive: config.active,
    nextActive: { providerId: provider.id, modelId: provider.defaultModel },
    providerCountBefore: config.providers.length,
    providerCountAfter: nextProviders.length,
  };
}

function applyProvider(configPath, input) {
  const current = readConfig(configPath);
  const provider = providerForApply(input);
  const backup = {
    createdAt: new Date(0).toISOString(),
    config: current,
  };
  const providers = current.providers.filter((item) => item.id !== provider.id);
  providers.push(provider);
  const next = {
    providers,
    active: { providerId: provider.id, modelId: provider.defaultModel },
    backups: [...current.backups, backup],
  };
  writeJson(configPath, next);
  return { plan: createApplyPlan(current, provider), config: next };
}

function restorePrevious(configPath) {
  const current = readConfig(configPath);
  const backup = current.backups.at(-1);
  if (!backup) {
    throw new ProviderStudioError("RESTORE_UNAVAILABLE", "No backup config is available.");
  }
  writeJson(configPath, backup.config);
  return backup.config;
}

function codexProviderId(providerId) {
  return `provider-studio-${String(providerId).replace(/[^A-Za-z0-9_-]/g, "-")}`;
}

function tomlString(value) {
  return JSON.stringify(String(value));
}

function envKeyFromCredentialRef(credentialRef) {
  if (typeof credentialRef !== "string" || !credentialRef.startsWith("env:")) {
    return null;
  }
  const envKey = credentialRef.slice(4);
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(envKey) ? envKey : null;
}

function codexWireApi(compatibility) {
  return compatibility === "responses" ? "responses" : "chat";
}

function activeProvider(config) {
  if (!config.active) {
    throw new ProviderStudioError("NO_ACTIVE_PROVIDER", "No active Provider Studio provider is selected.");
  }
  const provider = config.providers.find((item) => item.id === config.active.providerId);
  if (!provider) {
    throw new ProviderStudioError("ACTIVE_PROVIDER_MISSING", "Active Provider Studio provider is missing.");
  }
  return provider;
}

function createCodexConfigFragment(config) {
  const provider = activeProvider(config);
  const providerId = codexProviderId(provider.id);
  const lines = [
    "# Generated by Provider Studio. Review before merging into ~/.codex/config.toml.",
    "# Secrets are intentionally omitted; set the referenced environment variable instead.",
    `model = ${tomlString(config.active.modelId)}`,
    `model_provider = ${tomlString(providerId)}`,
    "",
    `[model_providers.${providerId}]`,
    `name = ${tomlString(provider.displayName || provider.id)}`,
    `base_url = ${tomlString(provider.baseUrl)}`,
    `wire_api = ${tomlString(codexWireApi(provider.compatibility))}`,
  ];

  const envKey = envKeyFromCredentialRef(provider.auth && provider.auth.credentialRef);
  if (envKey) {
    lines.push(`env_key = ${tomlString(envKey)}`);
  }

  return `${lines.join("\n")}\n`;
}

function exportCodexConfigFragment(fragmentPath, config) {
  const fragment = createCodexConfigFragment(config);
  writeJson(`${fragmentPath}.metadata.json`, {
    generatedAt: new Date(0).toISOString(),
    destination: fragmentPath,
    active: config.active,
  });
  fs.mkdirSync(path.dirname(fragmentPath), { recursive: true });
  fs.writeFileSync(fragmentPath, fragment, { mode: 0o600 });
  return fragment;
}

function createAppBridgeState(config) {
  const provider = activeProvider(config);
  return redactValue({
    schemaVersion: 1,
    generatedAt: new Date(0).toISOString(),
    active: config.active,
    provider: {
      id: provider.id,
      displayName: provider.displayName,
      baseUrl: provider.baseUrl,
      modelListPath: provider.modelListPath || "/v1/models",
      compatibility: provider.compatibility,
      auth: provider.auth,
    },
    codex: {
      model: config.active.modelId,
      modelProvider: codexProviderId(provider.id),
      wireApi: codexWireApi(provider.compatibility),
      configFragment: createCodexConfigFragment(config),
    },
  });
}

function exportAppBridgeState(statePath, config) {
  const state = createAppBridgeState(config);
  writeJson(statePath, state);
  return state;
}

function clonePreset(preset) {
  return { ...preset };
}

function createAppBridge(options) {
  const configPath = options.configPath;
  const defaultReportPath = options.reportPath;
  const defaultStatePath = options.statePath;
  if (!configPath) {
    throw new ProviderStudioError("CONFIG_PATH_REQUIRED", "Provider Studio bridge requires a config path.");
  }

  return {
    async handle(method, payload = {}) {
      if (method === "providerStudio.listPresets") {
        return { presets: PRESETS.map(clonePreset), active: readConfig(configPath).active };
      }
      if (method === "providerStudio.readConfig") {
        return redactValue(readConfig(configPath));
      }
      if (method === "providerStudio.doctor") {
        return redactValue(await doctorProvider(payload.provider));
      }
      if (method === "providerStudio.apply") {
        return redactValue(applyProvider(configPath, payload.provider));
      }
      if (method === "providerStudio.restore") {
        return redactValue({ config: restorePrevious(configPath) });
      }
      if (method === "providerStudio.exportReport") {
        const reportPath = payload.reportPath || defaultReportPath;
        if (!reportPath) {
          throw new ProviderStudioError("REPORT_PATH_REQUIRED", "Provider Studio report export requires a report path.");
        }
        return exportReport(reportPath, payload.report || {});
      }
      if (method === "providerStudio.exportAppBridgeState") {
        const statePath = payload.statePath || defaultStatePath;
        if (!statePath) {
          throw new ProviderStudioError("STATE_PATH_REQUIRED", "Provider Studio app bridge state export requires a state path.");
        }
        return exportAppBridgeState(statePath, readConfig(configPath));
      }
      throw new ProviderStudioError("UNKNOWN_METHOD", `Unknown Provider Studio bridge method: ${method}`);
    },
  };
}


function timestampForBackup() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function stripRootTomlKey(lines, key) {
  let inRoot = true;
  const pattern = new RegExp(`^\\s*${key}\\s*=`);
  return lines.filter((line) => {
    if (/^\s*\[[^\]]+\]\s*(?:#.*)?$/.test(line)) {
      inRoot = false;
    }
    return !(inRoot && pattern.test(line));
  });
}

function stripTomlSection(lines, sectionName) {
  const result = [];
  let skipping = false;
  const sectionPattern = new RegExp(`^\\s*\\[${sectionName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]\\s*(?:#.*)?$`);
  for (const line of lines) {
    const isSection = /^\s*\[[^\]]+\]\s*(?:#.*)?$/.test(line);
    if (sectionPattern.test(line)) {
      skipping = true;
      continue;
    }
    if (skipping && isSection) {
      skipping = false;
    }
    if (!skipping) {
      result.push(line);
    }
  }
  return result;
}

function mergeCodexConfigText(existingText, fragment) {
  const providerMatch = fragment.match(/^model_provider\s*=\s*"([^"]+)"/m);
  const providerId = providerMatch && providerMatch[1];
  if (!providerId) {
    throw new ProviderStudioError("FRAGMENT_PROVIDER_MISSING", "Codex config fragment has no model_provider.");
  }
  let lines = existingText.length > 0 ? existingText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n") : [];
  if (lines.at(-1) === "") {
    lines = lines.slice(0, -1);
  }
  lines = stripRootTomlKey(lines, "model");
  lines = stripRootTomlKey(lines, "model_provider");
  lines = stripTomlSection(lines, `model_providers.${providerId}`);
  while (lines.length > 0 && lines.at(-1).trim() === "") {
    lines.pop();
  }
  const prefix = lines.length > 0 ? `${lines.join("\n")}\n\n` : "";
  return `${prefix}${fragment.trim()}\n`;
}

function applyCodexConfigFragment(configPath, fragment, options = {}) {
  const backupPath = options.backupPath || `${configPath}.provider-studio-backup-${timestampForBackup()}`;
  const existingText = fs.existsSync(configPath) ? fs.readFileSync(configPath, "utf8") : "";
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(backupPath, existingText, { mode: 0o600 });
  const merged = mergeCodexConfigText(existingText, fragment);
  fs.writeFileSync(configPath, merged, { mode: 0o600 });
  return { configPath, backupPath, changed: existingText !== merged };
}

function latestCodexConfigBackup(configPath) {
  const dir = path.dirname(configPath);
  const base = path.basename(configPath);
  if (!fs.existsSync(dir)) {
    return null;
  }
  const backups = fs
    .readdirSync(dir)
    .filter((name) => name.startsWith(`${base}.provider-studio-backup-`))
    .map((name) => path.join(dir, name))
    .sort();
  return backups.at(-1) || null;
}

function restoreCodexConfigBackup(configPath, backupPath = latestCodexConfigBackup(configPath)) {
  if (!backupPath || !fs.existsSync(backupPath)) {
    throw new ProviderStudioError("CODEX_CONFIG_BACKUP_MISSING", "No Provider Studio Codex config backup is available.");
  }
  const backupText = fs.readFileSync(backupPath, "utf8");
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, backupText, { mode: 0o600 });
  return { configPath, backupPath, restored: true };
}

function installAppSurface(appDir, config, options = {}) {
  const root = path.join(appDir, ".codex-linux", "provider-studio");
  const statePath = options.statePath || path.join(root, "state.json");
  const fragmentPath = options.fragmentPath || path.join(root, "codex-config.provider-studio.toml");
  const reportPath = options.reportPath || path.join(root, "report.json");
  fs.mkdirSync(root, { recursive: true });
  const state = exportAppBridgeState(statePath, config);
  const fragment = exportCodexConfigFragment(fragmentPath, config);
  exportReport(reportPath, { state, fragmentPath });
  const htmlPath = path.join(root, "index.html");
  fs.writeFileSync(
    htmlPath,
    `<!doctype html>\n<meta charset="utf-8">\n<title>Provider Studio</title>\n<style>body{font-family:system-ui,sans-serif;margin:2rem;max-width:900px}pre{background:#111;color:#eee;padding:1rem;overflow:auto;border-radius:8px}</style>\n<h1>Provider Studio bridge</h1>\n<p>This generated surface shows the active Provider Studio state exported by the Linux wrapper overlay. Apply the TOML fragment with review before merging into Codex config.</p>\n<h2>Active</h2>\n<pre>${JSON.stringify(state.active, null, 2).replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[ch])}</pre>\n<h2>Codex fragment</h2>\n<pre>${fragment.replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[ch])}</pre>\n`,
    { mode: 0o600 },
  );
  return { root, statePath, fragmentPath, reportPath, htmlPath };
}

function requestJson(urlText, apiKey, timeoutMs) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlText);
    const client = url.protocol === "https:" ? https : http;
    const request = client.request(
      url,
      {
        method: "GET",
        timeout: timeoutMs,
        headers: apiKey ? { authorization: `Bearer ${apiKey}` } : {},
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          if (response.statusCode !== 200) {
            reject(new ProviderStudioError("MODEL_LIST_FAILED", `HTTP ${response.statusCode}`));
            return;
          }
          resolve(JSON.parse(body));
        });
      },
    );
    request.on("timeout", () => request.destroy(new ProviderStudioError("TIMEOUT", "Provider timed out.")));
    request.on("error", reject);
    request.end();
  });
}

async function discoverModels(provider, timeoutMs = 1500) {
  const body = await requestJson(
    `${provider.baseUrl.replace(/\/$/, "")}${provider.modelListPath || "/v1/models"}`,
    provider.apiKey,
    timeoutMs,
  );
  if (!Array.isArray(body.data)) {
    throw new ProviderStudioError("MODEL_LIST_SCHEMA", "Model list response has no data array.");
  }
  return body.data.map((model) => String(model.id));
}

async function doctorProvider(provider) {
  try {
    const models = await discoverModels(provider);
    return {
      status: models.length > 0 ? "pass" : "fail",
      checks: {
        reachable: "pass",
        auth: "pass",
        modelList: models.length > 0 ? "pass" : "fail",
      },
      models,
    };
  } catch (error) {
    return {
      status: "fail",
      checks: {
        reachable: error instanceof ProviderStudioError && error.code === "TIMEOUT" ? "timeout" : "fail",
        auth: error instanceof ProviderStudioError && error.message.includes("401") ? "fail" : "unknown",
        modelList: "fail",
      },
      error: redactValue(error instanceof Error ? error.message : String(error)),
      models: [],
    };
  }
}

function exportReport(reportPath, payload) {
  const report = redactValue(payload);
  writeJson(reportPath, report);
  return report;
}

function startMockProvider(models) {
  const requests = [];
  const server = http.createServer((request, response) => {
    requests.push({ url: request.url, authorization: request.headers.authorization || "" });
    if (request.url === "/v1/models") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ object: "list", data: models.map((id) => ({ id })) }));
      return;
    }
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: { message: "not found" } }));
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${address.port}`,
        requests,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

module.exports = {
  PRESETS,
  ProviderStudioError,
  applyCodexConfigFragment,
  applyProvider,
  createAppBridge,
  createAppBridgeState,
  installAppSurface,
  latestCodexConfigBackup,
  mergeCodexConfigText,
  createApplyPlan,
  createCodexConfigFragment,
  discoverModels,
  doctorProvider,
  exportAppBridgeState,
  exportCodexConfigFragment,
  exportReport,
  readConfig,
  redactValue,
  restoreCodexConfigBackup,
  restorePrevious,
  startMockProvider,
};
