#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();

const REQUIRED_MARKERS = {
  "src/lib/security/sensitive-action-proof.ts": [
    "export async function hasSensitiveActionProof",
    "isStepUpCookieValidForUser(jar, userId)",
    "getAuthenticatorAssuranceLevel",
    'data?.currentLevel === "aal2"',
  ],
  "src/lib/security/sensitive-action-proof.test.ts": [
    'it("accepts a valid step-up cookie before checking AAL"',
    'it("accepts current AAL2 when the step-up cookie is absent"',
    'it("fails closed when neither proof is available"',
  ],
  "src/actions/mfa.ts": [
    'safeMetadata: { reason: "sensitive_action_proof_required" }',
    "needStepUp: true as const",
    "before removing an authenticator factor",
    "before changing the organization MFA policy",
  ],
  "src/actions/sessions.ts": [
    "hasSensitiveActionProof(supabase, user.id)",
    "before revoking other sessions",
    'action: "security.sessions_revoke_others"',
    'outcome: "forbidden"',
  ],
  "src/actions/workflow-config.ts": [
    "hasSensitiveActionProof(supabase, user.id)",
    "before updating integration tokens",
    "before creating API keys",
    "before revoking API keys",
    "before updating API key policy",
    "before disconnecting integrations",
    "security.integration_token_updated",
    "security.integration_api_key_policy_updated",
    "security.integration_disconnected",
  ],
  "src/app/api/integrations/oauth/start/route.ts": [
    "hasSensitiveActionProof(supabase, user.id)",
    "security.integration_oauth_start_blocked",
    'diagnostic_id: "oauth_start_step_up_required"',
    'details: { needStepUp: true }',
  ],
  "src/actions/maintenance.ts": [
    "requireMaintenanceSensitiveActionProof(supabase, admin",
    "security.maintenance_destructive_action_blocked",
    'maintenanceAction: "archive_contract_as_duplicate"',
    'maintenanceAction: "delete_orphan_file_record"',
    'maintenanceAction: "run_date_backfill_campaign"',
    'maintenanceAction: "run_correction_campaign"',
    'maintenanceAction: "process_contract_change_events"',
    "needStepUp: true as const",
  ],
  "src/app/api/me/account/route.ts": [
    "hasSensitiveActionProof(supabase, user.id)",
    'diagnostic_id: "account_delete_step_up_required"',
    'safeMetadata: { reason: "sensitive_action_proof_required" }',
    'scope: "account.delete.request"',
  ],
  "src/app/api/maintenance/campaigns/[id]/run/route.ts": [
    "hasSensitiveActionProof(supabase, ctx.userId)",
    "security.maintenance_destructive_action_blocked",
    'maintenance_action: "run_maintenance_campaign"',
    'diagnostic_id: "maintenance_campaign_run_step_up_required"',
  ],
  "src/app/api/maintenance/campaigns/[id]/rollback/route.ts": [
    "hasSensitiveActionProof(supabase, ctx.userId)",
    "security.maintenance_destructive_action_blocked",
    'maintenance_action: "rollback_maintenance_campaign"',
    'diagnostic_id: "maintenance_campaign_rollback_step_up_required"',
  ],
  "src/lib/security/audit-actions.ts": [
    "security.integration_token_updated",
    "security.integration_api_key_policy_updated",
    "security.integration_disconnected",
    "security.integration_oauth_start_blocked",
    "security.sessions_revoke_others",
    "security.maintenance_destructive_action_blocked",
  ],
  "src/actions/mfa.test.ts": [
    'it("unenrollTotpFactor requires step-up or AAL2 before removing a factor"',
    'outcome: "forbidden"',
  ],
  "src/actions/sessions.test.ts": [
    'it("revokeOtherSessions requires step-up or AAL2 before sign-out"',
    'outcome: "forbidden"',
  ],
  "src/app/api/settings/step-up/route.ts": [
    'rateLimitCheck(`step-up:${user.id}:${ip}`, RATE_LIMITS.stepUpPassword)',
    'recordStepUpPasswordAudit(user.id, "failure"',
    'reason: "password_verification_failed"',
  ],
  "src/app/api/settings/step-up/route.test.ts": [
    'it("rate limits authenticated step-up attempts by user and IP before password verification"',
    'it("audits failed password step-up attempts without storing password material"',
  ],
  "src/app/api/me/account/route.test.ts": [
    'it("requires step-up or AAL2 before recording account deletion requests"',
    'it("accepts sensitive-action proof before recording account deletion requests"',
  ],
  "src/app/api/integrations/oauth/start/route.test.ts": [
    'it("requires shared step-up or AAL2 proof before creating oauth state"',
    "security.integration_oauth_start_blocked",
  ],
  "src/actions/maintenance-scope.test.ts": [
    'it("requires step-up or AAL2 before deleting orphan file records"',
    'it("requires step-up or AAL2 before running bulk correction campaigns"',
  ],
  "src/app/api/maintenance/campaigns/[id]/run/route.test.ts": [
    'it("requires step-up or AAL2 before running maintenance campaigns"',
  ],
  "src/app/api/maintenance/campaigns/[id]/rollback/route.test.ts": [
    'it("requires step-up or AAL2 before rolling back maintenance campaigns"',
  ],
  "package.json": ['"check:sensitive-action-step-up"'],
  "scripts/pipelines/pipeline-security-comprehensive.mjs": ['"check:sensitive-action-step-up"'],
};

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

export function analyzeSensitiveActionStepUp(root = ROOT) {
  const issues = [];
  for (const [rel, markers] of Object.entries(REQUIRED_MARKERS)) {
    if (!exists(root, rel)) {
      issues.push({ issue: "missing_required_file", rel });
      continue;
    }
    const source = read(root, rel);
    for (const marker of markers) {
      if (!source.includes(marker)) issues.push({ issue: "missing_marker", rel, marker });
    }
  }
  return { checkId: "sensitive-action-step-up", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeSensitiveActionStepUp();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
