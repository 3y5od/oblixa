import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiAuthContext = vi.fn();
const requireApiWorkspaceEligibility = vi.fn();

vi.mock("@/lib/contract-operations/api-auth", () => ({
  getApiAuthContext,
  canManageCapability: vi.fn(),
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility: (...args: unknown[]) => requireApiWorkspaceEligibility(...args),
}));

function adminSla() {
  return {
    from: vi.fn((table: string) => {
      if (table === "contract_approvals") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              limit: vi.fn(async () => ({
                data: [
                  {
                    id: "a1",
                    status: "approved",
                    created_at: new Date("2026-01-01T12:00:00Z").toISOString(),
                    completed_at: new Date("2026-01-01T14:00:00Z").toISOString(),
                    approval_type: "legal",
                  },
                ],
                error: null,
              })),
            })),
          })),
        };
      }
      if (table === "approval_slas") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(async () => ({
                data: [{ approval_type: "legal", contract_type: null, sla_hours: 72 }],
                error: null,
              })),
            })),
          })),
        };
      }
      return {};
    }),
  };
}

describe("GET /api/approvals/sla-metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiWorkspaceEligibility.mockResolvedValue(null);
    getApiAuthContext.mockResolvedValue({
      admin: adminSla(),
      userId: "user-1",
      orgId: "org-1",
      role: "admin",
    });
  });

  it("returns 401 when unauthenticated", async () => {
    getApiAuthContext.mockResolvedValueOnce(null);
    const { GET } = await import("@/app/api/approvals/sla-metrics/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns metrics object", async () => {
    const { GET } = await import("@/app/api/approvals/sla-metrics/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.metrics).toMatchObject({
      approvalsCompleted: 1,
      withinSlaRate: 100,
    });
    expect(typeof body.metrics.averageApprovalHours).toBe("number");
  });
});
