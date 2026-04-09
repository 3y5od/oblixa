import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext,
  canManageCapability,
}));

vi.mock("@/lib/v4/casefile", () => ({
  appendCasefileEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/integrations/events", () => ({
  enqueueOutboundEvent: vi.fn().mockResolvedValue(undefined),
}));

function adminEvidence(submission: { id: string; requirement_id: string } | null) {
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
              eq: vi.fn(async () => ({ error: null })),
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
    getApiAuthContext.mockResolvedValue({
      admin: adminEvidence({ id: "sub-1", requirement_id: "req-1" }),
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

  it("returns 404 for unsupported action", async () => {
    const { POST } = await import("@/app/api/evidence/[id]/[action]/route");
    const res = await POST(
      new Request("http://localhost:3000/api/evidence/sub-1/void", { method: "POST" }),
      { params: Promise.resolve({ id: "sub-1", action: "void" }) }
    );
    expect(res.status).toBe(404);
  });

  it("approve succeeds", async () => {
    const { POST } = await import("@/app/api/evidence/[id]/[action]/route");
    const res = await POST(
      new Request("http://localhost:3000/api/evidence/sub-1/approve", { method: "POST" }),
      { params: Promise.resolve({ id: "sub-1", action: "approve" }) }
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
