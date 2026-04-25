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
  emitProductTelemetryEvent: vi.fn(async () => {}),
}));

describe("POST /api/import/contracts/[jobId] retry idempotency (V9)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    });
    createAdminClient.mockResolvedValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
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
            })),
          })),
        })),
      })),
    });
  });

  it("returns 404 when the job is not in the member org (no source job)", async () => {
    loadRetryableImportRows.mockResolvedValue({
      rows: [],
      status: null,
      supersededByJobId: null,
    });

    const { POST } = await import("@/app/api/import/contracts/[jobId]/route");
    const res = await POST(new Request("http://localhost/api/import/contracts/missing-job", { method: "POST" }), {
      params: Promise.resolve({ jobId: "missing-job" }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: "Job not found" });
    expect(runContractCsvImport).not.toHaveBeenCalled();
  });

  it("returns 409 when a newer retry already superseded this job", async () => {
    loadRetryableImportRows.mockResolvedValue({
      rows: [{ title: "T" }],
      status: "failed",
      supersededByJobId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    });

    const { POST } = await import("@/app/api/import/contracts/[jobId]/route");
    const res = await POST(new Request("http://localhost/api/import/contracts/old-job", { method: "POST" }), {
      params: Promise.resolve({ jobId: "old-job" }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("newer retry");
    expect(runContractCsvImport).not.toHaveBeenCalled();
  });
});
