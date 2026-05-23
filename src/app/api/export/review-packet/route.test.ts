import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn();
const createAdminClient = vi.fn();
const getDeterministicMembership = vi.fn();
const requireApiWorkspaceEligibility = vi.fn();
const rateLimitCheck = vi.fn();
const getContractsMissingCriticalFields = vi.fn();
const emitProductTelemetryEvent = vi.fn();
const collectSupabaseRangePages = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient,
  createAdminClient,
  getDeterministicMembership,
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility,
}));

vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return { ...actual, rateLimitCheck };
});

vi.mock("@/lib/missing-critical-fields", () => ({
  getContractsMissingCriticalFields,
}));

vi.mock("@/lib/product-telemetry", () => ({
  PRODUCT_TELEMETRY_ACTIONS: [],
  emitProductTelemetryEvent,
}));

vi.mock("@/lib/supabase/range-pagination", () => ({
  collectSupabaseRangePages,
}));

describe("GET /api/export/review-packet", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireApiWorkspaceEligibility.mockResolvedValue(null);
    rateLimitCheck.mockResolvedValue({ ok: true, retryAfterMs: 0 });
    getDeterministicMembership.mockResolvedValue({
      organization_id: "550e8400-e29b-41d4-a716-446655440001",
      role: "editor",
    });
    getContractsMissingCriticalFields.mockResolvedValue([]);
    emitProductTelemetryEvent.mockResolvedValue(undefined);
    collectSupabaseRangePages.mockResolvedValue({ rows: [], error: null, truncated: false, nextOffset: null });
  });

  it("returns 401 when unauthenticated", async () => {
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });
    createAdminClient.mockResolvedValue({ from: vi.fn() });
    const { GET } = await import("@/app/api/export/review-packet/route");
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body).toMatchObject({ error: "Unauthorized", code: "unauthorized" });
  });

  it("records export lifecycle telemetry for review packet exports", async () => {
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    });
    createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => ({ table })),
    });

    getContractsMissingCriticalFields.mockResolvedValue([
      { id: "contract-1", title: "Acme", counterparty: "Acme Corp" },
    ]);
    collectSupabaseRangePages
      .mockResolvedValueOnce({
        rows: [
          {
            contract_id: "contract-1",
            approval_type: "legal",
            status: "pending",
            contracts: { id: "contract-1", title: "Acme" },
          },
        ],
        error: null,
        truncated: false,
        nextOffset: null,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            contract_id: "contract-1",
            label: "Review",
            due_date: "2026-05-01",
            contracts: { id: "contract-1", title: "Acme" },
          },
        ],
        error: null,
        truncated: false,
        nextOffset: null,
      });

    const { GET } = await import("@/app/api/export/review-packet/route");
    const res = await GET();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const body = await res.text();
    expect(body).toContain("exceptions,contract-1,Acme,missing_critical_fields,Acme Corp");
    expect(emitProductTelemetryEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "product.v9.export_started",
        details: expect.objectContaining({ export_type: "review_packet" }),
      })
    );
    expect(emitProductTelemetryEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "product.v9.export_completed",
        details: expect.objectContaining({
          export_type: "review_packet",
          missing_critical_count: 1,
          pending_approvals_count: 1,
          renewal_checkpoint_count: 1,
        }),
      })
    );
  });

  it("maps query failures to export_failed telemetry", async () => {
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    });
    createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => ({ table })),
    });
    collectSupabaseRangePages
      .mockResolvedValueOnce({ rows: [], error: { message: "boom" }, truncated: false, nextOffset: 0 })
      .mockResolvedValueOnce({ rows: [], error: null, truncated: false, nextOffset: null });

    const { GET } = await import("@/app/api/export/review-packet/route");
    const res = await GET();

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({ error: "Could not load approvals" });
    expect(emitProductTelemetryEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "product.v9.export_failed",
        details: expect.objectContaining({ export_type: "review_packet", reason: "approvals_query_failed" }),
      })
    );
  });

  it("returns 413 when paged review-packet data exceeds the row budget", async () => {
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    });
    createAdminClient.mockResolvedValue({ from: vi.fn((table: string) => ({ table })) });
    collectSupabaseRangePages
      .mockResolvedValueOnce({ rows: [], error: null, truncated: true, nextOffset: 5000 })
      .mockResolvedValueOnce({ rows: [], error: null, truncated: false, nextOffset: null });

    const { GET } = await import("@/app/api/export/review-packet/route");
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(413);
    expect(body).toMatchObject({
      error: expect.any(String),
      diagnostic_id: "review_packet_row_budget_exceeded",
    });
    expect(emitProductTelemetryEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "product.v9.export_partially_completed",
        details: expect.objectContaining({ reason: "row_budget_exceeded", approvals_truncated: true }),
      })
    );
  });
});

