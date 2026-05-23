#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:audit-event-coverage"];
const REQUIRED_CI_COMMANDS = ["npm run check:audit-event-coverage"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:audit-event-coverage"'];
const REQUIRED_FILE_MARKERS = {
  "src/lib/v10-server-contracts.ts": [
    "import type { AuditAction }",
    "export async function recordV10AuditEvent",
    "export type V10AuditWriteMode",
    "action: AuditAction",
    "auditAction: AuditAction",
    "writeMode?: V10AuditWriteMode",
    "organization_id: input.organizationId",
    "actor_user_id: input.actorUserId",
    "actor_type: input.actorType ?? \"user\"",
    "action: input.action",
    "target_type: input.targetType",
    "target_id: input.targetId",
    "outcome: input.outcome",
    "request_id: input.clientRequestId",
    'audit_write_mode: input.writeMode ?? "best_effort"',
    "safe_metadata: safeMetadata",
    "sanitizeV10AuditMetadata",
    "FORBIDDEN_AUDIT_METADATA_KEY_RE",
    '{ ...input, writeMode: "blocking" }',
  ],
  "src/lib/v10-server-contracts.v10.test.ts": [
    "persists client request ids as support-safe audit metadata",
    "redacts unsafe audit metadata before V10 audit persistence",
    "decision_note_state: \"redacted\"",
  ],
  "src/lib/security/audit-write.ts": [
    "export type { SecurityAuditAction }",
    "recordSecurityAuditEvent",
    "recordSecurityAuditEventStrict",
    "recordV10AuditEventStrict",
  ],
  "src/lib/security/audit-actions.ts": [
    "export const API_AUDIT_ACTIONS",
    "export const SECURITY_AUDIT_ACTIONS",
    "export type AuditActionFamily",
    "export type AuditAction",
    "api.mutation_authorized",
    "security.integration_api_key_created",
    "security.integration_api_key_revoked",
    "security.session_signed_out",
    "security.step_up_password_verified",
    "security.dsr_self_export_downloaded",
    "security.dsr_account_delete_requested",
    "security.internal_debugging_sweep_success",
  ],
  "src/actions/workflow-config.ts": [
    "security.integration_api_key_created",
    "security.integration_api_key_revoked",
    "targetType: \"integration_api_key\"",
  ],
  "src/actions/auth.ts": [
    "security.session_signed_out",
    "targetType: \"auth_session\"",
  ],
  "src/app/api/settings/step-up/route.ts": [
    "security.step_up_password_verified",
    "targetType: \"user\"",
  ],
  "src/app/api/me/export/route.ts": [
    "recordSecurityAuditEventStrict",
    "security.dsr_self_export_downloaded",
    "self_export_audit_write_failed",
    "targetType: \"user\"",
  ],
  "src/app/api/me/account/route.ts": [
    "recordSecurityAuditEventStrict",
    "security.dsr_account_delete_requested",
    "account_delete_audit_write_failed",
    "targetType: \"user\"",
  ],
  "src/app/api/internal/debugging-sweep/route.ts": [
    "actorType: \"system\"",
    "security.internal_debugging_sweep_success",
  ],
  "src/app/api/export/contracts/route.ts": [
    "recordV10AuditEvent",
    "createContractExportJob",
    "export_job.completed",
    "auditEventId",
  ],
  "src/app/api/export/contracts/[jobId]/route.ts": [
    "recordV10AuditEvent",
    "export_job.retry_requested",
    "v10_export_retry_async_failed",
  ],
  "src/app/api/import/contracts/route.ts": [
    "recordV10AuditEvent",
    "import_job.created",
    "import_job.failed",
    "auditEventId",
  ],
  "src/app/api/import/contracts/[jobId]/route.ts": [
    "recordV10AuditEvent",
    "import_job.retry_created",
    "safeMetadata: { prior_job_id: jobId",
  ],
  "src/app/api/report-runs/[runId]/retry/route.ts": [
    "recordV10AuditEvent",
    "report_run.retry_requested",
    "safeMetadata",
  ],
  "src/lib/extraction/run-pipeline.ts": [
    ".from(\"audit_events\").insert({",
    "action: \"extraction.completed\"",
    "organization_id: resolvedOrganizationId",
    "contract_id: contractId",
  ],
  "src/app/api/stripe/webhook/route.ts": [
    ".from(\"stripe_webhook_events\")",
    ".insert({ id: event.id, status: \"processing\" });",
    "claimErr.code === \"23505\"",
    "stripe_webhook_invalid_signature",
    "stripe_webhook_missing_signature",
  ],
  "src/app/api/external-actions/create-link/route.ts": [
    "external_action_events",
    "external.link_created",
    "external_action",
  ],
  "src/app/api/external-actions/[token]/submit/route.ts": [
    "externalActionTokenMatches",
    "external_action_events",
    "external.submitted",
  ],
};

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

function collectMissingMarkers(content, markers) {
  return markers.filter((marker) => !content.includes(marker));
}

function walk(root, rel, out = []) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return out;
  for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git"].includes(ent.name)) continue;
    const childRel = path.join(rel, ent.name).replace(/\\/g, "/");
    if (ent.isDirectory()) walk(root, childRel, out);
    else if (/\.(ts|tsx)$/.test(ent.name) && !/\.(test|spec|v10\.test|v9\.test)\.(ts|tsx)$/.test(ent.name)) out.push(childRel);
  }
  return out;
}

function collectAuditActions(root) {
  return [
    ...new Set(
      walk(root, "src")
        .flatMap((rel) => {
          const raw = read(root, rel);
          return [
            ...[...raw.matchAll(/\baction:\s*"([^"]+)"/g)].map((match) => match[1]),
            ...[...raw.matchAll(/\bauditAction:\s*"([^"]+)"/g)].map((match) => match[1]),
          ];
        })
        .filter((action) => action.includes("."))
    ),
  ].sort((a, b) => a.localeCompare(b));
}

export function analyzeAuditEventCoverage(root = ROOT) {
  const issues = [];
  for (const rel of Object.keys(REQUIRED_FILE_MARKERS)) {
    if (!exists(root, rel)) issues.push({ issue: "missing_required_file", rel });
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
  for (const [rel, markers] of Object.entries(REQUIRED_FILE_MARKERS)) {
    if (!exists(root, rel)) continue;
    const content = read(root, rel);
    for (const marker of collectMissingMarkers(content, markers)) {
      issues.push({ issue: "missing_marker", rel, marker });
    }
  }

  const actions = collectAuditActions(root);
  const requiredFamilies = [
    { family: "role_or_capability", re: /^(member\.|security\.org_mfa_required_updated|workspace\.|settings\.)/ },
    { family: "auth_sensitive", re: /^security\.(session|mfa|step_up|sessions|dsr)/ },
    { family: "token", re: /^(security\.integration_api_key|external_action|external_link|evidence_request\.)/ },
    { family: "export", re: /^(export|export_job\.)/ },
    { family: "import", re: /^import_job\./ },
    { family: "report_retry", re: /^report_run\.retry_requested$/ },
    { family: "service_role", re: /^security\.internal_debugging_sweep_success$/ },
    { family: "extraction", re: /^extraction\.completed$/ },
  ];
  for (const family of requiredFamilies) {
    if (!actions.some((action) => family.re.test(action))) {
      issues.push({ issue: "missing_audit_action_family", family: family.family });
    }
  }

  return { checkId: "audit-event-coverage", ok: issues.length === 0, issueCount: issues.length, actionCount: actions.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeAuditEventCoverage();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
