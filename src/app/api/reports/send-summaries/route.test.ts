import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const forEachSupabaseRangePageMock = vi.fn();
const rateLimitCheckMock = vi.fn();
const pingCronHealthcheckMock = vi.fn();
const getOrgSettingsJsonMock = vi.fn();
const isNotificationAllowedMock = vi.fn();
const recordV10AuditEventMock = vi.fn();
const emitProductTelemetryEventMock = vi.fn();
const refreshV10ReadModelsForOrganizationMock = vi.fn();

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
  count?: number | null;
};

type AwaitableQueryChain = PromiseLike<QueryResult> & {
  eq: () => AwaitableQueryChain;
  in: () => AwaitableQueryChain;
  order: () => AwaitableQueryChain;
  limit: () => AwaitableQueryChain;
  lte: () => AwaitableQueryChain;
  maybeSingle: () => Promise<QueryResult>;
};

type InsertResult = { data: unknown; error: { message: string } | null };

type InsertChain = PromiseLike<InsertResult> & {
  select: () => { maybeSingle: () => Promise<InsertResult> };
};

type UpdateChain = PromiseLike<InsertResult> & {
  eq: () => UpdateChain;
};

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

function createAwaitableChain(result: QueryResult) {
  const normalized = { data: result.data ?? null, error: result.error ?? null, count: result.count ?? null };
  const promise = Promise.resolve(normalized);
  const chain: AwaitableQueryChain = {
    eq: () => chain,
    in: () => chain,
    order: () => chain,
    limit: () => chain,
    lte: () => chain,
    maybeSingle: async () => normalized,
    then: promise.then.bind(promise),
  };
  return chain;
}

function createInsertChain(result: QueryResult) {
  const normalized = { data: result.data ?? null, error: result.error ?? null };
  const promise = Promise.resolve(normalized);
  const chain: InsertChain = {
    select: () => ({ maybeSingle: async () => ({ data: result.data ?? null, error: result.error ?? null }) }),
    then: promise.then.bind(promise),
  };
  return chain;
}

function createUpdateChain(result: QueryResult) {
  const normalized = { data: result.data ?? null, error: result.error ?? null };
  const promise = Promise.resolve(normalized);
  const chain: UpdateChain = {
    eq: () => chain,
    then: promise.then.bind(promise),
  };
  return chain;
}

function createAdminMock() {
  const selectQueues: Record<string, QueryResult[]> = {
    profiles: [{ data: [], error: null }],
  };
  const insertQueues: Record<string, QueryResult[]> = {
    report_runs: [{ data: { id: "run-1" }, error: null }],
  };
  const updateQueues: Record<string, QueryResult[]> = {
    report_runs: [{ data: null, error: null }],
  };
  return {
    from(table: string) {
      return {
        select() {
          const next = selectQueues[table]?.shift() ?? { data: [], error: null };
          return createAwaitableChain(next);
        },
        insert() {
          const next = insertQueues[table]?.shift() ?? { data: null, error: null };
          return createInsertChain(next);
        },
        update() {
          const next = updateQueues[table]?.shift() ?? { data: null, error: null };
          return createUpdateChain(next);
        },
      };
    },
  };
}

vi.mock("@/lib/supabase/range-pagination", () => ({
  forEachSupabaseRangePage: forEachSupabaseRangePageMock,
}));

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: { reportsSummariesCron: { max: 60, windowMs: 60_000 } },
  rateLimitCheck: rateLimitCheckMock,
}));

vi.mock("@/lib/observability/cron-healthcheck", () => ({
  pingCronHealthcheck: pingCronHealthcheckMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(async () => createAdminMock()),
}));

vi.mock("@/lib/assurance/org-settings", () => ({
  getOrgSettingsJson: getOrgSettingsJsonMock,
}));

vi.mock("@/lib/notification-policy", () => ({
  isNotificationAllowed: isNotificationAllowedMock,
}));

vi.mock("@/lib/server-contracts", () => ({
  recordV10AuditEvent: recordV10AuditEventMock,
}));

vi.mock("@/lib/product-telemetry", () => ({
  emitProductTelemetryEvent: emitProductTelemetryEventMock,
}));

vi.mock("@/lib/read-model-refresh", () => ({
  refreshV10ReadModelsForOrganization: refreshV10ReadModelsForOrganizationMock,
}));

describe("GET /api/reports/send-summaries", () => {
  const originalCronSecret = process.env.CRON_SECRET;
  const originalResendApiKey = process.env.RESEND_API_KEY;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    restoreEnv("CRON_SECRET", originalCronSecret);
    restoreEnv("RESEND_API_KEY", originalResendApiKey ?? "re_test_key");
    if (originalNodeEnv !== undefined) {
      vi.stubEnv("NODE_ENV", originalNodeEnv);
    }
    restoreEnv("NEXT_PUBLIC_APP_URL", originalAppUrl ?? "https://app.oblixa.test");
    forEachSupabaseRangePageMock.mockReset();
    rateLimitCheckMock.mockReset();
    pingCronHealthcheckMock.mockReset();
    getOrgSettingsJsonMock.mockReset();
    isNotificationAllowedMock.mockReset();
    recordV10AuditEventMock.mockReset();
    emitProductTelemetryEventMock.mockReset();
    refreshV10ReadModelsForOrganizationMock.mockReset();
    rateLimitCheckMock.mockResolvedValue({ ok: true });
    getOrgSettingsJsonMock.mockResolvedValue({ workspace_mode: "advanced" });
    isNotificationAllowedMock.mockResolvedValue(true);
    recordV10AuditEventMock.mockResolvedValue("audit-1");
    emitProductTelemetryEventMock.mockResolvedValue(true);
    refreshV10ReadModelsForOrganizationMock.mockResolvedValue({ ok: true, diagnostics: { refresh_job_id: "job-1" } });
    forEachSupabaseRangePageMock.mockImplementation(async (_fetchPage, consume) => {
      await consume([
        {
          id: "sub-1",
          saved_view_id: "view-1",
          user_id: "user-1",
          organization_id: "org-1",
          frequency: "weekly",
          next_run_at: "2026-01-01T00:00:00.000Z",
          recipient_emails: [],
          saved_views: { id: "view-1", name: "My tasks", view_type: "tasks", query_json: {} },
        },
      ]);
      return { error: null, stoppedByOffsetCap: true, rowsSeen: 100, nextOffset: 100 };
    });
  });

  it("returns 503 when CRON_SECRET is missing", async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await import("@/app/api/reports/send-summaries/route");
    const req = new Request("http://localhost:3000/api/reports/send-summaries");

    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body.code).toBe("cron_secret_missing");
  });

  it("returns 503 dependency_blocked when canonical app url is unavailable", async () => {
    process.env.CRON_SECRET = "cronsecret";
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.APP_BASE_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    const { GET } = await import("@/app/api/reports/send-summaries/route");
    const req = new Request("http://localhost:3000/api/reports/send-summaries", {
      headers: { "x-cron-secret": "cronsecret" },
    });

    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body).toMatchObject({
      code: "dependency_blocked",
      diagnostic_id: "report_summaries_canonical_app_url_missing",
      phase: "dependency_preflight",
    });
  });

  it("returns 207 when the paged scan is truncated", async () => {
    process.env.CRON_SECRET = "cronsecret";
    const { GET } = await import("@/app/api/reports/send-summaries/route");
    const req = new Request("http://localhost:3000/api/reports/send-summaries", {
      headers: { "x-cron-secret": "cronsecret" },
    });

    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(207);
    expect(body).toMatchObject({
      ok: false,
      partial: true,
      sent: 0,
      candidates: 1,
      truncated: true,
      next_offset: 100,
      refresh_organizations: 1,
    });
    expect(refreshV10ReadModelsForOrganizationMock).toHaveBeenCalledWith(
      expect.anything(),
      "org-1",
      expect.objectContaining({ reason: "report_delivery_batch" })
    );
  });
});