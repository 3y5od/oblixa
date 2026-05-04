import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn();
const createAdminClient = vi.fn();
const getDeterministicMembership = vi.fn();
const requireApiWorkspaceEligibility = vi.fn();
const loadRetryableImportRows = vi.fn();
const runContractCsvImport = vi.fn();
const emitProductTelemetryEvent = vi.fn();
const recordV10AuditEvent = vi.fn();
const refreshV10ReadModelsForOrganization = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient,
  createAdminClient,
  getDeterministicMembership,
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility: (...args: unknown[]) => requireApiWorkspaceEligibility(...args),
}));

vi.mock("@/lib/import-job-visibility", () => ({
  importJobCanRetry: vi.fn(() => false),
  getImportJobDetail: vi.fn(() => "Import detail"),
  getImportJobHeadline: vi.fn(() => "Import headline"),
  getImportJobTone: vi.fn(() => "neutral"),
}));

vi.mock("@/lib/import-jobs", () => ({
  loadRetryableImportRows,
  runContractCsvImport,
}));

vi.mock("@/lib/product-telemetry", () => ({
  emitProductTelemetryEvent,
}));

vi.mock("@/lib/v10-server-contracts", () => ({
  executeV10IdempotentMutation: async (_admin: unknown, _input: unknown, execute: () => Promise<unknown>) => ({
    response: await execute(),
    replayed: false,
  }),
  getV10ExpectedVersionFromRequest: (request: Request) => request.headers.get("x-v10-expected-version")?.trim() || undefined,
  getV10IdempotencyKeyFromRequest: (request: Request) => request.headers.get("x-idempotency-key")?.trim() || null,
  recordV10AuditEvent,
}));

vi.mock("@/lib/v10-read-model-refresh", () => ({
  refreshV10ReadModelsForOrganization,
}));

describe("/api/import/contracts/[jobId]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireApiWorkspaceEligibility.mockResolvedValue(null);
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    });
    createAdminClient.mockResolvedValue({ from: vi.fn() });
    getDeterministicMembership.mockResolvedValue({ organization_id: "org-1", role: "admin" });
    loadRetryableImportRows.mockResolvedValue({ status: "failed", rows: [], supersededByJobId: null });
    runContractCsvImport.mockResolvedValue({ success: true, jobId: "retry-job-1", created: 1, errors: 0, durationMs: 42 });
    emitProductTelemetryEvent.mockResolvedValue(undefined);
    recordV10AuditEvent.mockResolvedValue("audit-1");
    refreshV10ReadModelsForOrganization.mockResolvedValue({ ok: true, counts: {} });
  });

  it("returns 401 when unauthenticated", async () => {
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });
    createAdminClient.mockResolvedValue({ from: vi.fn() });

    const { GET } = await import("@/app/api/import/contracts/[jobId]/route");
    const res = await GET(new Request("http://localhost:3000/api/import/contracts/abc"), {
      params: Promise.resolve({ jobId: "abc" }),
    });
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body).toEqual({ error: "Not authenticated" });
  });

  it("rejects retries unless the import is V10 failed_retryable or partial with retryable rows", async () => {
    loadRetryableImportRows.mockResolvedValueOnce({
      status: "queued",
      rows: [{ title: "Retry row" }],
      supersededByJobId: null,
    });

    const { POST } = await import("@/app/api/import/contracts/[jobId]/route");
    const res = await POST(
      new Request("http://localhost:3000/api/import/contracts/job-1", {
        method: "POST",
        headers: { "x-idempotency-key": "retry-key-12345678" },
      }),
      { params: Promise.resolve({ jobId: "job-1" }) }
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.v10.outcome).toBe("job_not_retryable");
    expect(body.v10.diagnostic_id).toBe("v10_import_retry_status_not_retryable");
    expect(runContractCsvImport).not.toHaveBeenCalled();
    expect(emitProductTelemetryEvent).not.toHaveBeenCalled();
  });
});