import { beforeEach, describe, expect, it, vi } from "vitest";

const scheduledAfterCallbacks: Array<() => unknown | Promise<unknown>> = [];
const afterMock = vi.fn((callback: () => unknown | Promise<unknown>) => {
  scheduledAfterCallbacks.push(callback);
});
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

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: (callback: () => unknown | Promise<unknown>) => afterMock(callback),
  };
});

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
    scheduledAfterCallbacks.length = 0;
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

  it("exports owner emails only from the selected workspace membership", async () => {
    const orgId = "550e8400-e29b-41d4-a716-446655440001";
    const eqLog: Array<{ table: string; col: string; val: string }> = [];
    const inLog: Array<{ table: string; col: string; vals: string[] }> = [];

    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    });
    createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "organization_members") {
          return {
            select: vi.fn((selection?: string) => {
              if (selection === "organization_id, role") {
                return {
                  eq: vi.fn(() => ({
                    order: vi.fn().mockResolvedValue({
                      data: [{ organization_id: orgId, role: "editor" }],
                      error: null,
                    }),
                  })),
                };
              }
              if (selection === "user_id") {
                return {
                  eq: vi.fn((col: string, val: string) => {
                    eqLog.push({ table, col, val });
                    return {
                      in: vi.fn(async (inCol: string, vals: string[]) => {
                        inLog.push({ table, col: inCol, vals });
                        return {
                          data: [{ user_id: "owner-1" }],
                          error: null,
                        };
                      }),
                    };
                  }),
                };
              }
              throw new Error(`Unexpected organization_members selection ${selection}`);
            }),
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
        if (table === "profiles") {
          return {
            select: vi.fn(() => ({
              in: vi.fn(async (col: string, vals: string[]) => {
                inLog.push({ table, col, vals });
                return {
                  data: vals.includes("owner-1")
                    ? [{ id: "owner-1", full_name: null, email: "owner@workspace.test" }]
                    : [],
                  error: null,
                };
              }),
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
          title: "Scoped Export",
          counterparty: "Acme",
          contract_type: "msa",
          status: "active",
          region: "NA",
          owner_id: "owner-1",
          created_at: "2026-04-17T00:00:00.000Z",
          extracted_fields: [],
        },
        {
          id: "contract-2",
          title: "Unmatched Owner",
          counterparty: "Beta",
          contract_type: "nda",
          status: "active",
          region: "EU",
          owner_id: "owner-2",
          created_at: "2026-04-18T00:00:00.000Z",
          extracted_fields: [],
        },
      ],
      error: null,
      truncated: false,
    });

    const { GET } = await import("@/app/api/export/contracts/route");
    const res = await GET(new Request(`http://localhost:3000/api/export/contracts?orgId=${orgId}`));

    expect(res.status).toBe(200);
    expect(eqLog).toContainEqual({ table: "organization_members", col: "organization_id", val: orgId });
    expect(inLog).toContainEqual({ table: "organization_members", col: "user_id", vals: ["owner-1", "owner-2"] });
    const body = await res.text();
    const rows = body.trim().split(/\r?\n/);
    expect(rows[1]).toContain("owner@workspace.test");
    expect(rows[2]).toContain(",,2026-04-18T00:00:00.000Z");
  });

  it("includes fee_reference and payment_cadence columns for advanced workspace exports", async () => {
    const exportJobId = "export-job-adv";
    const exportJobInserts: Array<Record<string, unknown>> = [];
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
            insert: vi.fn((payload: Record<string, unknown>) => {
              exportJobInserts.push(payload);
              return {
              select: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: exportJobId }, error: null }),
              })),
              };
            }),
            update: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ error: null }),
            })),
          };
        }
        if (table === "contracts") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
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
    expect(exportJobInserts).toContainEqual(
      expect.objectContaining({
        filter_json: expect.objectContaining({ export_plan: "advanced", row_limit: 20_000 }),
      })
    );
    expect(recordV10AuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "export_job.created",
        safeMetadata: expect.objectContaining({ export_plan: "advanced", row_limit: 20_000 }),
      })
    );
  });

  it("marks truncated GET exports as partial instead of failed telemetry", async () => {
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
      new Request("http://localhost:3000/api/export/contracts?orgId=550e8400-e29b-41d4-a716-446655440001")
    );

    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.partial).toBe(true);
    expect(body.error).toContain("core plan row limit of 10000");
    expect(emitProductTelemetryEvent).not.toHaveBeenCalled();
    expect(recordV10AuditEvent).not.toHaveBeenCalled();
  });
});

describe("POST /api/export/contracts", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    scheduledAfterCallbacks.length = 0;
    rateLimitCheck.mockResolvedValue({ ok: true });
    requireApiWorkspaceEligibility.mockResolvedValue(null);
    emitProductTelemetryEvent.mockResolvedValue(undefined);
    recordV10AuditEvent.mockResolvedValue("v10-audit-1");
    refreshV10ReadModelsForOrganization.mockResolvedValue({ ok: true, counts: {} });
  });

  it("returns a queued export job when async handoff thresholds are exceeded", async () => {
    const exportJobId = "export-job-async";
    const exportJobUpdates: Array<Record<string, unknown>> = [];
    const selectedIds = Array.from({ length: 51 }, (_, index) =>
      `550e8400-e29b-41d4-a716-${String(index + 1).padStart(12, "0")}`
    );
    const exportedRows = selectedIds.map((id, index) => ({
      id,
      title: `Contract ${index + 1}`,
      counterparty: "Acme",
      contract_type: "msa",
      status: "active",
      region: "NA",
      owner_id: null,
      created_at: "2026-04-17T00:00:00.000Z",
      extracted_fields: [],
    }));

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
        if (table === "contracts") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                in: vi.fn(() => ({
                  order: vi.fn().mockResolvedValue({ data: exportedRows, error: null }),
                })),
              })),
            })),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const { POST } = await import("@/app/api/export/contracts/route");
    const res = await POST(
      new Request("http://localhost:3000/api/export/contracts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": "export-async-key",
        },
        body: JSON.stringify({
          orgId: "550e8400-e29b-41d4-a716-446655440001",
          contractIds: selectedIds,
        }),
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      success: true,
      jobId: exportJobId,
      async: true,
      v10: {
        outcome: "success",
        changed_object_type: "export_job",
        changed_object_id: exportJobId,
        next_destination_href: `/api/export/contracts/${exportJobId}`,
      },
    });
    expect(afterMock).toHaveBeenCalledTimes(1);
    expect(recordV10AuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "export_job.created", targetId: exportJobId })
    );

    await scheduledAfterCallbacks[0]?.();

    expect(exportJobUpdates).toContainEqual(expect.objectContaining({ status: "processing" }));
    expect(exportJobUpdates).toContainEqual(
      expect.objectContaining({
        status: "completed",
        selected_contract_count: 51,
        exported_rows: 51,
      })
    );
    expect(recordV10AuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "export_job.completed", targetId: exportJobId, outcome: "success" })
    );
    expect(refreshV10ReadModelsForOrganization).toHaveBeenCalledWith(
      expect.anything(),
      "550e8400-e29b-41d4-a716-446655440001",
      expect.objectContaining({ reason: "contract_export_queued" })
    );
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

