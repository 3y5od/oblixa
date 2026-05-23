#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { SECURITY_COMPREHENSIVE_STEPS } from "./pipelines/pipeline-security-comprehensive.mjs";
import { REQUIRED_SECURITY_CHECK_SCRIPTS } from "./check-required-security-checkset.mjs";
import { issueReport, readJson } from "./lib/static-check-utils.mjs";

const DETERMINISTIC_STATIC_CHECKS = new Set([
  "check:npm-script-integrity",
  "check:test-fixture-secrets",
  "check:security-fallback-paths",
  "check:timeout-budget-guards",
  "check:pagination-guardrails",
  "check:next-public-surface",
  "check:circuit-breaker-policy",
  "check:stream-payload-sensitivity",
  "check:concurrency-cap-guards",
  "check:generated-artifact-hygiene",
  "check:documentation-runtime-dependencies",
  "check:static-check-determinism",
]);

function normalizeStep(step) {
  return typeof step === "string" ? { script: step, required: true } : { required: step.required !== false, script: step.script };
}

function scriptFileFromCommand(command) {
  const match = /^\s*node\s+(scripts\/[^\s'"&|;]+\.mjs)\b/.exec(command);
  return match?.[1] ?? null;
}

function commandForScript(pkg, script) {
  return typeof pkg.scripts?.[script] === "string" ? pkg.scripts[script] : null;
}

function resolveNodeScriptFiles(pkg, script, seen = new Set()) {
  if (seen.has(script)) return [];
  seen.add(script);
  const command = commandForScript(pkg, script);
  if (!command) return [];

  const direct = scriptFileFromCommand(command);
  if (direct) return [direct];

  const npmRun = /^\s*npm\s+run\s+([^\s&|;]+)/.exec(command);
  if (npmRun) return resolveNodeScriptFiles(pkg, npmRun[1], seen);

  return [];
}

export function analyzeStaticCheckDeterminism(root = process.cwd(), options = {}) {
  const pkg = readJson(root, "package.json");
  const issues = [];
  const requiredScripts = options.requiredScripts ?? REQUIRED_SECURITY_CHECK_SCRIPTS;
  const securitySteps = options.securitySteps ?? SECURITY_COMPREHENSIVE_STEPS;
  const blockingScripts = new Set(requiredScripts);

  for (const step of securitySteps.map(normalizeStep)) {
    if (step.script.startsWith("report:") && step.required) {
      issues.push({ issue: "informational_report_is_blocking", script: step.script, file: "scripts/pipelines/pipeline-security-comprehensive.mjs" });
    }
    if (step.required && step.script.startsWith("check:")) blockingScripts.add(step.script);
  }

  for (const script of [...blockingScripts].sort()) {
    for (const rel of resolveNodeScriptFiles(pkg, script)) {
      const abs = path.join(root, rel);
      if (!fs.existsSync(abs)) {
        issues.push({ issue: "blocking_check_missing_script_file", script, file: rel });
        continue;
      }
      const text = fs.readFileSync(abs, "utf8");
      if (/import\s+\{[^}]*\brunGenericSecurityCheck\b[^}]*\}\s+from|runGenericSecurityCheck\s*\(\s*import\.meta\.url\s*\)/.test(text)) {
        issues.push({ issue: "generic_signal_check_in_blocking_security_step", script, file: rel });
      }
      if (DETERMINISTIC_STATIC_CHECKS.has(script) && !(/issueReport\s*\(/.test(text) || (/checkId/.test(text) && /issueCount/.test(text) && /issues/.test(text)))) {
        issues.push({ issue: "blocking_check_missing_structured_issue_report", script, file: rel });
      }
    }
  }

  return issueReport("static-check-determinism", issues, { blockingScriptsChecked: blockingScripts.size });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeStaticCheckDeterminism();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
