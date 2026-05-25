import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn();
const createAdminClient = vi.fn();
const getDeterministicMembership = vi.fn();
const rateLimitCheck = vi.fn();
const requireApiWorkspaceEligibility = vi.fn();
const runContractCsvImport = vi.fn();
const recordV10AuditEvent = vi.fn();
const refreshV10ReadModelsForOrganization = vi.fn();
const emitV10ObjectiveTelemetryEvent = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient,
  createAdminClient,
  getDeterministicMembership,
}));

vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return { ...actual, rateLimitCheck };
});

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility,
}));

vi.mock("@/lib/import-jobs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/import-jobs")>();
  return {
    ...actual,
    runContractCsvImport,
  };
});

vi.mock("@/lib/server-contracts", () => ({
  executeV10IdempotentMutation: async (_admin: unknown, _input: unknown, execute: () => Promise<unknown>) => ({
    response: await execute(),
    replayed: false,
  }),
  getV10ExpectedVersionFromRequest: () => undefined,
  getV10IdempotencyKeyFromRequest: (request: Request) => request.headers.get("x-idempotency-key")?.trim() || null,
  recordV10AuditEvent,
}));

vi.mock("@/lib/read-model-refresh", () => ({
  refreshV10ReadModelsForOrganization,
}));

vi.mock("@/lib/product-telemetry", () => ({
  PRODUCT_TELEMETRY_ACTIONS: [],
  emitV10ObjectiveTelemetryEvent,
}));

describe("POST /api/import/contracts", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    rateLimitCheck.mockResolvedValue({ ok: true });
    requireApiWorkspaceEligibility.mockResolvedValue(null);
    runContractCsvImport.mockResolvedValue({
      success: true,
      jobId: "job_1",
      created: 1,
      errors: 0,
      durationMs: 25,
    });
    recordV10AuditEvent.mockResolvedValue("audit_1");
    refreshV10ReadModelsForOrganization.mockResolvedValue({ ok: true });
    emitV10ObjectiveTelemetryEvent.mockResolvedValue(undefined);
  });

  it("returns 401 when unauthenticated", async () => {
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });
    createAdminClient.mockResolvedValue({ from: vi.fn() });
    const { POST } = await import("@/app/api/import/contracts/route");
    const req = new Request("http://localhost:3000/api/import/contracts", {
      method: "POST",
      headers: { "content-type": "text/csv" },
      body: "title\nA",
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body).toMatchObject({ error: "Unauthorized", code: "unauthorized" });
  });

  it("returns 429 when rate limited", async () => {
    rateLimitCheck.mockResolvedValue({ ok: false, retryAfterMs: 4000 });
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
    });
    createAdminClient.mockResolvedValue({ from: vi.fn() });
    const { POST } = await import("@/app/api/import/contracts/route");
    const req = new Request("http://localhost:3000/api/import/contracts", {
      method: "POST",
      headers: { "content-type": "text/csv" },
      body: "title\nA",
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  it("returns 400 when authenticated but Content-Type is not CSV or JSON", async () => {
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
    });
    createAdminClient.mockResolvedValue({ from: vi.fn() });
    const { POST } = await import("@/app/api/import/contracts/route");
    const req = new Request("http://localhost:3000/api/import/contracts", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "nope",
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body).toMatchObject({ error: "Expected CSV or JSON import body." });
  });

  it("requires JSON imports to include csv or rows", async () => {
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
    });
    createAdminClient.mockResolvedValue({ from: vi.fn() });
    getDeterministicMembership.mockResolvedValue({ organization_id: "org_1", role: "admin" });
    const { POST } = await import("@/app/api/import/contracts/route");
    const req = new Request("http://localhost:3000/api/import/contracts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contracts: [] }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body).toMatchObject({ error: "JSON import body must include csv or rows." });
  });

  it("returns V10 validation failures for imports missing required columns", async () => {
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
    });
    createAdminClient.mockResolvedValue({ from: vi.fn() });
    getDeterministicMembership.mockResolvedValue({ organization_id: "org_1", role: "admin" });
    const { POST } = await import("@/app/api/import/contracts/route");
    const req = new Request("http://localhost:3000/api/import/contracts", {
      method: "POST",
      headers: { "content-type": "text/csv" },
      body: "title\nA",
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.v10 ?? body.details?.v10 ?? body).toMatchObject({
      outcome: "validation_failed",
      diagnostic_id: "v10_import_validation_failed",
      validation_failures: expect.arrayContaining([
        expect.objectContaining({ field: "counterparty", code: "required_column" }),
      ]),
    });
  });

  it("returns V10 validation failures for duplicate import records", async () => {
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
    });
    createAdminClient.mockResolvedValue({ from: vi.fn() });
    getDeterministicMembership.mockResolvedValue({ organization_id: "org_1", role: "admin" });
    const { POST } = await import("@/app/api/import/contracts/route");
    const req = new Request("http://localhost:3000/api/import/contracts", {
      method: "POST",
      headers: { "content-type": "text/csv" },
      body: "title,counterparty,effective_date\nMSA,Acme,2026-01-01\nMSA,Acme,2026-01-01",
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.v10 ?? body.details?.v10 ?? body).toMatchObject({
      outcome: "validation_failed",
      diagnostic_id: "v10_import_validation_failed",
      validation_failures: expect.arrayContaining([
        expect.objectContaining({ field: "rows", code: "duplicate_records" }),
      ]),
    });
  });

  it("rejects imports at the parsed row ceiling before creating trusted records", async () => {
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
    });
    createAdminClient.mockResolvedValue({ from: vi.fn() });
    getDeterministicMembership.mockResolvedValue({ organization_id: "org_1", role: "admin" });
    const { POST } = await import("@/app/api/import/contracts/route");
    const rows = Array.from({ length: 10_000 }, (_, index) => `MSA ${index},Acme ${index}`);
    const req = new Request("http://localhost:3000/api/import/contracts", {
      method: "POST",
      headers: { "content-type": "text/csv" },
      body: ["title,counterparty", ...rows].join("\n"),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.v10 ?? body.details?.v10 ?? body).toMatchObject({
      outcome: "validation_failed",
      validation_failures: expect.arrayContaining([
        expect.objectContaining({ field: "rows", code: "too_many_rows" }),
      ]),
    });
    expect(runContractCsvImport).not.toHaveBeenCalled();
  });

  it("emits V10 activation telemetry for successful contract imports", async () => {
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
    });
    createAdminClient.mockResolvedValue({ from: vi.fn() });
    getDeterministicMembership.mockResolvedValue({ organization_id: "org_1", role: "admin" });
    const { POST } = await import("@/app/api/import/contracts/route");
    const req = new Request("http://localhost:3000/api/import/contracts", {
      method: "POST",
      headers: { "content-type": "text/csv; charset=utf-8", "x-idempotency-key": "import-key-1" },
      body: "title,counterparty\nMSA,Acme",
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.v10 ?? body).toMatchObject({
      outcome: "success",
      changed_object_type: "import_job",
      changed_object_id: "job_1",
      audit_event_id: "audit_1",
    });
    expect(emitV10ObjectiveTelemetryEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        objectiveKey: "activation",
        action: "product.v10.activation_completed",
        details: expect.objectContaining({
          intake_surface: "contract_import",
          row_count: 1,
          created_count: 1,
          error_count: 0,
          audit_confirmed: true,
        }),
      })
    );
    expect(emitV10ObjectiveTelemetryEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "product.v10.import_extraction_failure_rate_sampled",
        details: expect.objectContaining({ failure_rate_basis_points: 0 }),
      })
    );
    expect(refreshV10ReadModelsForOrganization).toHaveBeenCalledWith(
      expect.anything(),
      "org_1",
      expect.objectContaining({
        refreshScope: "one_model",
        reason: "contract_import_mutation",
        modelKeys: expect.arrayContaining(["activation_state", "work_items", "job_run_visibility", "command_search_index"]),
      })
    );
  });
});

