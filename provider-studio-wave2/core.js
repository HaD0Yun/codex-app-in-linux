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
      redacted[key] = /apiKey|token|authorization|secret/i.test(key)
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
    compatibility: input.compatibility,
    auth: {
      type: input.authType,
      credentialRef: input.credentialRef,
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
    `${provider.baseUrl.replace(/\/$/, "")}${provider.modelListPath}`,
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
  applyProvider,
  createApplyPlan,
  discoverModels,
  doctorProvider,
  exportReport,
  readConfig,
  redactValue,
  restorePrevious,
  startMockProvider,
};

