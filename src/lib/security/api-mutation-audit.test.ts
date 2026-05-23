import { describe, expect, it, vi } from "vitest";
import { recordApiMutationAuditEvent, recordApiRouteAuditEvent } from "@/lib/security/api-mutation-audit";
import { recordV10AuditEvent } from "@/lib/v10-server-contracts";

vi.mock("@/lib/v10-server-contracts", () => ({
  recordV10AuditEvent: vi.fn(async () => "audit_1"),
}));

describe("recordApiMutationAuditEvent", () => {
  it("records route-level sensitive read authorization without target-specific metadata", async () => {
    const admin = {} as never;
    await expect(
      recordApiRouteAuditEvent(admin, {
        organizationId: "org_1",
        actorUserId: "user_1",
        route: "/api/export/contracts",
        method: "get",
        action: "api.sensitive_read_authorized",
      })
    ).resolves.toBe("audit_1");

    expect(recordV10AuditEvent).toHaveBeenCalledWith(admin, {
      organizationId: "org_1",
      actorUserId: "user_1",
      actorType: "user",
      action: "api.sensitive_read_authorized",
      targetType: "api_route",
      targetId: "GET /api/export/contracts",
      outcome: "authorized",
      safeMetadata: {
        method: "GET",
        route: "/api/export/contracts",
      },
    });
  });

  it("records route-level mutation authorization without request body metadata", async () => {
    vi.mocked(recordV10AuditEvent).mockClear();
    const admin = {} as never;
    await expect(
      recordApiMutationAuditEvent(admin, {
        organizationId: "org_1",
        actorUserId: "user_1",
        route: "/api/campaigns",
        method: "post",
      })
    ).resolves.toBe("audit_1");

    expect(recordV10AuditEvent).toHaveBeenCalledWith(admin, {
      organizationId: "org_1",
      actorUserId: "user_1",
      actorType: "user",
      action: "api.mutation_authorized",
      targetType: "api_route",
      targetId: "POST /api/campaigns",
      outcome: "authorized",
      safeMetadata: {
        method: "POST",
        route: "/api/campaigns",
      },
    });
  });
});
