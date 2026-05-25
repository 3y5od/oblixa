import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();
const upsertDetectedExceptions = vi.fn();
const recordAutomationEvent = vi.fn();
const requireApiWorkspaceEligibility = vi.fn();

vi.mock("@/lib/contract-operations/api-auth", () => ({
  getApiAuthContext,
  canManageCapability,
}));

vi.mock("@/lib/contract-operations/exceptions", () => ({
  upsertDetectedExceptions,
}));

vi.mock("@/lib/contract-operations/automation-audit", () => ({
  recordAutomationEvent,
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility: (...args: unknown[]) => requireApiWorkspaceEligibility(...args),
}));

function adminEmptyQueries() {
  return {
    from: vi.fn((table: string) => {
      const empty = async () => ({ data: [] as unknown[], error: null });
      if (table === "contract_tasks" || table === "contract_obligations") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(() => ({
                lt: vi.fn(() => ({
                  limit: vi.fn(empty),
                })),
              })),
            })),
          })),
        };
      }
      if (table === "contracts") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn(() => ({
                limit: vi.fn(empty),
              })),
            })),
          })),
        };
      }
      return {};
    }),
  };
}

describe("POST /api/exceptions/run-detection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiWorkspaceEligibility.mockResolvedValue(null);
    getApiAuthContext.mockResolvedValue({
      admin: adminEmptyQueries(),
      userId: "user-1",
      orgId: "org-1",
      role: "admin",
    });
    canManageCapability.mockResolvedValue(true);
    upsertDetectedExceptions.mockResolvedValue({ touched: 3 });
    recordAutomationEvent.mockResolvedValue(undefined);
  });

  it("returns 401 when unauthenticated", async () => {
    getApiAuthContext.mockResolvedValueOnce(null);
    const { POST } = await import("@/app/api/exceptions/run-detection/route");
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("returns 403 without maintenance_manage", async () => {
    canManageCapability.mockResolvedValueOnce(false);
    const { POST } = await import("@/app/api/exceptions/run-detection/route");
    const res = await POST();
    expect(res.status).toBe(403);
  });

  it("returns detected 0 when no candidates", async () => {
    const { POST } = await import("@/app/api/exceptions/run-detection/route");
    const res = await POST();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ detected: 0 });
    expect(upsertDetectedExceptions).not.toHaveBeenCalled();
  });
});
