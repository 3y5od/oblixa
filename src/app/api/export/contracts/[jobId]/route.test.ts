import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn();
const createAdminClient = vi.fn();
const createContractExportJob = vi.fn();
const executeContractExportCsv = vi.fn();
const getV6OrgSettingsJson = vi.fn();
const emitProductTelemetryEvent = vi.fn();
const executeV10IdempotentMutation = vi.fn(
  async (_admin: unknown, _input: unknown, execute: () => Promise<unknown>) => ({ response: await execute(), replayed: false })
);
const recordV10AuditEvent = vi.fn();
const refreshV10ReadModelsForOrganization = vi.fn();
const requireApiWorkspaceEligibility = vi.fn();

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: (callback: () => unknown) => {
      callback();
    },
  };
});

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

vi.mock("@/lib/export/contracts-csv", () => ({
  createContractExportJob,
  executeContractExportCsv,
}));

vi.mock("@/lib/v6/org-settings", () => ({
  getV6OrgSettingsJson,
}));

vi.mock("@/lib/product-telemetry", () => ({
  emitProductTelemetryEvent,
}));

vi.mock("@/lib/v10-server-contracts", () => ({
  executeV10IdempotentMutation,
  getV10ExpectedVersionFromRequest: (request: Request) =>
    request.headers.get("x-v10-expected-version")?.trim() || request.headers.get("if-match")?.replace(/^"|"$/g, "").trim() || undefined,
  getV10IdempotencyKeyFromRequest: (request: Request) => request.headers.get("x-idempotency-key")?.trim() || null,
  recordV10AuditEvent,
}));

vi.mock("@/lib/v10-read-model-refresh", () => ({
  refreshV10ReadModelsForOrganization,
}));

describe("GET /api/export/contracts/[jobId]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireApiWorkspaceEligibility.mockResolvedValue(null);
    getV6OrgSettingsJson.mockResolvedValue({ workspace_mode: "core", workspace_plan: "core" });
    createContractExportJob.mockResolvedValue({ jobId: "job-2", auditEventId: "audit-created-1" });
    executeContractExportCsv.mockResolvedValue(new Response(null, { status: 200 }));
    emitProductTelemetryEvent.mockResolvedValue(undefined);
    recordV10AuditEvent.mockResolvedValue("audit-retry-1");
    refreshV10ReadModelsForOrganization.mockResolvedValue({ ok: true, counts: {} });
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
        if (table === "v10_job_run_visibility") {
          const result = {
            data: {
              job_id: "job-1",
              job_class: "export",
              status: "queued",
              failure_category: null,
              diagnostic_id: null,
              user_visible_detail: "Export queued",
              retry_action: null,
              completed_count: 0,
              failed_count: 0,
              retryable_count: 0,
            },
            error: null,
          };
          const query = {
            eq: vi.fn(() => query),
            in: vi.fn(() => query),
            maybeSingle: vi.fn().mockResolvedValue(result),
          };
          return {
            select: vi.fn(() => query),
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
      visible: { headline: string; detail: string; tone: string; diagnosticId: string | null; retryAction: string | null };
      v10_job_visibility: { job_id: string; status: string } | null;
    };
    expect(body.visible.headline).toBe("Export is queued");
    expect(body.visible.detail).toContain("Export queued");
    expect(body.visible.tone).toBe("attention");
    expect(body.visible.diagnosticId).toBeNull();
    expect(body.visible.retryAction).toBeNull();
    expect(body.v10_job_visibility).toMatchObject({ job_id: "job-1", status: "queued" });
  });

  it("returns 500 when the export job cannot be loaded", async () => {
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
                    data: [{ organization_id: "550e8400-e29b-41d4-a716-446655440001", role: "editor" }],
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
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } }),
                })),
              })),
            })),
          };
        }
        if (table === "v10_job_run_visibility") {
          const query = {
            eq: vi.fn(() => query),
            in: vi.fn(() => query),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
          return { select: vi.fn(() => query) };
        }
        return { select: vi.fn(() => ({ eq: vi.fn() })) };
      }),
    });

    const { GET } = await import("@/app/api/export/contracts/[jobId]/route");
    const res = await GET(new Request("http://localhost/api/export/contracts/job-1"), {
      params: Promise.resolve({ jobId: "job-1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toMatchObject({ diagnostic_id: "v10_export_job_load_failed" });
  });

  it("POST queues an export retry with V10 idempotent envelope semantics", async () => {
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
                      status: "failed",
                      selected_contract_count: 2,
                      truncated: true,
                      error_message: "Export exceeded limit",
                      filter_json: { contract_ids: ["contract-1", "contract-2"], saved_view_id: "view-1" },
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

    const { POST } = await import("@/app/api/export/contracts/[jobId]/route");
    const res = await POST(
      new Request("http://localhost/api/export/contracts/job-1", {
        method: "POST",
        headers: {
          "x-idempotency-key": "export_retry_12345",
          "x-v10-expected-version": "job-1",
        },
      }),
      { params: Promise.resolve({ jobId: "job-1" }) }
    );

    expect(res.status).toBe(200);
    expect(createContractExportJob).toHaveBeenCalledWith(
      expect.objectContaining({
        exportScope: "selected",
        selectedIds: ["contract-1", "contract-2"],
        initialStatus: "queued",
      })
    );
    expect(recordV10AuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "export_job.retry_requested", targetType: "export_job", targetId: "job-2" })
    );
    const body = await res.json();
    expect(body).toMatchObject({ success: true, retriedJobId: "job-1", jobId: "job-2", async: true });
    expect(body.v10).toMatchObject({ outcome: "success", changed_object_type: "export_job", changed_object_id: "job-2" });
  });

  it("POST returns server_error when the prior export job cannot be loaded", async () => {
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
                    data: [{ organization_id: "550e8400-e29b-41d4-a716-446655440001", role: "editor" }],
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
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } }),
                })),
              })),
            })),
          };
        }
        return { select: vi.fn(() => ({ eq: vi.fn() })) };
      }),
    });

    const { POST } = await import("@/app/api/export/contracts/[jobId]/route");
    const res = await POST(
      new Request("http://localhost/api/export/contracts/job-1", {
        method: "POST",
        headers: { "x-idempotency-key": "export_retry_12345", "x-v10-expected-version": "job-1" },
      }),
      { params: Promise.resolve({ jobId: "job-1" }) }
    );
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.v10 ?? body.details?.v10 ?? body).toMatchObject({ outcome: "server_error", diagnostic_id: "v10_export_retry_job_load_failed" });
  });
});
