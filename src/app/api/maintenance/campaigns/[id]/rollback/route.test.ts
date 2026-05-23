import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiAuthContext = vi.fn();
const requireApiWorkspaceEligibility = vi.fn();
const enforceIdempotency = vi.fn();
const recordApiMutationAuditEvent = vi.fn();
const hasSensitiveActionProof = vi.fn();
const recordSecurityAuditEvent = vi.fn();

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext,
  canManageCapability: vi.fn(async () => true),
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility,
}));

vi.mock("@/lib/idempotency", () => ({
  enforceIdempotency,
}));

vi.mock("@/lib/security/api-mutation-audit", () => ({
  recordApiMutationAuditEvent,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { mfa: { getAuthenticatorAssuranceLevel: vi.fn() } },
  })),
}));

vi.mock("@/lib/security/sensitive-action-proof", () => ({
  hasSensitiveActionProof,
}));

vi.mock("@/lib/security/audit-write", () => ({
  recordSecurityAuditEvent,
}));

describe("POST /api/maintenance/campaigns/[id]/rollback", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireApiWorkspaceEligibility.mockResolvedValue(null);
    enforceIdempotency.mockResolvedValue(null);
    recordApiMutationAuditEvent.mockResolvedValue("v10-audit-1");
    hasSensitiveActionProof.mockResolvedValue(true);
    recordSecurityAuditEvent.mockResolvedValue("audit-1");
  });

  it("returns 401 when unauthenticated", async () => {
    getApiAuthContext.mockResolvedValueOnce(null);
    const { POST } = await import("@/app/api/maintenance/campaigns/[id]/rollback/route");
    const res = await POST(new Request("http://localhost/api/maintenance/campaigns/m1/rollback"), {
      params: Promise.resolve({ id: "m1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns duplicate response before marking rollback state", async () => {
    const duplicate = new Response(
      JSON.stringify({ error: "Duplicate request blocked by idempotency key" }),
      { status: 409, headers: { "content-type": "application/json" } }
    );
    const admin = { from: vi.fn() };
    getApiAuthContext.mockResolvedValueOnce({
      admin,
      orgId: "org-1",
      userId: "user-1",
      role: "admin",
    });
    enforceIdempotency.mockResolvedValueOnce(duplicate);

    const { POST } = await import("@/app/api/maintenance/campaigns/[id]/rollback/route");
    const res = await POST(
      new Request("http://localhost/api/maintenance/campaigns/m1/rollback", {
        method: "POST",
        headers: { "x-idempotency-key": "maintenance-rollback-replay-0001" },
      }),
      { params: Promise.resolve({ id: "m1" }) }
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body).toEqual({ error: "Duplicate request blocked by idempotency key" });
    expect(enforceIdempotency).toHaveBeenCalledWith(
      expect.any(Request),
      {
        scope: "api.maintenance.campaigns.id.rollback",
        actorKey: "org-1:user-1",
      }
    );
    expect(recordApiMutationAuditEvent).not.toHaveBeenCalled();
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("requires step-up or AAL2 before rolling back maintenance campaigns", async () => {
    const admin = { from: vi.fn() };
    getApiAuthContext.mockResolvedValueOnce({
      admin,
      orgId: "org-1",
      userId: "user-1",
      role: "admin",
    });
    hasSensitiveActionProof.mockResolvedValueOnce(false);

    const { POST } = await import("@/app/api/maintenance/campaigns/[id]/rollback/route");
    const res = await POST(
      new Request("http://localhost/api/maintenance/campaigns/550e8400-e29b-41d4-a716-446655440000/rollback", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "550e8400-e29b-41d4-a716-446655440000" }) }
    );
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body).toMatchObject({
      code: "step_up_required",
      diagnostic_id: "maintenance_campaign_rollback_step_up_required",
    });
    expect(enforceIdempotency).toHaveBeenCalledWith(
      expect.any(Request),
      {
        scope: "api.maintenance.campaigns.id.rollback",
        actorKey: "org-1:user-1",
      }
    );
    expect(recordApiMutationAuditEvent).not.toHaveBeenCalled();
    expect(recordSecurityAuditEvent).toHaveBeenCalledWith(
      admin,
      expect.objectContaining({
        action: "security.maintenance_destructive_action_blocked",
        outcome: "forbidden",
        safeMetadata: expect.objectContaining({
          reason: "sensitive_action_proof_required",
          maintenance_action: "rollback_maintenance_campaign",
        }),
      })
    );
    expect(admin.from).not.toHaveBeenCalled();
  });
});
