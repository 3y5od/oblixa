import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn();
const createAdminClient = vi.fn();
const requireApiWorkspaceEligibility = vi.fn();

vi.mock("@/lib/supabase/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase/server")>();
  return {
    ...actual,
    createClient,
    createAdminClient,
  };
});

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility,
}));

describe("GET /api/export/contracts/[jobId]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireApiWorkspaceEligibility.mockResolvedValue(null);
  });

  it("returns visible headline + detail for a queued job", async () => {
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    });
    createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "organization_members") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn().mockResolvedValue({
                    data: [
                      {
                        organization_id: "550e8400-e29b-41d4-a716-446655440001",
                        role: "editor",
                        created_at: new Date().toISOString(),
                      },
                    ],
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }
        if (table === "contract_export_jobs") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
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
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    },
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }
        return { select: vi.fn(() => ({ eq: vi.fn() })) };
      }),
    });

    const { GET } = await import("@/app/api/export/contracts/[jobId]/route");
    const res = await GET(new Request("http://localhost/api/export/contracts/job-1"), {
      params: Promise.resolve({ jobId: "job-1" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      visible: { headline: string; detail: string; tone: string };
    };
    expect(body.visible.headline).toBe("Export is queued");
    expect(body.visible.detail).toContain("Export queued");
    expect(body.visible.tone).toBe("attention");
  });
});
