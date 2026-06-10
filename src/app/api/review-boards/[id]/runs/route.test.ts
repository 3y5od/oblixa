import { describe, expect, it, beforeEach, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  incrementAssuranceQualityCounter: vi.fn(),
  listReviewBoardRuns: vi.fn(),
  requireApiWorkspaceEligibility: vi.fn(),
  requireV6ApiFeature: vi.fn(),
  requireV6Context: vi.fn(),
}));

vi.mock("@/lib/assurance/feature-guards", () => ({
  requireV6ApiFeature: routeMocks.requireV6ApiFeature,
}));

vi.mock("@/lib/assurance/api-auth", () => ({
  requireV6Context: routeMocks.requireV6Context,
}));

vi.mock("@/lib/assurance/review-boards", () => ({
  listReviewBoardRuns: routeMocks.listReviewBoardRuns,
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility: routeMocks.requireApiWorkspaceEligibility,
}));

vi.mock("@/lib/assurance/telemetry", () => ({
  incrementAssuranceQualityCounter: routeMocks.incrementAssuranceQualityCounter,
}));

describe("GET /api/review-boards/[id]/runs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeMocks.requireV6ApiFeature.mockReturnValue(null);
    routeMocks.requireV6Context.mockResolvedValue({
      ctx: { admin: {}, orgId: "org-1", userId: "user-1", role: "admin" },
      errorResponse: null,
    });
    routeMocks.requireApiWorkspaceEligibility.mockResolvedValue(null);
    routeMocks.listReviewBoardRuns.mockResolvedValue({ data: [{ id: "run-1" }], error: null });
    routeMocks.incrementAssuranceQualityCounter.mockResolvedValue(undefined);
  });

  it("returns feature-gate response before loading review board runs", async () => {
    routeMocks.requireV6ApiFeature.mockReturnValueOnce(Response.json({ error: "disabled" }, { status: 403 }));
    const { GET } = await import("@/app/api/review-boards/[id]/runs/route");

    const response = await GET(new Request("http://localhost/api/review-boards/board-1/runs"), {
      params: Promise.resolve({ id: "board-1" }),
    });

    expect(response.status).toBe(403);
    expect(routeMocks.listReviewBoardRuns).not.toHaveBeenCalled();
  });

  it("rejects unsafe board ids before querying review board runs", async () => {
    const { GET } = await import("@/app/api/review-boards/[id]/runs/route");

    const response = await GET(new Request("http://localhost/api/review-boards/board-1/runs"), {
      params: Promise.resolve({ id: "board-1\r\nX-Bad: yes" }),
    });

    expect(response.status).toBe(400);
    expect(routeMocks.listReviewBoardRuns).not.toHaveBeenCalled();
  });

  it("lists review board runs through the authenticated organization scope", async () => {
    const { GET } = await import("@/app/api/review-boards/[id]/runs/route");

    const response = await GET(new Request("http://localhost/api/review-boards/board-1/runs"), {
      params: Promise.resolve({ id: "board-1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ runs: [{ id: "run-1" }] });
    expect(routeMocks.requireApiWorkspaceEligibility).toHaveBeenCalledWith({
      admin: {},
      orgId: "org-1",
      role: "admin",
      apiPath: "/api/review-boards/[id]/runs",
    });
    expect(routeMocks.listReviewBoardRuns).toHaveBeenCalledWith({}, "org-1", "board-1");
  });
});
