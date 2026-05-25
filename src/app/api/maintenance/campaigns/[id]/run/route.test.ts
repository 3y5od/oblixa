import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiAuthContext = vi.fn();
const requireApiWorkspaceEligibility = vi.fn();
const hasSensitiveActionProof = vi.fn();
const recordSecurityAuditEvent = vi.fn();

vi.mock("@/lib/contract-operations/api-auth", () => ({
  getApiAuthContext,
  canManageCapability: vi.fn(async () => true),
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility,
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

describe("POST /api/maintenance/campaigns/[id]/run", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireApiWorkspaceEligibility.mockResolvedValue(null);
    hasSensitiveActionProof.mockResolvedValue(true);
    recordSecurityAuditEvent.mockResolvedValue("audit-1");
  });

  it("returns 401 when unauthenticated", async () => {
    getApiAuthContext.mockResolvedValueOnce(null);
    const { POST } = await import("@/app/api/maintenance/campaigns/[id]/run/route");
    const res = await POST(new Request("http://localhost/api/maintenance/campaigns/m1/run"), {
      params: Promise.resolve({ id: "m1" }),
    });
    expect(res.status).toBe(401);
  });

  it("requires step-up or AAL2 before running maintenance campaigns", async () => {
    const admin = { from: vi.fn() };
    getApiAuthContext.mockResolvedValueOnce({
      admin,
      orgId: "org-1",
      userId: "user-1",
      role: "admin",
    });
    hasSensitiveActionProof.mockResolvedValueOnce(false);

    const { POST } = await import("@/app/api/maintenance/campaigns/[id]/run/route");
    const res = await POST(
      new Request("http://localhost/api/maintenance/campaigns/550e8400-e29b-41d4-a716-446655440000/run", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "550e8400-e29b-41d4-a716-446655440000" }) }
    );
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body).toMatchObject({
      code: "step_up_required",
      diagnostic_id: "maintenance_campaign_run_step_up_required",
    });
    expect(recordSecurityAuditEvent).toHaveBeenCalledWith(
      admin,
      expect.objectContaining({
        action: "security.maintenance_destructive_action_blocked",
        outcome: "forbidden",
        safeMetadata: expect.objectContaining({
          reason: "sensitive_action_proof_required",
          maintenance_action: "run_maintenance_campaign",
        }),
      })
    );
    expect(admin.from).not.toHaveBeenCalled();
  });
});
