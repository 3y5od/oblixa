import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const requireV6ApiFeature = vi.fn();
const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();
const isFeatureEnabled = vi.fn();
const requireApiWorkspaceEligibility = vi.fn();
const enforceIdempotency = vi.fn();
const recordApiMutationAuditEvent = vi.fn();
const recordApiRouteAuditEvent = vi.fn();

vi.mock("@/lib/assurance/feature-guards", () => ({
  requireV6ApiFeature,
}));

vi.mock("@/lib/contract-operations/api-auth", () => ({
  getApiAuthContext,
  canManageCapability,
}));

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled,
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility: (...args: unknown[]) => requireApiWorkspaceEligibility(...args),
}));

vi.mock("@/lib/idempotency", () => ({
  enforceIdempotency,
}));

vi.mock("@/lib/security/api-mutation-audit", () => ({
  recordApiMutationAuditEvent,
  recordApiRouteAuditEvent,
}));

vi.mock("@/lib/assurance/org-settings", () => ({
  getOrgSettingsJson: vi.fn(async () => ({ autopilot_allow_execution: false })),
  getV6OrgSettingsSnapshot: vi.fn(async () => ({
    settings: { autopilot_allow_execution: false },
    updatedAt: "2026-01-01T00:00:00Z",
  })),
  mergeOrgSettingsJson: vi.fn(async () => ({
    data: { autopilot_allow_execution: true },
    error: null,
  })),
}));

vi.mock("@/lib/assurance/assurance-checks", () => ({
  runIncrementalAssuranceChecks: vi.fn(async () => ({})),
}));

vi.mock("@/lib/assurance/telemetry", () => ({
  incrementAssuranceQualityCounter: vi.fn(async () => {}),
}));

describe("/api/workspace/v6-settings", () => {
  beforeEach(() => {
    process.env.OBLIXA_ENABLE_PRIVATE_PRODUCT_CONTROLS = "1";
    vi.resetModules();
    vi.clearAllMocks();
    requireApiWorkspaceEligibility.mockResolvedValue(null);
    canManageCapability.mockResolvedValue(true);
    enforceIdempotency.mockResolvedValue(null);
    recordApiMutationAuditEvent.mockResolvedValue("v10-audit-1");
    recordApiRouteAuditEvent.mockResolvedValue("v10-audit-2");
  });

  it("mocks workspace eligibility guard", () => {
    requireApiWorkspaceEligibility.mockResolvedValue(null);
    expect(requireApiWorkspaceEligibility).toBeDefined();
  });

  it("GET returns 401 when unauthenticated", async () => {
    requireV6ApiFeature.mockReturnValueOnce(null);
    getApiAuthContext.mockResolvedValueOnce(null);
    const { GET } = await import("@/app/api/workspace/v6-settings/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("GET returns 403 when V6 API feature guard fails closed", async () => {
    requireV6ApiFeature.mockReturnValueOnce(
      NextResponse.json({ error: "This assurance feature is disabled for your workspace." }, { status: 403 })
    );
    const { GET } = await import("@/app/api/workspace/v6-settings/route");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("GET returns settings when authenticated", async () => {
    requireV6ApiFeature.mockReturnValueOnce(null);
    getApiAuthContext.mockResolvedValueOnce({ admin: {}, userId: "u1", orgId: "o1", role: "admin" });
    const { GET } = await import("@/app/api/workspace/v6-settings/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { settings: { autopilot_allow_execution?: boolean } };
    expect(body.settings.autopilot_allow_execution).toBe(false);
  });

  it("PATCH returns 403 without settings_manage", async () => {
    requireV6ApiFeature.mockReturnValueOnce(null);
    getApiAuthContext.mockResolvedValueOnce({ admin: {}, userId: "u1", orgId: "o1", role: "viewer" });
    canManageCapability.mockResolvedValueOnce(false);
    const { PATCH } = await import("@/app/api/workspace/v6-settings/route");
    const res = await PATCH(
      new Request("http://localhost/api/workspace/v6-settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ autopilotAllowExecution: true }),
      })
    );
    expect(res.status).toBe(403);
  });

  it("PATCH returns duplicate response before parsing or mutating settings", async () => {
    const duplicate = new Response(
      JSON.stringify({ error: "Duplicate request blocked by idempotency key" }),
      { status: 409, headers: { "content-type": "application/json" } }
    );
    requireV6ApiFeature.mockReturnValueOnce(null);
    getApiAuthContext.mockResolvedValueOnce({ admin: {}, userId: "u1", orgId: "o1", role: "admin" });
    canManageCapability.mockResolvedValueOnce(true);
    enforceIdempotency.mockResolvedValueOnce(duplicate);

    const { PATCH } = await import("@/app/api/workspace/v6-settings/route");
    const res = await PATCH(
      new Request("http://localhost/api/workspace/v6-settings", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": "workspace-settings-replay-0001",
        },
        body: JSON.stringify({ autopilotAllowExecution: true }),
      })
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body).toEqual({ error: "Duplicate request blocked by idempotency key" });
    expect(enforceIdempotency).toHaveBeenCalledWith(
      expect.any(Request),
      {
        scope: "api.workspace.v6-settings",
        actorKey: "o1:u1",
      }
    );
    expect(recordApiMutationAuditEvent).not.toHaveBeenCalled();
  });

  it("PATCH rejects autopilot execution controls when private release controls are disabled", async () => {
    delete process.env.OBLIXA_ENABLE_PRIVATE_PRODUCT_CONTROLS;
    requireV6ApiFeature.mockReturnValueOnce(null);
    getApiAuthContext.mockResolvedValueOnce({ admin: {}, userId: "u1", orgId: "o1", role: "admin" });
    canManageCapability.mockResolvedValueOnce(true);
    const { PATCH } = await import("@/app/api/workspace/v6-settings/route");
    const res = await PATCH(
      new Request("http://localhost/api/workspace/v6-settings", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": "workspace-settings-private-control-0001",
          "if-match": "2026-01-01T00:00:00Z",
        },
        body: JSON.stringify({ autopilotAllowExecution: true }),
      })
    );
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body).toMatchObject({
      code: "private_release_control",
      diagnostic_id: "workspace_v6_settings_private_release_control",
    });
  });
});
