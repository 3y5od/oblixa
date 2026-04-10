import { beforeEach, describe, expect, it, vi } from "vitest";

const requireV6ApiFeature = vi.fn();
const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();
const approveAndContinuePlaybookRun = vi.fn();

vi.mock("@/lib/v6/feature-guards", () => ({
  requireV6ApiFeature,
}));

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext,
  canManageCapability,
}));

vi.mock("@/lib/v6/playbooks", () => ({
  approveAndContinuePlaybookRun,
}));

describe("POST /api/playbooks/runs/[id]/approve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    requireV6ApiFeature.mockReturnValue(null);
    canManageCapability.mockResolvedValue(true);
  });

  it("returns 403 when feature disabled", async () => {
    requireV6ApiFeature.mockReturnValueOnce(new Response(null, { status: 403 }));
    const { POST } = await import("./route");
    const res = await POST(new Request("http://localhost"), { params: Promise.resolve({ id: "r1" }) });
    expect(res.status).toBe(403);
  });

  it("returns 200 when approval succeeds", async () => {
    getApiAuthContext.mockResolvedValue({
      admin: {},
      userId: "u1",
      orgId: "o1",
      role: "admin",
    });
    approveAndContinuePlaybookRun.mockResolvedValueOnce({ data: { id: "r1", status: "completed" }, error: null });
    const { POST } = await import("./route");
    const res = await POST(new Request("http://localhost"), { params: Promise.resolve({ id: "r1" }) });
    expect(res.status).toBe(200);
    expect(approveAndContinuePlaybookRun).toHaveBeenCalledWith({}, "o1", "u1", "r1");
  });
});
