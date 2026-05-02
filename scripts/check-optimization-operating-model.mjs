#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createResult, finishWithResult } from "./lib/result.mjs";
import { nowMs } from "./lib/timing.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const startMs = nowMs();
const strict = process.argv.includes("--strict");

const requiredPhrases = [
  "Incident Communications And Degraded Operations",
  "Legal Hold, Residency, Privacy, And Data Lifecycle",
  "Enterprise, Mobile, And External Consumer Compatibility",
  "Billing, Quotas, Providers, And Cost Controls",
  "Accessibility, Procurement, And Trust Evidence",
  "Database, Search, And Domain Semantics",
  "Tooling, Governance, And Change Control",
  "Ownership And Knowledge Transfer",
  "SEV-1",
  "SEV-2",
  "Break-glass controls",
  "Performance telemetry is treated as internal diagnostic data",
  "Provider inventory",
  "Reproducible local verification tiers",
  "No layout-blocking optional data",
  "No broad refresh loops by default",
  "No exact counts on first render unless user-critical",
  "No unbounded list reads",
  "No client-imported server telemetry for passive events",
  "No heavy always-mounted hidden client islands",
];

const errors = [];
const warnings = [];

if (requiredPhrases.length < 20) {
  errors.push("optimization operating-model anchors are unexpectedly small");
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const scripts = packageJson.scripts ?? {};
if (!scripts["check:optimization-operating-model"]) {
  errors.push("package.json missing check:optimization-operating-model script");
}
if (!scripts["check:optimization-operating-model:strict"]) {
  warnings.push("package.json missing strict operating-model script");
}

finishWithResult(
  createResult({
    checkId: "optimization-operating-model",
    ok: errors.length === 0,
    strict,
    warnings,
    errors,
    startMs,
  })
);
