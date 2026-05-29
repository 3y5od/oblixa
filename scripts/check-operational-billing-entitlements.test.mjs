import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildOperationalBillingEntitlementsReport,
} from "./check-operational-billing-entitlements.mjs";

function write(root, rel, text) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
}

function packageJson() {
  const scripts = Object.fromEntries(
    [
      "check:operational-billing-entitlements",
      "test:operational-billing-entitlements",
      "test:vitest:current-product",
      "check:release-security-required-env",
      "check:provider-integration-fixtures",
      "check:audit-event-coverage",
      "check:idempotency-policy",
      "check:pci-cde-drift",
      "check:pan-in-client-bundle",
    ].map((script) => [script, "true"])
  );
  return JSON.stringify({ scripts }, null, 2);
}

const config = {
  schemaVersion: 1,
  source: "test",
  objectives: [
    {
      id: "entitlement-gate-inventory",
      commands: [
        { command: "check:operational-billing-entitlements", ciRequired: true },
        { command: "test:operational-billing-entitlements", ciRequired: false },
        { command: "test:vitest:current-product", ciRequired: false },
      ],
      artifacts: ["artifacts/operational-billing-entitlements.json"],
    },
    {
      id: "billing-state-transitions",
      commands: [
        { command: "check:operational-billing-entitlements", ciRequired: true },
        { command: "check:release-security-required-env", ciRequired: true },
        { command: "check:provider-integration-fixtures", ciRequired: true },
      ],
    },
    {
      id: "seat-and-invite-limits",
      commands: [
        { command: "check:operational-billing-entitlements", ciRequired: true },
        { command: "check:audit-event-coverage", ciRequired: true },
      ],
    },
    {
      id: "revenue-impact-safeguards",
      commands: [
        { command: "check:operational-billing-entitlements", ciRequired: true },
        { command: "check:idempotency-policy", ciRequired: true },
        { command: "check:audit-event-coverage", ciRequired: true },
        { command: "check:provider-integration-fixtures", ciRequired: true },
        { command: "check:release-security-required-env", ciRequired: true },
        { command: "check:pci-cde-drift", ciRequired: false },
        { command: "check:pan-in-client-bundle", ciRequired: false },
      ],
    },
  ],
  entitlementGates: [...[
    "plans",
    "billing-states",
    "feature-access",
    "workspace-modes",
    "seats",
    "usage-limits",
    "grace-periods",
    "blocked-states",
  ].map((id) => ({ id, path: "src/lib/billing/operational-entitlements.ts", markers: [id], owner: "@billing", validationCommand: "test:vitest:current-product" }))],
  billingStateTransitions: [...[
    "trialing",
    "active",
    "past-due",
    "unpaid",
    "canceled",
    "incomplete",
    "incomplete-expired",
    "paused",
    "no-customer",
    "no-subscription",
    "portal-return",
  ].map((id) => ({ id, path: "src/lib/billing/operational-entitlements.ts", markers: [id], owner: "@billing", validationCommand: "test:vitest:current-product" }))],
  seatInviteLimits: [...[
    "invite-creation",
    "revoke",
    "accept",
    "expired-invite",
    "duplicate-invite",
    "seat-limit",
    "role-change",
    "billing-mismatch",
  ].map((id) => ({ id, path: "src/lib/billing/operational-entitlements.ts", markers: [id], owner: "@billing", validationCommand: "test:vitest:current-product" }))],
  revenueImpactSafeguards: [...[
    "idempotency",
    "audit-events",
    "redaction",
    "provider-event-replay",
    "manual-boundary",
  ].map((id) => ({ id, path: "src/lib/billing/operational-entitlements.ts", markers: [id], owner: "@billing", validationCommand: "check:operational-billing-entitlements" }))],
  manualBoundary: "Live billing changes remain manual.",
};

test("buildOperationalBillingEntitlementsReport requires all Section 33 marker groups", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-billing-entitlements-ok-"));
  write(root, "package.json", packageJson());
  write(
    root,
    ".github/workflows/ci.yml",
    [
      "npm run check:operational-billing-entitlements",
      "npm run check:release-security-required-env",
      "npm run check:provider-integration-fixtures",
      "npm run check:audit-event-coverage",
      "npm run check:idempotency-policy",
    ].join("\n")
  );
  write(root, "config/operational-billing-entitlements.json", JSON.stringify(config));
  write(
    root,
    "src/lib/billing/operational-entitlements.ts",
    `
export const OPERATIONAL_COMMERCIAL_GATE_IDS = ["plans", "billing-states", "feature-access", "workspace-modes", "seats", "usage-limits", "grace-periods", "blocked-states"] as const;
export const OPERATIONAL_COMMERCIAL_PLAN_IDS = ["free", "trial", "core", "advanced", "assurance", "enterprise"] as const;
export const OPERATIONAL_BILLING_STATE_IDS = ["trialing", "active", "past-due", "past_due", "unpaid", "canceled", "incomplete", "incomplete-expired", "incomplete_expired", "paused", "no-customer", "no_customer", "no-subscription", "no_subscription", "portal-return", "portal_return"] as const;
export const OPERATIONAL_SEAT_MUTATION_IDS = ["invite-creation", "invite_creation", "revoke", "invite_revoke", "accept", "invite_accept", "expired-invite", "duplicate-invite", "seat-limit", "role-change", "billing-mismatch"] as const;
export const OPERATIONAL_REVENUE_IMPACT_SAFEGUARD_IDS = ["idempotency", "audit-events", "redaction", "provider-event-replay", "manual-boundary"] as const;
export const OPERATIONAL_COMMERCIAL_FEATURE_POLICIES: readonly unknown[] = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e" }, { id: "f" }, { id: "g" }, { id: "h" }] as const;
export const OPERATIONAL_REVENUE_IMPACT_SAFEGUARDS: readonly unknown[] = [{ id: "idempotency" }, { id: "audit-events" }, { id: "redaction" }, { id: "provider-event-replay" }, { id: "manual-boundary" }] as const;
// entitlement markers: plans billing-states feature-access workspace-modes seats usage-limits grace-periods blocked-states
// billing markers: trialing active past-due unpaid canceled incomplete incomplete-expired paused no-customer no-subscription portal-return
// seat markers: invite-creation revoke accept expired-invite duplicate-invite seat-limit role-change billing-mismatch
// revenue markers: idempotency audit-events redaction provider-event-replay manual-boundary
`
  );
  write(root, "src/lib/idempotency.ts", "x-idempotency-key\nDuplicate request blocked by idempotency key\n");
  write(root, "src/app/api/stripe/checkout/route.ts", "enforceIdempotency\nscope: \"stripe.checkout\"\n");
  write(root, "src/app/api/stripe/portal/route.ts", "enforceIdempotency\nscope: \"stripe.portal\"\n");
  write(root, "src/app/api/stripe/webhook/route.ts", "stripe_webhook_events\nduplicate: true\n");
  write(root, "src/lib/provider-integration-fixtures.ts", "REQUIRED_PROVIDER_INTEGRATION_SCENARIOS checkout_completed portal_return webhook_replay subscription_downgrade failed_payment trial_expiry customer_mismatch test_live_mismatch spf_dkim_dmarc_dns unsubscribe_headers provider_outage api_key_absent quota_error invalid_model timeout partial_output hallucinated_citation raw_prompt_leakage provider_failover upstash_success malformed_response pii_key_sanitization state_integrity pkce_s256 token_encryption reencryption_tooling");
  write(root, "src/lib/provider-integration-fixtures.test.ts", "covers every required provider scenario\nreports missing scenarios and unsafe fixture metadata\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:provider-integration-fixtures"\n"check:audit-event-coverage"\n');
  write(root, "src/lib/rate-limit.ts", "normalizeUpstashLimitResult\nrate_limit_backend_malformed_response\nsanitized-rate-limit-key\n");
  write(root, "src/app/api/integrations/refresh-tokens/route.ts", "formatUnknownForServerLog(err)\nlast_error: safeError.slice(0, 500)\n");
  write(root, "src/lib/security/audit-event-policy.ts", "SENSITIVE_AUDIT_EVENT_POLICIES\nAUDIT_APPEND_ONLY_TABLES\nauditPolicyForAction\nvalidateAuditEventShape\nauditEventPolicyCoverageIssues\ndatabase_default_now\nsafe_metadata_only\nappendOnly\n");
  write(root, "src/lib/security/audit-event-policy.test.ts", "covers sensitive action families with append-only policies\naccepts sanitized, organization-scoped audit events\nrejects missing actor, disallowed target, mutable timestamps, and unsafe metadata\n");
  write(root, "src/actions/settings.ts", 'action: "member.invited"\naction: "member.invite_revoked"\n');
  write(root, "src/lib/anything.ts", 'security.session\nsecurity.mfa\nsecurity.integration_api_key\nexport.requested\nimport_job.started\nreport_run.retry_requested\nsecurity.internal_debugging_sweep_success\nextraction.completed\nprivacy_request.created\nmember.invited\n');

  const report = buildOperationalBillingEntitlementsReport(root);
  const markerIssues = report.issues.filter((row) =>
    String(row.issue).startsWith("operational_billing_entitlement_gate_") ||
    String(row.issue).startsWith("operational_billing_state_transition_") ||
    String(row.issue).startsWith("operational_billing_seat_invite_") ||
    String(row.issue).startsWith("operational_billing_revenue_safeguard_")
  );
  assert.deepEqual(markerIssues, []);
  assert.equal(report.entitlementGates.length, 8);
  assert.equal(report.billingStateTransitions.length, 11);
  assert.equal(report.seatInviteLimits.length, 8);
  assert.equal(report.revenueImpactSafeguards.length, 5);
});
