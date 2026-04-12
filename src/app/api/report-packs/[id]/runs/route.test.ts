import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiAuthContext = vi.fn();
const requireApiWorkspaceEligibility = vi.fn();
const getV6OrgSettingsJson = vi.fn();

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext,
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility: (...args: unknown[]) => requireApiWorkspaceEligibility(...args),
}));

vi.mock("@/lib/v6/org-settings", () => ({
  getV6OrgSettingsJson: (...args: unknown[]) => getV6OrgSettingsJson(...args),
}));

function adminForRuns(packReportType: string) {
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
                  limit: vi.fn(async () => ({ data: [], error: null })),
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
    getV6OrgSettingsJson.mockResolvedValue({ workspace_mode: "core" });
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
});
