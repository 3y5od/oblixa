#!/usr/bin/env node
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { createResult, finishWithResult } from "./lib/result.mjs";
import { nowMs } from "./lib/timing.mjs";

const ROOT = process.cwd();
const startMs = nowMs();
const strict = process.argv.includes("--strict");
const validateOutputs = process.argv.includes("--validate-outputs") || strict;
const requiredScripts = [
  { path: "scripts/cron-canary.mjs", validateJson: false, requiredKeys: [] },
  { path: "scripts/comprehensive-pass.mjs", validateJson: false, requiredKeys: [] },
  { path: "scripts/release-preflight.mjs", validateJson: false, requiredKeys: [] },
  {
    path: "scripts/report-playwright-stability.mjs",
    validateJson: true,
    requiredKeys: [],
  },
];
const checks = requiredScripts.map((entry) => ({
  path: entry.path,
  exists: existsSync(path.join(ROOT, entry.path)),
  validateJson: entry.validateJson,
  requiredKeys: entry.requiredKeys,
  outputValid: !entry.validateJson,
  outputError: "",
  missingRequiredKeys: [],
}));

const envKeys = ["CRON_SECRET", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"];
const envPresence = envKeys.map((key) => ({ key, present: Boolean(process.env[key]?.trim()) }));
const requireEnv = process.argv.includes("--require-env");
const enforceEnvInStrictMode = strict && (requireEnv || envPresence.some((entry) => entry.present));

if (validateOutputs) {
  for (const check of checks) {
    if (!check.exists || !check.validateJson) continue;
    try {
      const raw = execFileSync("node", [path.join(ROOT, check.path)], {
        cwd: ROOT,
        encoding: "utf8",
        timeout: 60000,
      });
      const parsed = JSON.parse(raw);
      if (typeof parsed !== "object" || parsed === null) {
        check.outputValid = false;
        check.outputError = "output_not_json_object";
        continue;
      }
      check.missingRequiredKeys = check.requiredKeys.filter((k) => !(k in parsed));
      check.outputValid = check.missingRequiredKeys.length === 0;
      if (!check.outputValid) check.outputError = "missing_required_keys";
    } catch (error) {
      check.outputValid = false;
      check.outputError = error instanceof Error ? error.message.slice(0, 180) : String(error).slice(0, 180);
    }
  }
}

const missingScriptCount = checks.filter((c) => !c.exists).length;
const missingEnvCount = envPresence.filter((e) => !e.present).length;
const invalidOutputCount = checks.filter((c) => c.validateJson && !c.outputValid).length;
const errors = [];
if (missingScriptCount > 0) errors.push(`missing scripts: ${missingScriptCount}`);
if (enforceEnvInStrictMode && missingEnvCount > 0) errors.push(`missing env vars: ${missingEnvCount}`);
if (validateOutputs && invalidOutputCount > 0) errors.push(`invalid json outputs: ${invalidOutputCount}`);
finishWithResult(
  createResult({
    checkId: "incident-readiness",
    ok: errors.length === 0,
    strict,
    errors,
    meta: {
      requireEnv,
      validateOutputs,
      enforceEnvInStrictMode,
      missingScriptCount,
      missingEnvCount,
      invalidOutputCount,
      checks,
      envPresence,
    },
    startMs,
  })
);
