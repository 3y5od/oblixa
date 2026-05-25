import { beforeEach, describe, expect, it, vi } from "vitest";

const requireV6Context = vi.fn();
const requireApiWorkspaceEligibility = vi.fn(async () => null);
const incrementAssuranceQualityCounter = vi.fn(async (...args: unknown[]) => {
  void args;
});

vi.mock("@/lib/assurance/feature-guards", () => ({
  requireV6ApiFeature: vi.fn(() => null),
}));

vi.mock("@/lib/assurance/api-auth", () => ({
  requireV6Context: (...args: unknown[]) => requireV6Context(...args),
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility,
}));

vi.mock("@/lib/assurance/telemetry", () => ({
  incrementAssuranceQualityCounter: (...args: unknown[]) => incrementAssuranceQualityCounter(...args),
}));

function maybeSingleChain(data: Record<string, unknown> | null) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => ({ data, error: null })),
  };
  return chain;
}

function adminForReviewBoardRun() {
  return {
    from: vi.fn((table: string) => {
      if (table === "review_board_runs") {
        return maybeSingleChain({
          id: "run-1",
          review_board_id: "board-1",
          status: "reviewed",
          packet_json: { summary: { open_findings: "=SUM(1,1)", open_decisions: 0 } },
          generated_at: "2026-05-01T00:00:00.000Z",
          reviewed_at: null,
          created_at: "2026-05-01T00:00:00.000Z",
        });
      }
      if (table === "review_boards") {
        return maybeSingleChain({
          id: "board-1",
          name: "=Board",
          board_type: "operations",
          cadence: "weekly",
          active: true,
        });
      }
      return maybeSingleChain(null);
    }),
  };
}

describe("GET /api/review-boards/runs/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireV6Context.mockResolvedValue({
      ctx: { admin: adminForReviewBoardRun(), orgId: "o1", userId: "u1", role: "admin" },
      errorResponse: null,
    });
  });

  it("returns CSV with formula-safe cells and sanitized private export headers", async () => {
    const { GET } = await import("@/app/api/review-boards/runs/[id]/route");
    const res = await GET(new Request("http://localhost/api/review-boards/runs/run-1?format=csv"), {
      params: Promise.resolve({ id: "run-1" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    const disposition = res.headers.get("content-disposition") ?? "";
    expect(disposition).toBe(
      `attachment; filename="review-board-run-run-1.csv"; filename*=UTF-8''review-board-run-run-1.csv`
    );
    expect(disposition).not.toMatch(/[\r\n]/);
    expect(await res.text()).toContain("'=SUM(1,1)");
  });

  it("rejects unsafe route params before export", async () => {
    const { GET } = await import("@/app/api/review-boards/runs/[id]/route");
    const res = await GET(new Request("http://localhost/api/review-boards/runs/run-1?format=csv"), {
      params: Promise.resolve({ id: "run-1\r\nX-Bad: yes" }),
    });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      code: "invalid_request",
      details: { reason: "invalid_route_param", param: "id" },
    });
  });
});
