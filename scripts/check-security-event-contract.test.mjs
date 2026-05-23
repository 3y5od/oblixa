import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeSecurityEventContract, extractSecurityAuditActions } from "./check-security-event-contract.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("extractSecurityAuditActions parses sorted security.* action literals", () => {
  assert.deepEqual(extractSecurityAuditActions('"security.b"\n"security.a"\n'), ["security.a", "security.b"]);
});

test("analyzeSecurityEventContract validates writer delegation and runtime callsites", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-security-event-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:security-event-contract": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:security-event-contract\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:security-event-contract"\n');
  write(
    root,
    "src/lib/security/audit-actions.ts",
    'export const API_AUDIT_ACTIONS = ["api.mutation_authorized"] as const;\nexport const SECURITY_AUDIT_ACTIONS = ["security.a", "security.b", "security.integration_api_key_created"] as const;\nexport type ApiAuditAction = (typeof API_AUDIT_ACTIONS)[number];\nexport type SecurityAuditAction = (typeof SECURITY_AUDIT_ACTIONS)[number];\nexport type AuditActionFamily = "workspace" | "export_job" | "report_run" | "evidence_request" | "automation" | "saved_view" | "member";\nexport type AuditAction = ApiAuditAction | SecurityAuditAction | `${AuditActionFamily}.${string}`;\n'
  );
  write(
    root,
    "src/lib/security/audit-write.ts",
    'import { recordV10AuditEvent, recordV10AuditEventStrict } from "x";\nexport type { SecurityAuditAction } from "@/lib/security/audit-actions";\nexport async function recordSecurityAuditEvent(){ return recordV10AuditEvent(); }\nexport async function recordSecurityAuditEventStrict(){ return recordV10AuditEventStrict(); }\n'
  );
  write(
    root,
    "src/lib/v10-server-contracts.ts",
    'import type { AuditAction } from "@/lib/security/audit-actions";\naction: AuditAction\nauditAction: AuditAction\nwriteMode?: V10AuditWriteMode\norganization_id: input.organizationId\nactor_user_id: input.actorUserId\naction: input.action\ntarget_type: input.targetType\ntarget_id: input.targetId\noutcome: input.outcome\nrequest_id: input.clientRequestId\naudit_write_mode: input.writeMode ?? "best_effort"\nsafe_metadata: safeMetadata\nsanitizeV10AuditMetadata({\n{ ...input, writeMode: "blocking" }\n'
  );
  write(
    root,
    "src/lib/v10-server-contracts.v10.test.ts",
    "persists client request ids as support-safe audit metadata\nredacts unsafe audit metadata before V10 audit persistence\n"
  );
  for (const rel of [
    "src/actions/auth.ts",
    "src/actions/mfa.ts",
    "src/actions/sessions.ts",
    "src/actions/workflow-config.ts",
    "src/app/api/me/export/route.ts",
    "src/app/api/me/account/route.ts",
    "src/app/api/internal/debugging-sweep/route.ts",
  ]) {
    write(
      root,
      rel,
      'import { recordSecurityAuditEvent } from "@/lib/security/audit-write";\nvoid recordSecurityAuditEvent(null as never, { action: "security.a" });\nvoid recordSecurityAuditEvent(null as never, { action: "security.b" });\nvoid recordSecurityAuditEvent(null as never, { action: "workspace.mode_updated" });\nvoid recordSecurityAuditEvent(null as never, { action: "export_job.completed" });\nvoid recordSecurityAuditEvent(null as never, { action: "report_run.created" });\nvoid recordSecurityAuditEvent(null as never, { action: "evidence_request.accepted" });\nvoid recordSecurityAuditEvent(null as never, { action: "automation.run_approved" });\nvoid recordSecurityAuditEvent(null as never, { action: "security.integration_api_key_created" });\nvoid recordSecurityAuditEvent(null as never, { action: "saved_view.deleted" });\n'
    );
  }
  write(root, "src/actions/settings.ts", 'safeInsertSettingsAuditEvent(null as never, { action: "member.invited" });\n');

  const report = analyzeSecurityEventContract(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
  assert.equal(report.actionCount, 3);
  assert.equal(report.runtimeAuditActionCount, 10);
});
