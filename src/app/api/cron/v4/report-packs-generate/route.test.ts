import { beforeEach, describe, expect, it, vi } from "vitest";

const gateCronRequest = vi.fn();
const rateLimitCheck = vi.fn();
const getOrgSettingsJson = vi.fn();
const cronMatchesUtc = vi.fn();
const computeReportPackMetrics = vi.fn();
const extractPriorKpis = vi.fn();
const recordAutomationEvent = vi.fn();
const recordV10AuditEvent = vi.fn();
const refreshV10ReadModelsForOrganization = vi.fn();

vi.mock("@/lib/security/cron-route-gate", () => ({
  gateCronRequest,
}));

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: { v4ReportPacksCron: { max: 60, windowMs: 60_000 } },
  rateLimitCheck,
}));

vi.mock("@/lib/contract-operations/cron-schedule", () => ({
  cronMatchesUtc: (...args: unknown[]) => cronMatchesUtc(...args),
}));

vi.mock("@/lib/assurance/org-settings", () => ({
  getOrgSettingsJson: (...args: unknown[]) => getOrgSettingsJson(...args),
}));

vi.mock("@/lib/contract-operations/report-pack-metrics", () => ({
  computeReportPackMetrics: (...args: unknown[]) => computeReportPackMetrics(...args),
  extractPriorKpis: (...args: unknown[]) => extractPriorKpis(...args),
}));

vi.mock("@/lib/contract-operations/automation-audit", () => ({
  recordAutomationEvent: (...args: unknown[]) => recordAutomationEvent(...args),
}));

vi.mock("@/lib/server-contracts", () => ({
  recordV10AuditEvent: (...args: unknown[]) => recordV10AuditEvent(...args),
}));

vi.mock("@/lib/read-model-refresh", () => ({
  refreshV10ReadModelsForOrganization: (...args: unknown[]) => refreshV10ReadModelsForOrganization(...args),
}));

const createAdminClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: (...args: unknown[]) => createAdminClient(...args),
}));

describe("GET /api/cron/v4/report-packs-generate", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    gateCronRequest.mockReturnValue(null);
    rateLimitCheck.mockResolvedValue({ ok: true });
    cronMatchesUtc.mockReturnValue(true);
    getOrgSettingsJson.mockResolvedValue({
      workspace_mode: "core",
      advanced_modules_hidden: [],
      assurance_modules_hidden: [],
      utility_modules_hidden: [],
      search_scope: "match_mode",
    });
    createAdminClient.mockReset();
    computeReportPackMetrics.mockResolvedValue({ generated_at: "2026-04-26T20:00:00.000Z", report_type: "contract_portfolio_summary" });
    extractPriorKpis.mockReturnValue({});
    recordAutomationEvent.mockResolvedValue(undefined);
    recordV10AuditEvent.mockResolvedValue("v10-audit-1");
    refreshV10ReadModelsForOrganization.mockResolvedValue({ ok: true, counts: {} });
  });

  it("returns unauthorized response from cron guard", async () => {
    gateCronRequest.mockReturnValueOnce(new Response("Unauthorized", { status: 401 }));
    const { GET } = await import("@/app/api/cron/v4/report-packs-generate/route");
    const res = await GET(new Request("http://localhost:3000/api/cron/v4/report-packs-generate"));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate-limited", async () => {
    rateLimitCheck.mockResolvedValueOnce({ ok: false, retryAfterMs: 2500 });
    const { GET } = await import("@/app/api/cron/v4/report-packs-generate/route");
    const res = await GET(new Request("http://localhost:3000/api/cron/v4/report-packs-generate"));
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({
      ok: false,
      error: "Too many requests",
      code: "rate_limited",
      retryAfterMs: 2500,
    });
  });

  it("skips advanced report packs when org workspace mode is Core (V7)", async () => {
    const from = vi.fn((table: string) => {
      if (table === "report_packs") {
        return {
          select: () => ({
            eq: () => ({
              limit: () =>
                Promise.resolve({
                  data: [
                    {
                      id: "pack-1",
                      organization_id: "org-1",
                      report_type: "decision_queue_summary",
                      name: "Q",
                      schedule: "0 9 * * *",
                      delivery_json: {},
                    },
                  ],
                }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }),
              }),
            }),
          }),
        }),
        insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: "run-1" }, error: null }) }) }),
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      };
    });
    createAdminClient.mockResolvedValue({ from });

    const { GET } = await import("@/app/api/cron/v4/report-packs-generate/route");
    const res = await GET(new Request("http://localhost:3000/api/cron/v4/report-packs-generate"));
    expect(res.status).toBe(207);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, partial: true });
    expect(body.generated).toBe(0);
    expect(body.subscriptionEmailsSent).toBe(0);
    expect(body.error_details).toEqual([
      expect.objectContaining({ diagnostic_id: "v10_report_pack_retry_mode_required" }),
    ]);
    expect(refreshV10ReadModelsForOrganization).not.toHaveBeenCalled();
  });

  it("refreshes V10 read models after a report run is generated", async () => {
    const reportRunInserts: Array<Record<string, unknown>> = [];
    const reportRunUpdates: Array<Record<string, unknown>> = [];
    const from = vi.fn((table: string) => {
      if (table === "report_packs") {
        return {
          select: () => ({
            eq: () => ({
              limit: () =>
                Promise.resolve({
                  data: [
                    {
                      id: "pack-1",
                      organization_id: "org-1",
                      report_type: "contract_portfolio_summary",
                      name: "Portfolio",
                      schedule: "0 9 * * *",
                      delivery_json: {},
                    },
                  ],
                }),
            }),
          }),
        };
      }
      if (table === "report_pack_runs") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => ({
                    limit: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }),
                  }),
                }),
              }),
            }),
          }),
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: { id: "run-1" }, error: null }),
            }),
          }),
        };
      }
      if (table === "report_runs") {
        return {
          insert: vi.fn((payload: Record<string, unknown>) => {
            reportRunInserts.push(payload);
            return {
              select: () => ({
                maybeSingle: () => Promise.resolve({ data: { id: "report-run-1" }, error: null }),
              }),
            };
          }),
          update: vi.fn((payload: Record<string, unknown>) => {
            reportRunUpdates.push(payload);
            return {
              eq: () => Promise.resolve({ error: null }),
            };
          }),
        };
      }
      if (table === "report_pack_subscriptions") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => Promise.resolve({ data: [] }),
              }),
            }),
          }),
        };
      }
      return {
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      };
    });
    createAdminClient.mockResolvedValue({ from });

    const { GET } = await import("@/app/api/cron/v4/report-packs-generate/route");
    const res = await GET(new Request("http://localhost:3000/api/cron/v4/report-packs-generate"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.generated).toBe(1);
    expect(reportRunInserts).toContainEqual(
      expect.objectContaining({ report_mode: "contract_portfolio_summary", status: "running" })
    );
    expect(reportRunUpdates).toContainEqual(expect.objectContaining({ status: "succeeded" }));
    expect(recordV10AuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "report_run.created", targetType: "report_run" })
    );
    expect(recordV10AuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "report_run.completed", targetType: "report_run", outcome: "success" })
    );
    expect(recordAutomationEvent).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "org-1" }));
    expect(refreshV10ReadModelsForOrganization).toHaveBeenCalledWith(
      expect.anything(),
      "org-1",
      expect.objectContaining({
        refreshScope: "one_model",
        reason: "report_pack_generation_cron",
        modelKeys: expect.arrayContaining(["report_run_visibility", "job_run_visibility", "command_search_index"]),
      })
    );
    expect(reportRunInserts).toContainEqual(
      expect.objectContaining({
        metrics_json: expect.objectContaining({
          source: "report_pack_generation_cron",
          schedule_slot: expect.any(String),
          report_pack_id: "pack-1",
        }),
      })
    );
  });

  it("skips duplicate cron report-pack runs when the slot was already claimed", async () => {
    const from = vi.fn((table: string) => {
      if (table === "report_packs") {
        return {
          select: () => ({
            eq: () => ({
              limit: () =>
                Promise.resolve({
                  data: [
                    {
                      id: "pack-1",
                      organization_id: "org-1",
                      report_type: "contract_portfolio_summary",
                      name: "Portfolio",
                      schedule: "0 9 * * *",
                      delivery_json: {},
                    },
                  ],
                }),
            }),
          }),
        };
      }
      if (table === "report_pack_runs") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => ({
                    limit: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }),
                  }),
                }),
              }),
            }),
          }),
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: { id: "pack-run-1" }, error: null }),
            }),
          }),
        };
      }
      if (table === "report_runs") {
        return {
          insert: () => ({
            select: () => ({
              maybeSingle: () => Promise.resolve({ data: null, error: { code: "23505", message: "duplicate slot" } }),
            }),
          }),
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        };
      }
      if (table === "report_pack_subscriptions") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => Promise.resolve({ data: [] }),
              }),
            }),
          }),
        };
      }
      return {
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      };
    });
    createAdminClient.mockResolvedValue({ from });

    const { GET } = await import("@/app/api/cron/v4/report-packs-generate/route");
    const res = await GET(new Request("http://localhost:3000/api/cron/v4/report-packs-generate"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ generated: 0, duplicateSkipped: 1, errors_count: 0 });
    expect(recordV10AuditEvent).not.toHaveBeenCalled();
    expect(recordAutomationEvent).not.toHaveBeenCalled();
    expect(refreshV10ReadModelsForOrganization).not.toHaveBeenCalled();
  });
});
