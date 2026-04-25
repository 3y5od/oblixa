import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn();
const createAdminClient = vi.fn();
const getDeterministicMembership = vi.fn();
const requireApiWorkspaceEligibility = vi.fn();
const rateLimitCheck = vi.fn();
const getContractsMissingCriticalFields = vi.fn();
const emitProductTelemetryEvent = vi.fn();

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
  emitProductTelemetryEvent,
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
    expect(body).toEqual({ error: "Not authenticated" });
  });

  it("records export lifecycle telemetry for review packet exports", async () => {
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    });
    createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "contract_approvals") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  limit: vi.fn().mockResolvedValue({
                    data: [
                      {
                        contract_id: "contract-1",
                        approval_type: "legal",
                        status: "pending",
                        contracts: { id: "contract-1", title: "Acme" },
                      },
                    ],
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }
        if (table === "contract_renewal_checkpoints") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  gte: vi.fn(() => ({
                    lte: vi.fn(() => ({
                      limit: vi.fn().mockResolvedValue({
                        data: [
                          {
                            contract_id: "contract-1",
                            label: "Review",
                            due_date: "2026-05-01",
                            contracts: { id: "contract-1", title: "Acme" },
                          },
                        ],
                        error: null,
                      }),
                    })),
                  })),
                })),
              })),
            })),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    getContractsMissingCriticalFields.mockResolvedValue([
      { id: "contract-1", title: "Acme", counterparty: "Acme Corp" },
    ]);

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
      from: vi.fn((table: string) => {
        if (table === "contract_approvals") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  limit: vi.fn().mockResolvedValue({
                    data: null,
                    error: { message: "boom" },
                  }),
                })),
              })),
            })),
          };
        }
        if (table === "contract_renewal_checkpoints") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  gte: vi.fn(() => ({
                    lte: vi.fn(() => ({
                      limit: vi.fn().mockResolvedValue({
                        data: [],
                        error: null,
                      }),
                    })),
                  })),
                })),
              })),
            })),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const { GET } = await import("@/app/api/export/review-packet/route");
    const res = await GET();

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Could not load approvals" });
    expect(emitProductTelemetryEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "product.v9.export_failed",
        details: expect.objectContaining({ export_type: "review_packet", reason: "approvals_query_failed" }),
      })
    );
  });
});

