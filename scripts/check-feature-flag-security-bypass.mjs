#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const featureFlags = fs.readFileSync(path.join(root, "src/lib/feature-flags.ts"), "utf8");
const featureRegistry = fs.readFileSync(
  path.join(root, "src/lib/product-surface/feature-registry.ts"),
  "utf8"
);
const surfaceContext = fs.readFileSync(
  path.join(root, "src/lib/product-surface/context.ts"),
  "utf8"
);

const issues = [];
if (!/if \(!normalized\) return true;/.test(featureFlags)) {
  issues.push({ issue: "feature_flag_default_on_contract_changed" });
}
if (!/ENABLE_V[356]_/.test(featureFlags)) {
  issues.push({ issue: "missing_expected_env_backed_flags" });
}
if (!/PRODUCT_FEATURE_REGISTRY/.test(featureRegistry)) {
  issues.push({ issue: "missing_product_feature_registry" });
}
if (!/getFeatureFlags\(/.test(surfaceContext)) {
  issues.push({ issue: "product_surface_context_missing_feature_flags" });
}

console.log(JSON.stringify({ issueCount: issues.length, issues }, null, 2));
if (issues.length > 0) process.exit(1);
