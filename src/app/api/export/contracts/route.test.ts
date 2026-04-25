import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn();
const createAdminClient = vi.fn();
const rateLimitCheck = vi.fn();
const requireApiWorkspaceEligibility = vi.fn();
const collectSupabaseRangePages = vi.fn();
const emitProductTelemetryEvent = vi.fn();

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
  emitProductTelemetryEvent,
}));

describe("GET /api/export/contracts", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    rateLimitCheck.mockResolvedValue({ ok: true });
    requireApiWorkspaceEligibility.mockResolvedValue(null);
    emitProductTelemetryEvent.mockResolvedValue(undefined);
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

  it("returns CSV for a workspace export and records telemetry", async () => {
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
    expect(emitProductTelemetryEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "product.v9.export_started" })
    );
    expect(emitProductTelemetryEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "product.v9.export_completed" })
    );
    expect(exportJobUpdates).toContainEqual(
      expect.objectContaining({ status: "completed", exported_rows: 1 })
    );
    expect(res.headers.get("x-export-job-id")).toBe(exportJobId);
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

    const { GET } = await import("@/app/api/export/contracts/route");
    const res = await GET(
      new Request(
        "http://localhost:3000/api/export/contracts?orgId=550e8400-e29b-41d4-a716-446655440001"
      )
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

    const { GET } = await import("@/app/api/export/contracts/route");
    const res = await GET(
      new Request(
        "http://localhost:3000/api/export/contracts?orgId=550e8400-e29b-41d4-a716-446655440001"
      )
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
        headers: { "content-type": "application/json" },
        body: "{not-json",
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(String(body.error)).toMatch(/valid json/i);
  });

  it("returns 400 when filter_json is not an object", async () => {
    const { POST } = await import("@/app/api/export/contracts/route");
    const res = await POST(
      new Request("http://localhost:3000/api/export/contracts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orgId: "550e8400-e29b-41d4-a716-446655440001",
          filter_json: "workspace",
        }),
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(String(body.error)).toMatch(/filter_json/i);
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
  });
});

