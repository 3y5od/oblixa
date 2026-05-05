#!/usr/bin/env node
/**
 * Epic 2 — Secret-gated workflow registry drift.
 * Ensures every workflow file is listed in artifacts/assurance/github-workflow-secret-gates.json,
 * that secret-gated jobs use the shared helper, and that strictness is explicit via REQUIRE_* vars.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const workflowsDir = path.join(root, ".github", "workflows");
const registryPath = path.join(root, "artifacts", "assurance", "github-workflow-secret-gates.json");

const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const helperScript = registry.helperScript ?? "scripts/github-actions/secret-gate.sh";

const onDisk = fs
  .readdirSync(workflowsDir)
  .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
  .sort();

const registered = Object.keys(registry.workflows ?? {}).sort();
const errors = [];

if (JSON.stringify(onDisk) !== JSON.stringify(registered)) {
  const onlyDisk = onDisk.filter((f) => !registered.includes(f));
  const onlyReg = registered.filter((f) => !onDisk.includes(f));
  if (onlyDisk.length) errors.push(`Workflow files not in registry: ${onlyDisk.join(", ")}`);
  if (onlyReg.length) errors.push(`Registry entries missing on disk: ${onlyReg.join(", ")}`);
}

for (const [name, meta] of Object.entries(registry.workflows ?? {})) {
  const full = path.join(workflowsDir, name);
  if (!fs.existsSync(full)) continue;
  const text = fs.readFileSync(full, "utf8");

  for (const gate of meta.gates ?? []) {
    if (gate.defaultBehavior !== "skip") {
      errors.push(`${name}:${gate.job}: secret-gated jobs must default to skip`);
    }
    if (!text.includes(helperScript)) {
      errors.push(`${name}:${gate.job}: must invoke shared helper ${helperScript}`);
    }
    if (!text.includes(gate.strictVariable)) {
      errors.push(`${name}:${gate.job}: must reference strict variable ${gate.strictVariable}`);
    }
    for (const secret of gate.requiredSecrets ?? []) {
      if (!text.includes(secret)) {
        errors.push(`${name}:${gate.job}: must reference required secret ${secret}`);
      }
    }
    if (/ALLOW_[A-Z0-9_]+_SKIP/.test(text) || text.includes("ALLOW_SECRET_GATED_SKIP")) {
      errors.push(`${name}:${gate.job}: legacy ALLOW_* skip vars should not be used in workflow gates`);
    }
    if (gate.optionalName === true && gate.defaultBehavior !== "skip") {
      errors.push(`${name}:${gate.job}: optional workflow gates must skip by default`);
    }
  }

  if (name === "ci.yml") {
    const qualityNeeds = /quality:\s*[\s\S]*?needs:\s*\[([^\]]+)\]/m.exec(text)?.[1] ?? "";
    if (qualityNeeds.includes("quality_build_e2e")) {
      errors.push("ci.yml: quality aggregate must not depend on optional quality_build_e2e");
    }
  }
}

if (errors.length) {
  console.error("check-github-scheduled-workflows-secrets failed:\n");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(
  `OK: ${onDisk.length} workflows registered; secret-gated jobs use ${helperScript} with explicit REQUIRE_* strictness.`
);
