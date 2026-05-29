import { describe, expect, it } from "vitest";
import {
  AUDIT_APPEND_ONLY_TABLES,
  auditEventPolicyCoverageIssues,
  auditPolicyForAction,
  validateAuditEventShape,
} from "@/lib/security/audit-event-policy";

describe("sensitive audit event policy", () => {
  it("covers sensitive action families with append-only policies", () => {
    expect(auditEventPolicyCoverageIssues()).toEqual([]);
    expect(AUDIT_APPEND_ONLY_TABLES).toEqual(["audit_events", "v10_audit_events", "security_audit_events"]);
    expect(auditPolicyForAction("security.dsr_account_delete_requested")?.id).toBe("dsr-account-delete");
    expect(auditPolicyForAction("privacy_request.upload_delete_requested")?.id).toBe("privacy-lifecycle");
  });

  it("accepts sanitized, organization-scoped audit events", () => {
    expect(
      validateAuditEventShape({
        organization_id: "org_1",
        actor_user_id: "user_1",
        action: "security.dsr_self_export_downloaded",
        target_type: "user",
        target_id: "user_1",
        outcome: "success",
        safe_metadata: { audit_write_mode: "blocking" },
      })
    ).toEqual([]);
  });

  it("rejects missing actor, disallowed target, mutable timestamps, and unsafe metadata", () => {
    expect(
      validateAuditEventShape({
        organization_id: "org_1",
        actor_user_id: null,
        action: "security.dsr_account_delete_requested",
        target_type: "contract",
        target_id: "user_1",
        outcome: "success",
        updated_at: "2026-01-01T00:00:00.000Z",
        safe_metadata: { responder_email: "person@example.test" },
      })
    ).toEqual([
      "actor_user_id_required",
      "audit_event_must_not_have_updated_at",
      "safe_metadata_must_be_sanitized",
      "target_type_not_allowed",
    ]);
  });
});
