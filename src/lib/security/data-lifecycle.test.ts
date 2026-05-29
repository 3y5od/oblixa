import { describe, expect, it } from "vitest";
import {
  DATA_LIFECYCLE_CASCADE_PLANS,
  lifecycleCascadePlanIssues,
  planLifecycleCascade,
} from "@/lib/security/data-lifecycle";

describe("data lifecycle cascade plans", () => {
  it("covers org deletion, user deletion, token revocation, uploads, reports, and legal hold", () => {
    expect(lifecycleCascadePlanIssues()).toEqual([]);
    expect(DATA_LIFECYCLE_CASCADE_PLANS.map((plan) => plan.scope)).toEqual([
      "organization_deletion",
      "user_deletion",
      "token_revocation",
      "upload_deletion",
      "report_deletion",
      "legal_hold_exception",
    ]);
  });

  it("blocks destructive user deletion when legal hold is active", () => {
    const plan = planLifecycleCascade({
      scope: "user_deletion",
      targetId: "user_1",
      legalHold: true,
    });

    expect(plan.blocked).toBe(true);
    expect(plan.blockReason).toBe("legal_hold_active");
    expect(plan.requiredAuditAction).toBe("security.dsr_account_delete_requested");
    expect(plan.steps.every((step) => step.kind === "audit" || step.kind === "preserve_append_only")).toBe(true);
  });

  it("keeps token revocation local and audit-first without legal-hold blocking", () => {
    const plan = planLifecycleCascade({
      scope: "token_revocation",
      targetId: "integration_key_1",
      legalHold: true,
    });

    expect(plan.blocked).toBe(false);
    expect(plan.steps[0]).toMatchObject({
      kind: "audit",
      auditAction: "security.integration_api_key_revoked",
    });
    expect(plan.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "redact_fields" }),
        expect.objectContaining({ kind: "delete_rows", target: "integration_oauth_states" }),
      ])
    );
  });
});
