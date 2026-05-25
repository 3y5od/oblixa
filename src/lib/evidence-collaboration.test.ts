import { describe, expect, it } from "vitest";
import {
  buildV10ExternalResponderPublicState,
  validateV10NotificationDeliveryContract,
} from "./evidence-collaboration";

describe("V10 notifications and external responder contracts", () => {
  it("validates provider delivery, dedupe, quiet-hour, and automation approval notification contracts", () => {
    expect(
      validateV10NotificationDeliveryContract({
        notificationClass: "automation_approval_required",
        sourceObjectType: "automation_run",
        sourceObjectId: "run_1",
        recipientState: "automation_approver",
        deliveryState: "sent",
        provider: "resend",
        providerMessageId: "msg_1",
        dedupeKey: "org_1:automation_run:run_1:approval",
        workspaceTimezone: "America/New_York",
        quietHoursApplied: false,
        retryAt: null,
        auditAction: "notification.sent",
        diagnosticId: null,
        supportSafeMetadata: { source_type: "automation_run", attempt_count: 1 },
      })
    ).toEqual([]);
    expect(
      validateV10NotificationDeliveryContract({
        notificationClass: "automation_approval_required",
        sourceObjectType: "",
        sourceObjectId: "",
        recipientState: "external_responder",
        deliveryState: "skipped_quiet_hours",
        provider: "none",
        providerMessageId: null,
        dedupeKey: "",
        workspaceTimezone: "",
        quietHoursApplied: false,
        retryAt: null,
        auditAction: "notification",
        diagnosticId: null,
        supportSafeMetadata: { responder_email: "external@example.test", signed_url: "https://private.test" },
      })
    ).toEqual(
      expect.arrayContaining([
        "source_object_type_required",
        "source_object_id_required",
        "dedupe_key_required",
        "workspace_timezone_required",
        "audit_action_required",
        "diagnostic_id_required",
        "quiet_hours_state_required",
        "automation_approval_requires_approver_recipient",
        "support_metadata_private_key:responder_email",
        "support_metadata_private_key:signed_url",
      ])
    );
  });

  it("builds public responder states without leaking contact details", () => {
    expect(
      buildV10ExternalResponderPublicState({
        tokenValid: true,
        responderContact: "external@example.test",
        responderRedacted: true,
        status: "sent",
        dueAt: "2026-04-25T00:00:00Z",
        now: new Date("2026-04-24T00:00:00Z"),
      })
    ).toMatchObject({
      link_state: "active",
      responder_identity_state: "redacted",
      accountability_state: "awaiting_external",
      can_submit: true,
      diagnostic_id: null,
    });
    expect(
      buildV10ExternalResponderPublicState({
        tokenValid: true,
        revokedAt: "2026-04-24T00:00:00Z",
        status: "sent",
      })
    ).toMatchObject({
      link_state: "revoked",
      accountability_state: "blocked_link_revoked",
      can_submit: false,
      diagnostic_id: "v10_external_link_revoked",
    });
  });
});
