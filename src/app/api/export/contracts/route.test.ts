import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn();
const createAdminClient = vi.fn();
const rateLimitCheck = vi.fn();
const requireApiWorkspaceEligibility = vi.fn();
const collectSupabaseRangePages = vi.fn();
const emitProductTelemetryEvent = vi.fn();
const recordV10AuditEvent = vi.fn();
const refreshV10ReadModelsForOrganization = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient,
  createAdminClient,
}));

vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return { ...actual, rateLimitCheck };
});

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility,
}));

vi.mock("@/lib/supabase/range-pagination", () => ({
  collectSupabaseRangePages,
}));

vi.mock("@/lib/product-telemetry", () => ({
  PRODUCT_TELEMETRY_ACTIONS: [],
  emitProductTelemetryEvent,
}));

vi.mock("@/lib/v10-server-contracts", () => ({
  executeV10IdempotentResponseMutation: async (
    _admin: unknown,
    _input: unknown,
    execute: () => Promise<Response>
  ) => ({ response: await execute(), replayed: false }),
  getV10ExpectedVersionFromRequest: (request: Request) =>
    request.headers.get("x-v10-expected-version")?.trim() || request.headers.get("if-match")?.replace(/^"|"$/g, "").trim() || undefined,
  getV10IdempotencyKeyFromRequest: (request: Request) => request.headers.get("x-idempotency-key")?.trim() || null,
  recordV10AuditEvent,
}));

vi.mock("@/lib/v10-read-model-refresh", () => ({
  refreshV10ReadModelsForOrganization,
}));

describe("GET /api/export/contracts", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    rateLimitCheck.mockResolvedValue({ ok: true });
    requireApiWorkspaceEligibility.mockResolvedValue(null);
    emitProductTelemetryEvent.mockResolvedValue(undefined);
    recordV10AuditEvent.mockResolvedValue("v10-audit-1");
    refreshV10ReadModelsForOrganization.mockResolvedValue({ ok: true, counts: {} });
  });

  it("returns 429 with retry metadata when rate limited", async () => {
    rateLimitCheck.mockResolvedValue({ ok: false, retryAfterMs: 5000 });
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    });
    createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "organization_members") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn().mockResolvedValue({
                  data: [{ organization_id: "550e8400-e29b-41d4-a716-446655440001", role: "editor" }],
                  error: null,
                }),
              })),
            })),
          };
        }
        if (table === "organizations") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: { v6_org_settings_json: {} }, error: null }),
              })),
            })),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    });
    const { GET } = await import("@/app/api/export/contracts/route");
    const res = await GET(
      new Request("http://localhost:3000/api/export/contracts?orgId=550e8400-e29b-41d4-a716-446655440001")
    );
    const body = await res.json();
    expect(res.status).toBe(429);
    expect(body.kind).toBe("rate_limited");
    expect(body.retryAfterSec).toBeGreaterThanOrEqual(1);
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  it("returns 401 when unauthenticated", async () => {
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });
    createAdminClient.mockResolvedValue({ from: vi.fn() });
    const { GET } = await import("@/app/api/export/contracts/route");
    const req = new Request("http://localhost:3000/api/export/contracts");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body).toEqual({ error: "Not authenticated" });
  });

  it("keeps GET exports read-only while returning CSV", async () => {
    const exportJobId = "export-job-1";
    const exportJobUpdates: Array<Record<string, unknown>> = [];
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    });
    createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "organization_members") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn().mockResolvedValue({
                  data: [{ organization_id: "550e8400-e29b-41d4-a716-446655440001", role: "editor" }],
                  error: null,
                }),
              })),
            })),
          };
        }
        if (table === "organizations") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { v6_org_settings_json: { workspace_mode: "core" } },
                  error: null,
                }),
              })),
            })),
          };
        }
        if (table === "contract_export_jobs") {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: exportJobId }, error: null }),
              })),
            })),
            update: vi.fn((payload: Record<string, unknown>) => {
              exportJobUpdates.push(payload);
              return {
                eq: vi.fn().mockResolvedValue({ error: null }),
              };
            }),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    });
    collectSupabaseRangePages.mockResolvedValue({
      rows: [
        {
          id: "contract-1",
          title: "=SUM(1,1)",
          counterparty: "Acme",
          contract_type: "msa",
          status: "active",
          region: "NA",
          owner_id: null,
          created_at: "2026-04-17T00:00:00.000Z",
          extracted_fields: [],
        },
      ],
      error: null,
      truncated: false,
    });

    const { GET } = await import("@/app/api/export/contracts/route");
    const res = await GET(
      new Request(
        "http://localhost:3000/api/export/contracts?orgId=550e8400-e29b-41d4-a716-446655440001"
      )
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const body = await res.text();
    expect(body).toContain("'=SUM(1,1)");
    const headerLine = body.split(/\r?\n/)[0] ?? "";
    expect(headerLine).not.toContain("field_fee_reference");
    expect(headerLine).not.toContain("field_payment_cadence");
    expect(emitProductTelemetryEvent).not.toHaveBeenCalled();
    expect(exportJobUpdates).toEqual([]);
    expect(res.headers.get("x-export-job-id")).toBeNull();
  });

  it("includes fee_reference and payment_cadence columns for advanced workspace exports", async () => {
    const exportJobId = "export-job-adv";
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    });
    createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "organization_members") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn().mockResolvedValue({
                  data: [{ organization_id: "550e8400-e29b-41d4-a716-446655440001", role: "editor" }],
                  error: null,
                }),
              })),
            })),
          };
        }
        if (table === "organizations") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { v6_org_settings_json: { workspace_mode: "advanced" } },
                  error: null,
                }),
              })),
            })),
          };
        }
        if (table === "contract_export_jobs") {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: exportJobId }, error: null }),
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ error: null }),
            })),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    });
    collectSupabaseRangePages.mockResolvedValue({
      rows: [
        {
          id: "contract-1",
          title: "T",
          counterparty: "Acme",
          contract_type: "msa",
          status: "active",
          region: "NA",
          owner_id: null,
          created_at: "2026-04-17T00:00:00.000Z",
          extracted_fields: [],
        },
      ],
      error: null,
      truncated: false,
    });

    const { POST } = await import("@/app/api/export/contracts/route");
    const res = await POST(
      new Request("http://localhost:3000/api/export/contracts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": "export-partial-key",
        },
        body: JSON.stringify({ orgId: "550e8400-e29b-41d4-a716-446655440001" }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.text();
    const headerLine = body.split(/\r?\n/)[0] ?? "";
    expect(headerLine).toContain("field_fee_reference");
    expect(headerLine).toContain("field_payment_cadence");
  });

  it("marks truncated exports as partial instead of failed telemetry", async () => {
    const exportJobId = "export-job-partial";
    const exportJobUpdates: Array<Record<string, unknown>> = [];
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    });
    createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "organization_members") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn().mockResolvedValue({
                  data: [{ organization_id: "550e8400-e29b-41d4-a716-446655440001", role: "editor" }],
                  error: null,
                }),
              })),
            })),
          };
        }
        if (table === "organizations") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { v6_org_settings_json: { workspace_mode: "core" } },
                  error: null,
                }),
              })),
            })),
          };
        }
        if (table === "contract_export_jobs") {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: exportJobId }, error: null }),
              })),
            })),
            update: vi.fn((payload: Record<string, unknown>) => {
              exportJobUpdates.push(payload);
              return {
                eq: vi.fn().mockResolvedValue({ error: null }),
              };
            }),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    });
    collectSupabaseRangePages.mockResolvedValue({
      rows: [],
      error: null,
      truncated: true,
    });

    const { POST } = await import("@/app/api/export/contracts/route");
    const res = await POST(
      new Request("http://localhost:3000/api/export/contracts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": "export-partial-key",
        },
        body: JSON.stringify({ orgId: "550e8400-e29b-41d4-a716-446655440001" }),
      })
    );

    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.partial).toBe(true);
    expect(exportJobUpdates).toContainEqual(
      expect.objectContaining({ status: "partial", truncated: true })
    );
    expect(emitProductTelemetryEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "product.v9.export_partially_completed" })
    );
  });
});

describe("POST /api/export/contracts", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 400 when body is not JSON", async () => {
    const { POST } = await import("@/app/api/export/contracts/route");
    const res = await POST(
      new Request("http://localhost:3000/api/export/contracts", {
        method: "POST",
        headers: { "content-type": "application/json", "x-idempotency-key": "export_json_12345" },
        body: "{not-json",
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({
      outcome: "validation_failed",
      diagnostic_id: "v10_export_json_invalid",
    });
  });

  it("returns 400 when filter_json is not an object", async () => {
    const { POST } = await import("@/app/api/export/contracts/route");
    const res = await POST(
      new Request("http://localhost:3000/api/export/contracts", {
        method: "POST",
        headers: { "content-type": "application/json", "x-idempotency-key": "export_filter_12345" },
        body: JSON.stringify({
          orgId: "550e8400-e29b-41d4-a716-446655440001",
          filter_json: "workspace",
        }),
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({
      outcome: "validation_failed",
      diagnostic_id: "v10_export_filter_json_invalid",
    });
  });

  it("returns 400 when Content-Type is not application/json", async () => {
    const { POST } = await import("@/app/api/export/contracts/route");
    const res = await POST(
      new Request("http://localhost:3000/api/export/contracts", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: "{}",
      })
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      outcome: "validation_failed",
      diagnostic_id: "v10_export_idempotency_key_invalid",
    });
  });
});

