/**
 * V9 §5.3 + Appendix P — import/export job handlers scope service-role reads by organization_id
 * (defense in depth vs IDOR when RLS is bypassed).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const ORG = "550e8400-e29b-41d4-a716-446655440001";

const { createClient, createAdminClient } = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase/server")>();
  return {
    ...actual,
    createClient,
    createAdminClient,
  };
});

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility: vi.fn(async () => null),
}));

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: {},
  getClientIpFromRequest: () => "127.0.0.1",
  rateLimitCheck: vi.fn(async () => ({ ok: true, retryAfterMs: 0 })),
}));

type EqLog = { table: string; col: string; val: string };

function adminForImportGet(eqLog: EqLog[]) {
  return {
    from: (table: string) => {
      if (table === "organization_members") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () =>
                  Promise.resolve({
                    data: [{ organization_id: ORG, role: "editor", created_at: "2026-01-01T00:00:00Z" }],
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      if (table === "contract_import_jobs") {
        return {
          select: () => ({
            eq: (col: string, val: string) => {
              eqLog.push({ table, col, val });
              return {
                eq: (col2: string, val2: string) => {
                  eqLog.push({ table, col: col2, val: val2 });
                  return {
                    maybeSingle: () =>
                      Promise.resolve({
                        data: {
                          id: "job-1",
                          status: "completed",
                          source: "csv",
                          total_rows: 1,
                          valid_rows: 1,
                          inserted_rows: 1,
                          error_rows: 0,
                          failure_reason: null,
                          retry_of_job_id: null,
                          superseded_by_job_id: null,
                          created_at: "2026-01-01T00:00:00Z",
                          updated_at: "2026-01-01T00:00:00Z",
                          completed_at: "2026-01-01T00:00:00Z",
                        },
                        error: null,
                      }),
                  };
                },
              };
            },
          }),
        };
      }
      if (table === "contract_import_job_rows") {
        return {
          select: () => ({
            eq: (col: string, val: string) => {
              eqLog.push({ table, col, val });
              return {
                eq: (col2: string, val2: string) => {
                  eqLog.push({ table, col: col2, val: val2 });
                  return {
                    order: () => ({
                      limit: () => Promise.resolve({ data: [], error: null }),
                    }),
                  };
                },
              };
            },
          }),
        };
      }
      return { select: () => ({ eq: () => ({}) }) };
    },
  };
}

function adminForExportGet(eqLog: EqLog[]) {
  return {
    from: (table: string) => {
      if (table === "organization_members") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () =>
                  Promise.resolve({
                    data: [{ organization_id: ORG, role: "editor", created_at: "2026-01-01T00:00:00Z" }],
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      if (table === "contract_export_jobs") {
        return {
          select: () => ({
            eq: (col: string, val: string) => {
              eqLog.push({ table, col, val });
              return {
                eq: (col2: string, val2: string) => {
                  eqLog.push({ table, col: col2, val: val2 });
                  return {
                    maybeSingle: () =>
                      Promise.resolve({
                        data: {
                          id: "job-1",
                          scope: "selected",
                          status: "queued",
                          export_format: "csv",
                          selected_contract_count: 2,
                          exported_rows: null,
                          truncated: false,
                          error_message: null,
                          filter_json: {},
                          started_at: null,
                          completed_at: null,
                          created_at: "2026-01-01T00:00:00Z",
                          updated_at: "2026-01-01T00:00:00Z",
                        },
                        error: null,
                      }),
                  };
                },
              };
            },
          }),
        };
      }
      return { select: () => ({ eq: () => ({}) }) };
    },
  };
}

describe("import/export job API org scope (V9)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    });
  });

  it("GET /api/import/contracts/[jobId] applies organization_id to contract_import_jobs and rows", async () => {
    const eqLog: EqLog[] = [];
    createAdminClient.mockResolvedValue(adminForImportGet(eqLog));

    const { GET } = await import("@/app/api/import/contracts/[jobId]/route");
    const res = await GET(new Request("http://localhost/api/import/contracts/job-1"), {
      params: Promise.resolve({ jobId: "job-1" }),
    });
    expect(res.status).toBe(200);

    const jobEq = eqLog.filter((e) => e.table === "contract_import_jobs");
    expect(jobEq.map((e) => e.col)).toEqual(["id", "organization_id"]);
    expect(jobEq[0]?.val).toBe("job-1");
    expect(jobEq[1]?.val).toBe(ORG);

    const rowEq = eqLog.filter((e) => e.table === "contract_import_job_rows");
    expect(rowEq.map((e) => e.col)).toEqual(["job_id", "organization_id"]);
    expect(rowEq[0]?.val).toBe("job-1");
    expect(rowEq[1]?.val).toBe(ORG);
  });

  it("GET /api/export/contracts/[jobId] applies organization_id to contract_export_jobs", async () => {
    const eqLog: EqLog[] = [];
    createAdminClient.mockResolvedValue(adminForExportGet(eqLog));

    const { GET } = await import("@/app/api/export/contracts/[jobId]/route");
    const res = await GET(new Request("http://localhost/api/export/contracts/job-1"), {
      params: Promise.resolve({ jobId: "job-1" }),
    });
    expect(res.status).toBe(200);

    const jobEq = eqLog.filter((e) => e.table === "contract_export_jobs");
    expect(jobEq.map((e) => e.col)).toEqual(["id", "organization_id"]);
    expect(jobEq[0]?.val).toBe("job-1");
    expect(jobEq[1]?.val).toBe(ORG);
  });
});
