import { describe, expect, it, vi } from "vitest";
import { recordSecurityAuditEvent, recordSecurityAuditEventStrict } from "@/lib/security/audit-write";
import { recordV10AuditEvent, recordV10AuditEventStrict } from "@/lib/server-contracts";

vi.mock("@/lib/server-contracts", () => ({
  recordV10AuditEvent: vi.fn(async () => "audit_1"),
  recordV10AuditEventStrict: vi.fn(async () => "audit_1"),
}));

describe("recordSecurityAuditEvent", () => {
  it("maps security target types to V10 source-object types while preserving the security target", async () => {
    const admin = {} as never;
    await expect(
      recordSecurityAuditEvent(admin, {
        organizationId: "org_1",
        actorUserId: "user_1",
        action: "security.session_signed_out",
        targetType: "auth_session",
        targetId: "user_1",
        outcome: "success",
        safeMetadata: { trigger: "manual" },
      })
    ).resolves.toBe("audit_1");

    expect(recordV10AuditEvent).toHaveBeenCalledWith(admin, {
      organizationId: "org_1",
      actorUserId: "user_1",
      action: "security.session_signed_out",
      targetType: "account",
      targetId: "user_1",
      outcome: "success",
      safeMetadata: {
        trigger: "manual",
        security_target_type: "auth_session",
      },
    });
  });

  it("applies the same mapping for strict security audit writes", async () => {
    const admin = {} as never;
    await expect(
      recordSecurityAuditEventStrict(admin, {
        organizationId: "org_1",
        actorUserId: "user_1",
        action: "security.integration_api_key_created",
        targetType: "integration_api_key",
        targetId: "key_1",
        outcome: "success",
      })
    ).resolves.toBe("audit_1");

    expect(recordV10AuditEventStrict).toHaveBeenCalledWith(admin, {
      organizationId: "org_1",
      actorUserId: "user_1",
      action: "security.integration_api_key_created",
      targetType: "runtime_artifact",
      targetId: "key_1",
      outcome: "success",
      safeMetadata: {
        security_target_type: "integration_api_key",
      },
    });
  });
});
