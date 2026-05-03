#!/usr/bin/env node
/**
 * Epic 2 — Scheduled / fail-closed secret gates registry drift.
 * Ensures every workflow file is listed in artifacts/assurance/github-workflow-secret-gates.json
 * and that scheduled fail-closed workflows reference unified + specific skip vars and exit 1.
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
const unified = registry.unifiedSkipRepositoryVariable ?? "ALLOW_SECRET_GATED_SKIP";

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

  if (meta.kind === "scheduledFailClosed") {
    if (!text.includes("exit 1")) {
      errors.push(`${name}: scheduledFailClosed gate must use exit 1 when secrets missing`);
    }
    if (!text.includes(unified)) {
      errors.push(`${name}: must reference unified skip var ${unified} in gate env`);
    }
    const spec = meta.specificSkipVar;
    if (typeof spec !== "string" || !spec) {
      errors.push(`${name}: scheduledFailClosed requires specificSkipVar string`);
    } else if (!text.includes(spec)) {
      errors.push(`${name}: must reference ${spec} in gate env`);
    }
  }

  if (meta.kind === "pullRequestFailClosed") {
    if (!text.includes("exit 1")) {
      errors.push(`${name}: pullRequestFailClosed expects exit 1 on missing secrets`);
    }
    if (!text.includes(unified)) {
      errors.push(`${name}: must reference unified skip var ${unified}`);
    }
    for (const v of meta.specificSkipVars ?? []) {
      if (!text.includes(v)) {
        errors.push(`${name}: must reference ${v}`);
      }
    }
  }
}

if (errors.length) {
  console.error("check-github-scheduled-workflows-secrets failed:\n");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(
  `OK: ${onDisk.length} workflows registered; scheduledFailClosed + pullRequestFailClosed gates reference ${unified}.`
);
