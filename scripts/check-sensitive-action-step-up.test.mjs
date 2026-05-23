import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeSensitiveActionStepUp } from "./check-sensitive-action-step-up.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzeSensitiveActionStepUp validates step-up and audit markers", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-sensitive-step-up-"));
  write(
    root,
    "src/lib/security/sensitive-action-proof.ts",
    'export async function hasSensitiveActionProof\nisStepUpCookieValidForUser(jar, userId)\ngetAuthenticatorAssuranceLevel\ndata?.currentLevel === "aal2"\n'
  );
  write(
    root,
    "src/lib/security/sensitive-action-proof.test.ts",
    'it("accepts a valid step-up cookie before checking AAL", () => {})\nit("accepts current AAL2 when the step-up cookie is absent", () => {})\nit("fails closed when neither proof is available", () => {})\n'
  );
  write(
    root,
    "src/actions/mfa.ts",
    'safeMetadata: { reason: "sensitive_action_proof_required" }\nneedStepUp: true as const\nbefore removing an authenticator factor\nbefore changing the organization MFA policy\n'
  );
  write(
    root,
    "src/actions/sessions.ts",
    'hasSensitiveActionProof(supabase, user.id)\nbefore revoking other sessions\naction: "security.sessions_revoke_others"\noutcome: "forbidden"\n'
  );
  write(
    root,
    "src/actions/workflow-config.ts",
    "hasSensitiveActionProof(supabase, user.id)\nbefore updating integration tokens\nbefore creating API keys\nbefore revoking API keys\nbefore updating API key policy\nsecurity.integration_token_updated\nsecurity.integration_api_key_policy_updated\n"
  );
  write(
    root,
    "src/app/api/integrations/oauth/start/route.ts",
    'hasSensitiveActionProof(supabase, user.id)\nsecurity.integration_oauth_start_blocked\ndiagnostic_id: "oauth_start_step_up_required"\ndetails: { needStepUp: true }\n'
  );
  write(
    root,
    "src/actions/maintenance.ts",
    'requireMaintenanceSensitiveActionProof(supabase, admin\nsecurity.maintenance_destructive_action_blocked\nmaintenanceAction: "archive_contract_as_duplicate"\nmaintenanceAction: "delete_orphan_file_record"\nmaintenanceAction: "run_date_backfill_campaign"\nmaintenanceAction: "run_correction_campaign"\nmaintenanceAction: "process_contract_change_events"\nneedStepUp: true as const\n'
  );
  write(
    root,
    "src/app/api/me/account/route.ts",
    'hasSensitiveActionProof(supabase, user.id)\ndiagnostic_id: "account_delete_step_up_required"\nsafeMetadata: { reason: "sensitive_action_proof_required" }\nscope: "account.delete.request"\n'
  );
  write(
    root,
    "src/app/api/maintenance/campaigns/[id]/run/route.ts",
    'hasSensitiveActionProof(supabase, ctx.userId)\nsecurity.maintenance_destructive_action_blocked\nmaintenance_action: "run_maintenance_campaign"\ndiagnostic_id: "maintenance_campaign_run_step_up_required"\n'
  );
  write(
    root,
    "src/app/api/maintenance/campaigns/[id]/rollback/route.ts",
    'hasSensitiveActionProof(supabase, ctx.userId)\nsecurity.maintenance_destructive_action_blocked\nmaintenance_action: "rollback_maintenance_campaign"\ndiagnostic_id: "maintenance_campaign_rollback_step_up_required"\n'
  );
  write(
    root,
    "src/lib/security/audit-actions.ts",
    "security.integration_token_updated\nsecurity.integration_api_key_policy_updated\nsecurity.integration_oauth_start_blocked\nsecurity.sessions_revoke_others\nsecurity.maintenance_destructive_action_blocked\n"
  );
  write(
    root,
    "src/actions/mfa.test.ts",
    'it("unenrollTotpFactor requires step-up or AAL2 before removing a factor", () => {})\noutcome: "forbidden"\n'
  );
  write(
    root,
    "src/actions/sessions.test.ts",
    'it("revokeOtherSessions requires step-up or AAL2 before sign-out", () => {})\noutcome: "forbidden"\n'
  );
  write(
    root,
    "src/app/api/settings/step-up/route.ts",
    'rateLimitCheck(`step-up:${user.id}:${ip}`, RATE_LIMITS.stepUpPassword)\nrecordStepUpPasswordAudit(user.id, "failure"\nreason: "password_verification_failed"\n'
  );
  write(
    root,
    "src/app/api/settings/step-up/route.test.ts",
    'it("rate limits authenticated step-up attempts by user and IP before password verification", () => {})\nit("audits failed password step-up attempts without storing password material", () => {})\n'
  );
  write(
    root,
    "src/app/api/me/account/route.test.ts",
    'it("requires step-up or AAL2 before recording account deletion requests", () => {})\nit("accepts sensitive-action proof before recording account deletion requests", () => {})\n'
  );
  write(
    root,
    "src/app/api/integrations/oauth/start/route.test.ts",
    'it("requires shared step-up or AAL2 proof before creating oauth state", () => {})\nsecurity.integration_oauth_start_blocked\n'
  );
  write(
    root,
    "src/actions/maintenance-scope.test.ts",
    'it("requires step-up or AAL2 before deleting orphan file records", () => {})\nit("requires step-up or AAL2 before running bulk correction campaigns", () => {})\n'
  );
  write(
    root,
    "src/app/api/maintenance/campaigns/[id]/run/route.test.ts",
    'it("requires step-up or AAL2 before running maintenance campaigns", () => {})\n'
  );
  write(
    root,
    "src/app/api/maintenance/campaigns/[id]/rollback/route.test.ts",
    'it("requires step-up or AAL2 before rolling back maintenance campaigns", () => {})\n'
  );
  write(root, "package.json", '{"scripts":{"check:sensitive-action-step-up":"node scripts/check-sensitive-action-step-up.mjs"}}\n');
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:sensitive-action-step-up"\n');

  const report = analyzeSensitiveActionStepUp(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});
