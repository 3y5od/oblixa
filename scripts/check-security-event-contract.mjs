#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const SECURITY_AUDIT_FILE = "src/lib/security/audit-write.ts";
const REQUIRED_CALLSITE_FILES = [
  "src/actions/auth.ts",
  "src/actions/mfa.ts",
  "src/actions/sessions.ts",
  "src/actions/workflow-config.ts",
  "src/app/api/me/export/route.ts",
  "src/app/api/me/account/route.ts",
  "src/app/api/internal/debugging-sweep/route.ts",
];
const REQUIRED_PACKAGE_SCRIPTS = ["check:security-event-contract"];
const REQUIRED_CI_COMMANDS = ["npm run check:security-event-contract"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:security-event-contract"'];
const SOURCE_FILE_RE = /\.(ts|tsx)$/;
const TEST_FILE_RE = /\.(test|spec|v10\.test)\.(ts|tsx)$/;

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    const st = fs.statSync(abs);
    if (st.isDirectory()) walk(abs, acc);
    else acc.push(abs);
  }
  return acc;
}

function isRuntimeSource(abs) {
  return SOURCE_FILE_RE.test(abs) && !TEST_FILE_RE.test(abs);
}

export function extractSecurityAuditActions(raw) {
  return [...new Set([...raw.matchAll(/"(security\.[^"]+)"/g)].map((match) => match[1]).sort((a, b) => a.localeCompare(b)))];
}

export function analyzeSecurityEventContract(root = ROOT) {
  const issues = [];
  if (!fs.existsSync(path.join(root, SECURITY_AUDIT_FILE))) {
    return { checkId: "security-event-contract", ok: false, issueCount: 1, issues: [{ issue: "missing_required_file", rel: SECURITY_AUDIT_FILE }] };
  }

  const auditWrite = read(root, SECURITY_AUDIT_FILE);
  if (!auditWrite.includes("export async function recordSecurityAuditEvent")) {
    issues.push({ issue: "missing_security_audit_writer_export" });
  }
  if (!auditWrite.includes("recordV10AuditEvent")) {
    issues.push({ issue: "missing_v10_audit_delegate" });
  }

  const actions = extractSecurityAuditActions(auditWrite);
  if (actions.length === 0) {
    issues.push({ issue: "missing_security_audit_actions" });
  }
  for (const action of actions) {
    if (!action.startsWith("security.")) issues.push({ issue: "unnamespaced_security_action", action });
  }

  const runtimeFiles = walk(path.join(root, "src"))
    .filter(isRuntimeSource)
    .map((abs) => ({ rel: path.relative(root, abs).replace(/\\/g, "/"), raw: fs.readFileSync(abs, "utf8") }));
  const importers = runtimeFiles.filter((row) => row.raw.includes('recordSecurityAuditEvent') && row.rel !== SECURITY_AUDIT_FILE).map((row) => row.rel);
  for (const rel of REQUIRED_CALLSITE_FILES) {
    if (!importers.includes(rel)) issues.push({ issue: "missing_required_security_audit_callsite", rel });
  }
  if (importers.length < REQUIRED_CALLSITE_FILES.length) {
    issues.push({ issue: "too_few_security_audit_importers", importCount: importers.length });
  }

  for (const action of actions) {
    const found = runtimeFiles.some((row) => row.rel !== SECURITY_AUDIT_FILE && row.raw.includes(`action: "${action}"`));
    if (!found) issues.push({ issue: "security_action_missing_runtime_callsite", action });
  }

  const pkg = JSON.parse(read(root, "package.json"));
  for (const script of REQUIRED_PACKAGE_SCRIPTS) {
    if (!pkg.scripts?.[script]) issues.push({ issue: "missing_package_script", script });
  }

  const ci = read(root, ".github/workflows/ci.yml");
  for (const cmd of REQUIRED_CI_COMMANDS) {
    if (!ci.includes(cmd)) issues.push({ issue: "missing_ci_reference", cmd });
  }

  const securityPipeline = read(root, "scripts/pipelines/pipeline-security-comprehensive.mjs");
  for (const step of REQUIRED_SECURITY_PIPELINE_STEPS) {
    if (!securityPipeline.includes(step)) issues.push({ issue: "missing_security_pipeline_step", step: step.replaceAll('"', "") });
  }

  return {
    checkId: "security-event-contract",
    ok: issues.length === 0,
    issueCount: issues.length,
    actionCount: actions.length,
    importerCount: importers.length,
    issues,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeSecurityEventContract();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
