import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiAuthContext = vi.fn();
const requireApiWorkspaceEligibility = vi.fn();
const getOrgSettingsJson = vi.fn();
const rateLimitCheck = vi.fn();

vi.mock("@/lib/contract-operations/api-auth", () => ({
  getApiAuthContext,
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility: (...args: unknown[]) => requireApiWorkspaceEligibility(...args),
}));

vi.mock("@/lib/assurance/org-settings", () => ({
  getOrgSettingsJson: (...args: unknown[]) => getOrgSettingsJson(...args),
}));

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: { reportPackRunsRead: { max: 60, windowMs: 60_000 } },
  getClientIpFromRequest: () => "127.0.0.1",
  rateLimitCheck: (...args: unknown[]) => rateLimitCheck(...args),
}));

function adminForRuns(packReportType: string, runs: Array<Record<string, unknown>> = []) {
  return {
    from: vi.fn((table: string) => {
      if (table === "report_packs") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    id: "p1",
                    name: "Pack",
                    report_type: packReportType,
                    annotations_json: [],
                  },
                  error: null,
                })),
              })),
            })),
          })),
        };
      }
      if (table === "report_pack_runs") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(async () => ({ data: runs, error: null })),
                })),
              })),
            })),
          })),
        };
      }
      return {};
    }),
  };
}

describe("GET /api/report-packs/[id]/runs", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireApiWorkspaceEligibility.mockResolvedValue(null);
    getOrgSettingsJson.mockResolvedValue({ workspace_mode: "core" });
    rateLimitCheck.mockResolvedValue({ ok: true });
  });

  it("returns 401 when unauthenticated", async () => {
    getApiAuthContext.mockResolvedValueOnce(null);
    const { GET } = await import("@/app/api/report-packs/[id]/runs/route");
    const res = await GET(new Request("http://localhost/api/report-packs/p1/runs"), {
      params: Promise.resolve({ id: "p1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when pack type is ineligible for Core workspace mode", async () => {
    getApiAuthContext.mockResolvedValue({
      admin: adminForRuns("decision_queue_summary"),
      userId: "u1",
      orgId: "org-1",
      role: "admin",
    });
    const { GET } = await import("@/app/api/report-packs/[id]/runs/route");
    const res = await GET(new Request("http://localhost/api/report-packs/p1/runs"), {
      params: Promise.resolve({ id: "p1" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 200 JSON when pack type is eligible for Core", async () => {
    getApiAuthContext.mockResolvedValue({
      admin: adminForRuns("weekly_execution_health"),
      userId: "u1",
      orgId: "org-1",
      role: "admin",
    });
    const { GET } = await import("@/app/api/report-packs/[id]/runs/route");
    const res = await GET(new Request("http://localhost/api/report-packs/p1/runs"), {
      params: Promise.resolve({ id: "p1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.runs).toEqual([]);
  });

  it("returns 429 when report-run export reads are rate limited", async () => {
    rateLimitCheck.mockResolvedValueOnce({ ok: false, retryAfterMs: 5_000 });
    getApiAuthContext.mockResolvedValue({
      admin: adminForRuns("weekly_execution_health"),
      userId: "u1",
      orgId: "org-1",
      role: "admin",
    });
    const { GET } = await import("@/app/api/report-packs/[id]/runs/route");
    const res = await GET(new Request("http://localhost/api/report-packs/p1/runs?format=csv"), {
      params: Promise.resolve({ id: "p1" }),
    });

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("5");
    await expect(res.json()).resolves.toMatchObject({
      code: "rate_limited",
      diagnostic_id: "route_rate_limited",
      route: "/api/report-packs/[id]/runs",
    });
  });

  it("neutralizes spreadsheet formulas in CSV export", async () => {
    getApiAuthContext.mockResolvedValue({
      admin: adminForRuns("workspace_health_report", [
        {
          id: "run-1",
          status: "succeeded",
          started_at: "2026-05-01T00:00:00.000Z",
          completed_at: "2026-05-01T00:01:00.000Z",
          created_at: "2026-05-01T00:00:00.000Z",
          metrics_json: { dangerous: "=SUM(1,1)" },
          output_refs_json: {},
          error: null,
        },
      ]),
      userId: "u1",
      orgId: "org-1",
      role: "admin",
    });
    const { GET } = await import("@/app/api/report-packs/[id]/runs/route");
    const res = await GET(new Request("http://localhost/api/report-packs/p1/runs?format=csv"), {
      params: Promise.resolve({ id: "p1" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.text()).toContain("'=SUM(1,1)");
  });

  it("sanitizes report pack export filenames and private cache headers", async () => {
    getApiAuthContext.mockResolvedValue({
      admin: adminForRuns("workspace_health_report", [
        {
          id: "run-1",
          status: "succeeded",
          started_at: "2026-05-01T00:00:00.000Z",
          completed_at: "2026-05-01T00:01:00.000Z",
          created_at: "2026-05-01T00:00:00.000Z",
          metrics_json: { total: 1 },
          output_refs_json: {},
          error: null,
        },
      ]),
      userId: "u1",
      orgId: "org-1",
      role: "admin",
    });
    const { GET } = await import("@/app/api/report-packs/[id]/runs/route");
    const res = await GET(new Request("http://localhost/api/report-packs/p1/runs?format=csv"), {
      params: Promise.resolve({ id: "p1" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    const disposition = res.headers.get("content-disposition") ?? "";
    expect(disposition).toBe(
      `attachment; filename="report-pack-p1-run.csv"; filename*=UTF-8''report-pack-p1-run.csv`
    );
    expect(disposition).not.toMatch(/[\r\n]/);
  });

  it("rejects unsafe route params before export", async () => {
    getApiAuthContext.mockResolvedValue({
      admin: adminForRuns("workspace_health_report", []),
      userId: "u1",
      orgId: "org-1",
      role: "admin",
    });
    const { GET } = await import("@/app/api/report-packs/[id]/runs/route");
    const res = await GET(new Request("http://localhost/api/report-packs/p1/runs?format=csv"), {
      params: Promise.resolve({ id: "p1\r\nX-Bad: yes" }),
    });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      code: "invalid_request",
      details: { reason: "invalid_route_param", param: "id" },
    });
  });
});
