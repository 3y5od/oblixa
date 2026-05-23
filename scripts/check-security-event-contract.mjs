#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const SECURITY_AUDIT_FILE = "src/lib/security/audit-write.ts";
const AUDIT_ACTIONS_FILE = "src/lib/security/audit-actions.ts";
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
const REQUIRED_AUDIT_ACTION_FAMILIES = [
  { family: "settings", actionRe: /^(workspace|settings|security\.org_mfa_required_updated\b)/ },
  { family: "role_membership", actionRe: /^member\./ },
  { family: "exports", actionRe: /^(export|security\.dsr_self_export)/ },
  { family: "reports", actionRe: /^(report|report_pack)/ },
  { family: "evidence", actionRe: /^evidence/ },
  { family: "automation", actionRe: /^(automation|advanced\.automation|approval\.)/ },
  { family: "integrations", actionRe: /^security\.integration/ },
  { family: "destructive", actionRe: /(deleted|revoked|delete_requested|account_delete|teardown)/ },
];
const REQUIRED_AUDIT_STORAGE_MARKERS = {
  "src/lib/v10-server-contracts.ts": [
    "import type { AuditAction }",
    "action: AuditAction",
    "auditAction: AuditAction",
    "writeMode?: V10AuditWriteMode",
    "organization_id: input.organizationId",
    "actor_user_id: input.actorUserId",
    "action: input.action",
    "target_type: input.targetType",
    "target_id: input.targetId",
    "outcome: input.outcome",
    "request_id: input.clientRequestId",
    'audit_write_mode: input.writeMode ?? "best_effort"',
    "safe_metadata: safeMetadata",
    "sanitizeV10AuditMetadata({",
    '{ ...input, writeMode: "blocking" }',
  ],
  "src/lib/v10-server-contracts.v10.test.ts": [
    "persists client request ids as support-safe audit metadata",
    "redacts unsafe audit metadata before V10 audit persistence",
  ],
};
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
  if (!fs.existsSync(path.join(root, AUDIT_ACTIONS_FILE))) {
    return { checkId: "security-event-contract", ok: false, issueCount: 1, issues: [{ issue: "missing_required_file", rel: AUDIT_ACTIONS_FILE }] };
  }

  const auditWrite = read(root, SECURITY_AUDIT_FILE);
  const auditActions = read(root, AUDIT_ACTIONS_FILE);
  if (!auditWrite.includes("export async function recordSecurityAuditEvent")) {
    issues.push({ issue: "missing_security_audit_writer_export" });
  }
  if (!auditWrite.includes("export async function recordSecurityAuditEventStrict")) {
    issues.push({ issue: "missing_strict_security_audit_writer_export" });
  }
  if (!auditWrite.includes("recordV10AuditEvent")) {
    issues.push({ issue: "missing_v10_audit_delegate" });
  }
  if (!auditWrite.includes("recordV10AuditEventStrict")) {
    issues.push({ issue: "missing_v10_strict_audit_delegate" });
  }
  for (const marker of [
    "export const API_AUDIT_ACTIONS",
    "export const SECURITY_AUDIT_ACTIONS",
    "export type ApiAuditAction",
    "export type SecurityAuditAction",
    "export type AuditActionFamily",
    "export type AuditAction",
  ]) {
    if (!auditActions.includes(marker)) issues.push({ issue: "missing_audit_action_taxonomy_marker", marker });
  }

  const actions = extractSecurityAuditActions(auditActions);
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
  const runtimeAuditActions = [
    ...new Set(
      runtimeFiles
        .filter((row) => /recordV10AuditEvent|recordSecurityAuditEvent|executeV10(?:Audited|Standard)Mutation|safeInsertSettingsAuditEvent|audit_events/.test(row.raw))
        .flatMap((row) => [
          ...[...row.raw.matchAll(/\baction:\s*"([^"]+)"/g)].map((match) => match[1]),
          ...[...row.raw.matchAll(/\bauditAction:\s*"([^"]+)"/g)].map((match) => match[1]),
        ])
    ),
  ].sort((a, b) => a.localeCompare(b));
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

  for (const family of REQUIRED_AUDIT_ACTION_FAMILIES) {
    if (!runtimeAuditActions.some((action) => family.actionRe.test(action))) {
      issues.push({ issue: "missing_audit_action_family", family: family.family });
    }
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

  for (const [rel, markers] of Object.entries(REQUIRED_AUDIT_STORAGE_MARKERS)) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) {
      issues.push({ issue: "missing_required_file", rel });
      continue;
    }
    const content = read(root, rel);
    for (const marker of markers) {
      if (!content.includes(marker)) issues.push({ issue: "missing_audit_storage_marker", rel, marker });
    }
  }

  return {
    checkId: "security-event-contract",
    ok: issues.length === 0,
    issueCount: issues.length,
    actionCount: actions.length,
    runtimeAuditActionCount: runtimeAuditActions.length,
    importerCount: importers.length,
    issues,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeSecurityEventContract();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
