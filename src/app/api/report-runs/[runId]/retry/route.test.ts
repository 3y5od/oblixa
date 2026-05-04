import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn();
const createAdminClient = vi.fn();
const requireApiWorkspaceEligibility = vi.fn();
const emitProductTelemetryEvent = vi.fn();
const rateLimitCheck = vi.fn();
const executeV10IdempotentMutation = vi.fn(
  async (_admin: unknown, _input: unknown, execute: () => Promise<unknown>) => ({ response: await execute(), replayed: false })
);
const recordV10AuditEvent = vi.fn();
const runSingleReportPackGeneration = vi.fn();

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

vi.mock("@/lib/product-telemetry", () => ({
  emitProductTelemetryEvent,
}));

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: { reportRunRetryMutation: { max: 20, windowMs: 60_000 } },
  rateLimitCheck,
}));

vi.mock("@/lib/v10-server-contracts", () => ({
  executeV10IdempotentMutation,
  getV10ExpectedVersionFromRequest: (request: Request) =>
    request.headers.get("x-v10-expected-version")?.trim() || request.headers.get("if-match")?.replace(/^"|"$/g, "").trim() || undefined,
  getV10IdempotencyKeyFromRequest: (request: Request) => request.headers.get("x-idempotency-key")?.trim() || null,
  recordV10AuditEvent,
}));

vi.mock("@/app/api/cron/v4/report-packs-generate/route", () => ({
  runSingleReportPackGeneration,
}));

describe("POST /api/report-runs/[runId]/retry", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireApiWorkspaceEligibility.mockResolvedValue(null);
    emitProductTelemetryEvent.mockResolvedValue(undefined);
    rateLimitCheck.mockResolvedValue({ ok: true });
    recordV10AuditEvent.mockResolvedValue("v10-audit-1");
    runSingleReportPackGeneration.mockResolvedValue({
      generated: true,
      subscriptionEmailsSent: 0,
      reportRunId: "run-1",
      reportPackRunId: "pack-run-1",
      failureOutcome: undefined,
      failureDiagnosticId: null,
      failureMessage: null,
    });
  });

  it("retries report-pack backed failed runs", async () => {
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
        if (table === "report_runs") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: "run-1",
                      status: "failed",
                      report_mode: "management",
                      error_summary: "Pack generation failed",
                      metrics_json: { report_pack_id: "pack-1" },
                    },
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }
        if (table === "report_packs") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: "pack-1",
                      organization_id: "550e8400-e29b-41d4-a716-446655440001",
                      report_type: "contract_portfolio_summary",
                      name: "Portfolio pack",
                      delivery_json: {},
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

    const { POST } = await import("@/app/api/report-runs/[runId]/retry/route");
    const res = await POST(
      new Request("http://localhost/api/report-runs/run-1/retry", {
        method: "POST",
        headers: {
          "x-idempotency-key": "report_retry_12345",
          "x-v10-expected-version": "run-1",
        },
      }),
      { params: Promise.resolve({ runId: "run-1" }) }
    );

    expect(res.status).toBe(200);
    expect(runSingleReportPackGeneration).toHaveBeenCalledWith(
      expect.objectContaining({ existingReportRunId: "run-1", actorUserId: "user-1", actorType: "user" })
    );
    expect(recordV10AuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "report_run.retry_requested", targetType: "report_run", targetId: "run-1" })
    );
    expect(emitProductTelemetryEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "product.v10.failed_job_retry_succeeded" })
    );
    expect(await res.json()).toMatchObject({
      success: true,
      retriedJobId: "run-1",
      reportPackId: "pack-1",
      reportPackRunId: "pack-run-1",
      v10: { outcome: "success", changed_object_type: "report_run", changed_object_id: "run-1" },
    });
  });

  it("returns 409 when the report run is not backed by a report pack", async () => {
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
        if (table === "report_runs") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: "run-2",
                      status: "failed",
                      report_mode: "saved_view",
                      error_summary: "No recipients configured",
                      metrics_json: {},
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

    const { POST } = await import("@/app/api/report-runs/[runId]/retry/route");
    const res = await POST(
      new Request("http://localhost/api/report-runs/run-2/retry", {
        method: "POST",
        headers: {
          "x-idempotency-key": "report_retry_67890",
          "x-v10-expected-version": "run-2",
        },
      }),
      { params: Promise.resolve({ runId: "run-2" }) }
    );

    expect(res.status).toBe(409);
    expect(runSingleReportPackGeneration).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.v10).toMatchObject({ outcome: "job_not_retryable", diagnostic_id: "v10_report_retry_missing_report_pack" });
  });

  it("returns 429 when rate limited", async () => {
    rateLimitCheck.mockResolvedValue({ ok: false, retryAfterMs: 5_000 });
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    });

    const { POST } = await import("@/app/api/report-runs/[runId]/retry/route");
    const res = await POST(
      new Request("http://localhost/api/report-runs/run-3/retry", {
        method: "POST",
        headers: {
          "x-idempotency-key": "report_retry_rate_limited",
          "x-v10-expected-version": "run-3",
        },
      }),
      { params: Promise.resolve({ runId: "run-3" }) }
    );

    expect(res.status).toBe(429);
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(res.headers.get("Retry-After")).toBe("5");
    await expect(res.json()).resolves.toMatchObject({
      error: "Too many requests",
      code: "rate_limited",
      diagnostic_id: "route_rate_limited",
      route: "/api/report-runs/[runId]/retry",
    });
  });
});