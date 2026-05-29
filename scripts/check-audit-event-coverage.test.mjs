import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeAuditEventCoverage } from "./check-audit-event-coverage.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function writeValidFixture(root) {
  write(root, "package.json", JSON.stringify({ scripts: { "check:audit-event-coverage": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:audit-event-coverage\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:audit-event-coverage"\n');
  write(root, "src/lib/server-contracts.ts", 'import type { AuditAction } from "@/lib/security/audit-actions";\nexport type V10AuditWriteMode = "best_effort" | "blocking";\nexport async function recordV10AuditEvent(){}\naction: AuditAction\nauditAction: AuditAction\nwriteMode?: V10AuditWriteMode\norganization_id: input.organizationId\nactor_user_id: input.actorUserId\nactor_type: input.actorType ?? "user"\naction: input.action\ntarget_type: input.targetType\ntarget_id: input.targetId\noutcome: input.outcome\nrequest_id: input.clientRequestId\naudit_write_mode: input.writeMode ?? "best_effort"\nsafe_metadata: safeMetadata\nsanitizeV10AuditMetadata\nFORBIDDEN_AUDIT_METADATA_KEY_RE\n{ ...input, writeMode: "blocking" }\n');
  write(root, "src/lib/server-contracts.test.ts", 'persists client request ids as support-safe audit metadata\nredacts unsafe audit metadata before V10 audit persistence\ndecision_note_state: "redacted"\n');
  write(root, "src/lib/security/audit-write.ts", 'export type { SecurityAuditAction } from "@/lib/security/audit-actions";\nrecordV10AuditEventStrict\nexport function recordSecurityAuditEvent(){}\nexport function recordSecurityAuditEventStrict(){}\n');
  write(root, "src/lib/security/audit-actions.ts", 'export const API_AUDIT_ACTIONS = ["api.mutation_authorized"] as const;\nexport const SECURITY_AUDIT_ACTIONS = ["security.integration_api_key_created", "security.integration_api_key_revoked", "security.session_signed_out", "security.step_up_password_verified", "security.dsr_self_export_downloaded", "security.dsr_account_delete_requested", "security.internal_debugging_sweep_success"] as const;\nexport type AuditActionFamily = "member";\nexport type AuditAction = "api.mutation_authorized" | "security.dsr_account_delete_requested";\n');
  write(root, "src/lib/security/audit-event-policy.ts", "SENSITIVE_AUDIT_EVENT_POLICIES\nAUDIT_APPEND_ONLY_TABLES\nauditPolicyForAction\nvalidateAuditEventShape\nauditEventPolicyCoverageIssues\ndatabase_default_now\nsafe_metadata_only\nappendOnly\n");
  write(root, "src/lib/security/audit-event-policy.test.ts", "covers sensitive action families with append-only policies\naccepts sanitized, organization-scoped audit events\nrejects missing actor, disallowed target, mutable timestamps, and unsafe metadata\n");
  write(root, "src/lib/security/audit-hash-chain.ts", "AUDIT_HASH_CHAIN_ENABLED_ENV\nAUDIT_HASH_CHAIN_DISABLED_BY_DEFAULT\nisAuditHashChainEnabled\ncanonicalAuditChainPayload\nbuildAuditHashChain\nexternalSideEffects: false\n");
  write(root, "src/lib/security/audit-hash-chain.test.ts", "is disabled unless explicitly adopted\nbuilds deterministic local-only hash-chain links\nchanges event hashes when event content is tampered\n");
  write(root, "src/lib/security/data-lifecycle.ts", 'privacy_request.organization_delete_requested\nprivacy_request.upload_delete_requested\nprivacy_request.report_delete_requested\npreserve_append_only\nauditAction: "privacy_request.organization_delete_requested"\n');
  write(root, "src/actions/workflow-config.ts", 'recordSecurityAuditEvent({ action: "security.integration_api_key_created", targetType: "integration_api_key" });\nrecordSecurityAuditEvent({ action: "security.integration_api_key_revoked", targetType: "integration_api_key" });\n');
  write(root, "src/actions/auth.ts", 'recordSecurityAuditEvent({ action: "security.session_signed_out", targetType: "auth_session" });\n');
  write(root, "src/app/api/settings/step-up/route.ts", 'recordSecurityAuditEvent({ action: "security.step_up_password_verified", targetType: "user" });\n');
  write(root, "src/app/api/me/export/route.ts", 'recordSecurityAuditEventStrict({ action: "security.dsr_self_export_downloaded", targetType: "user" });\nself_export_audit_write_failed\n');
  write(root, "src/app/api/me/account/route.ts", 'recordSecurityAuditEventStrict({ action: "security.dsr_account_delete_requested", targetType: "user" });\naccount_delete_audit_write_failed\n');
  write(root, "src/app/api/internal/debugging-sweep/route.ts", 'recordSecurityAuditEvent({ actorType: "system", action: "security.internal_debugging_sweep_success" });\n');
  write(root, "src/app/api/export/contracts/route.ts", 'recordV10AuditEvent({ action: "export_job.completed" });\ncreateContractExportJob\nauditEventId\n');
  write(root, "src/app/api/export/contracts/[jobId]/route.ts", 'recordV10AuditEvent({ action: "export_job.retry_requested" });\nv10_export_retry_async_failed\n');
  write(root, "src/app/api/import/contracts/route.ts", 'recordV10AuditEvent({ action: "import_job.created" });\nrecordV10AuditEvent({ action: "import_job.failed" });\nauditEventId\n');
  write(root, "src/app/api/import/contracts/[jobId]/route.ts", 'recordV10AuditEvent({ action: "import_job.retry_created" });\nsafeMetadata: { prior_job_id: jobId\n');
  write(root, "src/app/api/report-runs/[runId]/retry/route.ts", 'recordV10AuditEvent({ action: "report_run.retry_requested", safeMetadata: {} });\n');
  write(root, "src/lib/extraction/run-pipeline.ts", '.from("audit_events").insert({\naction: "extraction.completed"\norganization_id: resolvedOrganizationId\ncontract_id: contractId\n});\n');
  write(root, "src/app/api/stripe/webhook/route.ts", '.from("stripe_webhook_events")\n.insert({ id: event.id, status: "processing" });\nclaimErr.code === "23505"\nstripe_webhook_invalid_signature\nstripe_webhook_missing_signature\n');
  write(root, "src/app/api/external-actions/create-link/route.ts", 'external_action_events\nexternal.link_created\nexternal_action\n');
  write(root, "src/app/api/external-actions/[token]/submit/route.ts", 'externalActionTokenMatches\nexternal_action_events\nexternal.submitted\n');
  write(root, "src/actions/members.ts", 'recordV10AuditEvent({ action: "member.role_changed" });\n');
}

test("analyzeAuditEventCoverage accepts required audit shape, actions, and call sites", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-audit-event-ok-"));
  writeValidFixture(root);
  const report = analyzeAuditEventCoverage(root);
  assert.equal(report.ok, true, JSON.stringify(report.issues, null, 2));
  assert.equal(report.issueCount, 0);
});

test("analyzeAuditEventCoverage rejects missing audit markers and action families", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-audit-event-bad-"));
  writeValidFixture(root);
  write(root, "src/actions/members.ts", "");
  write(root, "src/app/api/stripe/webhook/route.ts", '.from("stripe_webhook_events")\n');
  const report = analyzeAuditEventCoverage(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "missing_audit_action_family" && issue.family === "role_or_capability"));
  assert(report.issues.some((issue) => issue.issue === "missing_marker" && issue.rel === "src/app/api/stripe/webhook/route.ts"));
});
