import { beforeEach, describe, expect, it, vi } from "vitest";

const requireV6Context = vi.fn();
const requireApiWorkspaceEligibility = vi.fn(async () => null);
const enforceIdempotency = vi.fn<(...args: unknown[]) => Promise<Response | null>>(async (...args) => {
  void args;
  return null;
});
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

vi.mock("@/lib/idempotency", () => ({
  enforceIdempotency: (...args: unknown[]) => enforceIdempotency(...args),
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
    enforceIdempotency.mockResolvedValue(null);
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

describe("PATCH /api/review-boards/runs/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enforceIdempotency.mockResolvedValue(null);
    requireApiWorkspaceEligibility.mockResolvedValue(null);
  });

  it("returns duplicate idempotency response before patching a review board run", async () => {
    enforceIdempotency.mockResolvedValueOnce(
      Response.json({ error: "Duplicate request blocked by idempotency key" }, { status: 409 })
    );
    requireV6Context.mockResolvedValue({
      ctx: { admin: { from: vi.fn() }, orgId: "o1", userId: "u1", role: "admin" },
      errorResponse: null,
    });

    const { PATCH } = await import("@/app/api/review-boards/runs/[id]/route");
    const res = await PATCH(
      new Request("http://localhost/api/review-boards/runs/run-1", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": "review-run-replay-0001",
        },
        body: JSON.stringify({ status: "reviewed" }),
      }),
      { params: Promise.resolve({ id: "run-1" }) }
    );

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({ error: "Duplicate request blocked by idempotency key" });
    expect(enforceIdempotency).toHaveBeenCalledWith(expect.any(Request), {
      scope: "api.review-boards.runs.id",
      actorKey: "o1:u1",
    });
  });

  it("uses updated_at as an optimistic guard when appending action and decision logs", async () => {
    const priorEq = vi.fn();
    const priorChain = {
      select: vi.fn(() => priorChain),
      eq: priorEq.mockImplementation(() => priorChain),
      maybeSingle: vi.fn(async () => ({
        data: {
          action_capture_json: [{ existing: true }],
          decision_log_json: [{ previous: true }],
          updated_at: "2026-05-01T00:00:00.000Z",
        },
        error: null,
      })),
    };
    const updateEq = vi.fn();
    const updateChain = {
      eq: updateEq.mockImplementation(() => updateChain),
      select: vi.fn(() => updateChain),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    };
    const update = vi.fn(() => updateChain);
    const admin = {
      from: vi.fn((table: string) => {
        if (table === "review_board_runs") {
          return {
            select: priorChain.select,
            eq: priorChain.eq,
            maybeSingle: priorChain.maybeSingle,
            update,
          };
        }
        return maybeSingleChain(null);
      }),
    };
    requireV6Context.mockResolvedValue({
      ctx: { admin, orgId: "o1", userId: "u1", role: "admin" },
      errorResponse: null,
    });

    const { PATCH } = await import("@/app/api/review-boards/runs/[id]/route");
    const res = await PATCH(
      new Request("http://localhost/api/review-boards/runs/run-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          actionCapture: { action: "follow_up" },
          decisionLog: { decision: "approved" },
        }),
      }),
      { params: Promise.resolve({ id: "run-1" }) }
    );

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        action_capture_json: [
          { existing: true },
          expect.objectContaining({ action: "follow_up" }),
        ],
        decision_log_json: [
          { previous: true },
          expect.objectContaining({ decision: "approved" }),
        ],
      })
    );
    expect(updateEq).toHaveBeenCalledWith("organization_id", "o1");
    expect(updateEq).toHaveBeenCalledWith("id", "run-1");
    expect(updateEq).toHaveBeenCalledWith("updated_at", "2026-05-01T00:00:00.000Z");
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({
      code: "stale_version",
      diagnostic_id: "review_board_run_stale_version",
    });
  });
});
