import { beforeEach, describe, expect, it, vi } from "vitest";

const enableRouteMocks = vi.hoisted(() => ({
  enableAutopilotRule: vi.fn(),
  enforceIdempotency: vi.fn(),
  incrementAssuranceQualityCounter: vi.fn(),
  isFeatureEnabled: vi.fn(),
  recordApiMutationAuditEvent: vi.fn(),
  rejectUnexpectedBody: vi.fn(),
  requireApiWorkspaceEligibility: vi.fn(),
  requireAssuranceWorkspaceForAutopilotApi: vi.fn(),
  requireV6ApiFeature: vi.fn(),
  requireV6Context: vi.fn(),
  runIncrementalAssuranceChecks: vi.fn(),
}));

vi.mock("@/lib/assurance/feature-guards", () => ({
  requireV6ApiFeature: enableRouteMocks.requireV6ApiFeature,
}));

vi.mock("@/lib/assurance/api-auth", () => ({
  requireV6Context: enableRouteMocks.requireV6Context,
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility: enableRouteMocks.requireApiWorkspaceEligibility,
}));

vi.mock("@/lib/security/read-json-body-limited", () => ({
  rejectUnexpectedBody: enableRouteMocks.rejectUnexpectedBody,
}));

vi.mock("@/lib/assurance/require-assurance-workspace-for-autopilot-api", () => ({
  requireAssuranceWorkspaceForAutopilotApi: enableRouteMocks.requireAssuranceWorkspaceForAutopilotApi,
}));

vi.mock("@/lib/idempotency", () => ({
  enforceIdempotency: enableRouteMocks.enforceIdempotency,
}));

vi.mock("@/lib/security/api-mutation-audit", () => ({
  recordApiMutationAuditEvent: enableRouteMocks.recordApiMutationAuditEvent,
}));

vi.mock("@/lib/assurance/autopilot", () => ({
  enableAutopilotRule: enableRouteMocks.enableAutopilotRule,
}));

vi.mock("@/lib/assurance/telemetry", () => ({
  incrementAssuranceQualityCounter: enableRouteMocks.incrementAssuranceQualityCounter,
}));

vi.mock("@/lib/assurance/assurance-checks", () => ({
  runIncrementalAssuranceChecks: enableRouteMocks.runIncrementalAssuranceChecks,
}));

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: enableRouteMocks.isFeatureEnabled,
}));

describe("POST /api/autopilot/rules/[id]/enable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enableRouteMocks.requireV6ApiFeature.mockReturnValue(null);
    enableRouteMocks.requireV6Context.mockResolvedValue({
      ctx: { admin: {}, orgId: "org-1", userId: "user-1", role: "admin" },
      errorResponse: null,
    });
    enableRouteMocks.requireApiWorkspaceEligibility.mockResolvedValue(null);
    enableRouteMocks.rejectUnexpectedBody.mockResolvedValue(null);
    enableRouteMocks.requireAssuranceWorkspaceForAutopilotApi.mockResolvedValue(null);
    enableRouteMocks.enforceIdempotency.mockResolvedValue(null);
    enableRouteMocks.recordApiMutationAuditEvent.mockResolvedValue(undefined);
    enableRouteMocks.enableAutopilotRule.mockResolvedValue({ data: { id: "rule-1" }, error: null });
    enableRouteMocks.incrementAssuranceQualityCounter.mockResolvedValue(undefined);
    enableRouteMocks.isFeatureEnabled.mockReturnValue(false);
    enableRouteMocks.runIncrementalAssuranceChecks.mockResolvedValue(undefined);
  });

  it("rejects unsafe rule ids before idempotency or mutation", async () => {
    const { POST } = await import("@/app/api/autopilot/rules/[id]/enable/route");

    const response = await POST(new Request("http://localhost/api/autopilot/rules/bad/enable", { method: "POST" }), {
      params: Promise.resolve({ id: "rule\u202Ehidden" }),
    });

    expect(response.status).toBe(400);
    expect(enableRouteMocks.enforceIdempotency).not.toHaveBeenCalled();
    expect(enableRouteMocks.recordApiMutationAuditEvent).not.toHaveBeenCalled();
    expect(enableRouteMocks.enableAutopilotRule).not.toHaveBeenCalled();
  });

  it("enforces idempotency before enabling an autopilot rule", async () => {
    enableRouteMocks.enforceIdempotency.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "duplicate" }), {
        status: 409,
        headers: { "content-type": "application/json" },
      })
    );
    const { POST } = await import("@/app/api/autopilot/rules/[id]/enable/route");

    const response = await POST(new Request("http://localhost/api/autopilot/rules/rule-1/enable", { method: "POST" }), {
      params: Promise.resolve({ id: "rule-1" }),
    });

    expect(response.status).toBe(409);
    expect(enableRouteMocks.enableAutopilotRule).not.toHaveBeenCalled();
  });

  it("records mutation audit context and increments telemetry on success", async () => {
    const { POST } = await import("@/app/api/autopilot/rules/[id]/enable/route");

    const response = await POST(new Request("http://localhost/api/autopilot/rules/rule-1/enable", { method: "POST" }), {
      params: Promise.resolve({ id: "rule-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ rule: { id: "rule-1" } });
    expect(enableRouteMocks.enforceIdempotency).toHaveBeenCalledWith(expect.any(Request), {
      scope: "autopilot.rules.enable",
      actorKey: "org-1:user-1:rule-1",
    });
    expect(enableRouteMocks.recordApiMutationAuditEvent).toHaveBeenCalledWith(
      {},
      {
        organizationId: "org-1",
        actorUserId: "user-1",
        route: "/api/autopilot/rules/[id]/enable",
        method: "POST",
      }
    );
    expect(enableRouteMocks.enableAutopilotRule).toHaveBeenCalledWith({}, "org-1", "rule-1");
    expect(enableRouteMocks.incrementAssuranceQualityCounter).toHaveBeenCalledWith(
      {},
      "org-1",
      "api_post_autopilot_enable_total",
      1
    );
  });
});
