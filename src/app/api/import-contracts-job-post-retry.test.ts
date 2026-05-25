/**
 * V9 Appendix R — import retry supersede semantics (409) and missing job (404) on POST.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

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

const { loadRetryableImportRows, runContractCsvImport } = vi.hoisted(() => ({
  loadRetryableImportRows: vi.fn(),
  runContractCsvImport: vi.fn(),
}));

vi.mock("@/lib/import-jobs", () => ({
  loadRetryableImportRows,
  runContractCsvImport,
}));

vi.mock("@/lib/product-telemetry", () => ({
  PRODUCT_TELEMETRY_ACTIONS: [],
  emitProductTelemetryEvent: vi.fn(async () => {}),
}));

describe("POST /api/import/contracts/[jobId] retry idempotency (V9)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    });
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      order: vi.fn(() => query),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            organization_id: "550e8400-e29b-41d4-a716-446655440001",
            role: "editor",
            created_at: "2026-01-01T00:00:00Z",
          },
        ],
        error: null,
      }),
    };
    createAdminClient.mockResolvedValue({
      from: vi.fn(() => query),
      rpc: vi.fn((fn: string, args: Record<string, unknown>) => {
        if (fn === "claim_v10_mutation_idempotency") {
          return Promise.resolve({
            data: [
              {
                claim_result: "claimed",
                request_hash: args.p_request_hash,
                response_json: args.p_pending_response_json,
                claim_status: "in_progress",
              },
            ],
            error: null,
          });
        }
        if (fn === "complete_v10_mutation_idempotency") return Promise.resolve({ data: true, error: null });
        return Promise.resolve({ data: null, error: { message: `unexpected rpc ${fn}` } });
      }),
    });
  });

  it("returns 404 when the job is not in the member org (no source job)", async () => {
    loadRetryableImportRows.mockResolvedValue({
      rows: [],
      status: null,
      supersededByJobId: null,
    });

    const { POST } = await import("@/app/api/import/contracts/[jobId]/route");
    const res = await POST(new Request("http://localhost/api/import/contracts/missing-job", {
      method: "POST",
      headers: { "x-idempotency-key": "import_retry_missing_12345", "x-v10-expected-version": "missing-job" },
    }), {
      params: Promise.resolve({ jobId: "missing-job" }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toMatchObject({
      error: "Job not found",
      details: {
        v10: expect.objectContaining({
          outcome: "not_found",
          diagnostic_id: "v10_import_retry_job_not_found",
        }),
      },
    });
    expect(runContractCsvImport).not.toHaveBeenCalled();
  });

  it("returns 409 when a newer retry already superseded this job", async () => {
    loadRetryableImportRows.mockResolvedValue({
      rows: [{ title: "T" }],
      status: "failed",
      supersededByJobId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    });

    const { POST } = await import("@/app/api/import/contracts/[jobId]/route");
    const res = await POST(new Request("http://localhost/api/import/contracts/old-job", {
      method: "POST",
      headers: { "x-idempotency-key": "import_retry_old_12345", "x-v10-expected-version": "old-job" },
    }), {
      params: Promise.resolve({ jobId: "old-job" }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("newer retry");
    expect(runContractCsvImport).not.toHaveBeenCalled();
  });
});
