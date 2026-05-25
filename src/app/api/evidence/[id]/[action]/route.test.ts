import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();
const requireApiWorkspaceEligibility = vi.fn();
const revalidatePath = vi.fn();
const recordV10AuditEvent = vi.fn();
const refreshV10ReadModelsForOrganization = vi.fn();

vi.mock("@/lib/contract-operations/api-auth", () => ({
  getApiAuthContext,
  canManageCapability,
}));

vi.mock("@/lib/contract-operations/casefile", () => ({
  appendCasefileEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/integrations/events", () => ({
  enqueueOutboundEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility: (...args: unknown[]) => requireApiWorkspaceEligibility(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath,
}));

vi.mock("@/lib/server-contracts", () => ({
  executeV10IdempotentMutation: async (
    _admin: unknown,
    _input: unknown,
    execute: () => Promise<unknown>
  ) => ({ response: await execute(), replayed: false }),
  getV10IdempotencyKeyFromRequest: (request: Request) => request.headers.get("x-idempotency-key")?.trim() || null,
  getV10ExpectedVersionFromRequest: (request: Request) => request.headers.get("x-v10-expected-version")?.trim() || undefined,
  recordV10AuditEvent,
}));

vi.mock("@/lib/read-model-refresh", () => ({
  refreshV10ReadModelsForOrganization,
}));

function adminEvidence(submission: { id: string; requirement_id: string; status?: string; updated_at?: string } | null) {
  return {
    from: vi.fn((table: string) => {
      if (table === "evidence_submissions") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: submission, error: null })),
              })),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  select: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({
                      data: { id: submission?.id ?? "sub-1", status: "reviewed" },
                      error: null,
                    })),
                  })),
                })),
              })),
            })),
          })),
        };
      }
      if (table === "evidence_requirements") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: { contract_id: "c1", title: "SOC2" },
                  error: null,
                })),
              })),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(async () => ({ error: null })),
            })),
          })),
        };
      }
      return {};
    }),
  };
}

describe("POST /api/evidence/[id]/[action]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiWorkspaceEligibility.mockResolvedValue(null);
    recordV10AuditEvent.mockResolvedValue("v10-audit-1");
    refreshV10ReadModelsForOrganization.mockResolvedValue({ ok: true, counts: {} });
    getApiAuthContext.mockResolvedValue({
      admin: adminEvidence({
        id: "sub-1",
        requirement_id: "req-1",
        status: "submitted",
        updated_at: "2026-01-02T00:00:00Z",
      }),
      userId: "user-1",
      orgId: "org-1",
      role: "admin",
    });
    canManageCapability.mockResolvedValue(true);
  });

  it("returns 401 when unauthenticated", async () => {
    getApiAuthContext.mockResolvedValueOnce(null);
    const { POST } = await import("@/app/api/evidence/[id]/[action]/route");
    const res = await POST(
      new Request("http://localhost:3000/api/evidence/sub-1/approve", { method: "POST" }),
      { params: Promise.resolve({ id: "sub-1", action: "approve" }) }
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 without approvals_manage", async () => {
    canManageCapability.mockResolvedValueOnce(false);
    const { POST } = await import("@/app/api/evidence/[id]/[action]/route");
    const res = await POST(
      new Request("http://localhost:3000/api/evidence/sub-1/approve", { method: "POST" }),
      { params: Promise.resolve({ id: "sub-1", action: "approve" }) }
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 when submission missing", async () => {
    getApiAuthContext.mockResolvedValueOnce({
      admin: adminEvidence(null),
      userId: "user-1",
      orgId: "org-1",
      role: "admin",
    });
    const { POST } = await import("@/app/api/evidence/[id]/[action]/route");
    const res = await POST(
      new Request("http://localhost:3000/api/evidence/missing/approve", { method: "POST" }),
      { params: Promise.resolve({ id: "missing", action: "approve" }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns problem JSON for unsupported action before object lookup", async () => {
    const { POST } = await import("@/app/api/evidence/[id]/[action]/route");
    const res = await POST(
      new Request("http://localhost:3000/api/evidence/sub-1/void", { method: "POST" }),
      { params: Promise.resolve({ id: "sub-1", action: "void" }) }
    );
    await expect(res.json()).resolves.toMatchObject({
      code: "invalid_request",
      details: { reason: "invalid_route_param_enum", param: "action" },
    });
    expect(res.status).toBe(400);
  });

  it("approve succeeds", async () => {
    const { POST } = await import("@/app/api/evidence/[id]/[action]/route");
    const res = await POST(
      new Request("http://localhost:3000/api/evidence/sub-1/approve", {
        method: "POST",
        headers: { "x-idempotency-key": "evidence_approve_12345" },
      }),
      { params: Promise.resolve({ id: "sub-1", action: "approve" }) }
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(expect.objectContaining({ ok: true, outcome: "success" }));
  });

  it("reject succeeds with reviewer feedback", async () => {
    const { POST } = await import("@/app/api/evidence/[id]/[action]/route");
    const res = await POST(
      new Request("http://localhost:3000/api/evidence/sub-1/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-idempotency-key": "evidence_reject_12345" },
        body: JSON.stringify({ reason: "Please upload the current certificate period." }),
      }),
      { params: Promise.resolve({ id: "sub-1", action: "reject" }) }
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(expect.objectContaining({ ok: true, outcome: "success" }));
  });
});
