#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { patches } = require("./patch.js");
const {
  discoverLinuxFeatureManifests,
  enabledLinuxFeatureIds,
  loadLinuxFeatureMainBundlePatches,
  loadLinuxFeaturePatchDescriptors,
} = require("../../scripts/lib/linux-features.js");

function withTempFeatureConfig(enabled, fn) {
  const originalConfig = process.env.CODEX_LINUX_FEATURES_CONFIG;
  const root = path.resolve(__dirname, "..");
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-provider-studio-feature-test-"));
  process.env.CODEX_LINUX_FEATURES_CONFIG = path.join(tempDir, "features.json");
  try {
    fs.writeFileSync(process.env.CODEX_LINUX_FEATURES_CONFIG, JSON.stringify({ enabled }, null, 2));
    return fn(root);
  } finally {
    if (originalConfig == null) {
      delete process.env.CODEX_LINUX_FEATURES_CONFIG;
    } else {
      process.env.CODEX_LINUX_FEATURES_CONFIG = originalConfig;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

test("provider-studio feature stays disabled until listed in features.json", () => {
  withTempFeatureConfig([], (root) => {
    assert.deepEqual(enabledLinuxFeatureIds({ featuresRoot: root }), []);
    assert.deepEqual(loadLinuxFeaturePatchDescriptors({ featuresRoot: root }), []);
    assert.deepEqual(loadLinuxFeatureMainBundlePatches({ featuresRoot: root }), []);
  });
});

test("provider-studio manifest normalizes defaultEnabled to false", () => {
  const root = path.resolve(__dirname, "..");
  const feature = discoverLinuxFeatureManifests({ featuresRoot: root })
    .find((candidate) => candidate.id === "provider-studio");

  assert.ok(feature);
  assert.equal(feature.manifest.defaultEnabled, false);
  assert.equal(feature.manifest.entrypoints.patches, "./patch.js");
});

test("provider-studio enabled descriptor loading is fail-soft", () => {
  assert.deepEqual(patches, []);

  withTempFeatureConfig(["provider-studio"], (root) => {
    assert.deepEqual(enabledLinuxFeatureIds({ featuresRoot: root }), ["provider-studio"]);
    assert.deepEqual(loadLinuxFeaturePatchDescriptors({ featuresRoot: root }), []);
    assert.deepEqual(loadLinuxFeatureMainBundlePatches({ featuresRoot: root }), []);
  });
});
