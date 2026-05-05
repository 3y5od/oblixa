import { beforeEach, describe, expect, it, vi } from "vitest";

const runTaskAutomationRulesForOrgMock = vi.fn();
const forEachSupabaseRangePageMock = vi.fn();
const rateLimitCheckMock = vi.fn();
const pingCronHealthcheckMock = vi.fn();

vi.mock("@/lib/tasks/run-task-automation-rules-for-org", () => ({
  runTaskAutomationRulesForOrg: runTaskAutomationRulesForOrgMock,
}));

vi.mock("@/lib/supabase/range-pagination", () => ({
  forEachSupabaseRangePage: forEachSupabaseRangePageMock,
}));

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: { tasksRunRulesCron: { max: 60, windowMs: 60_000 } },
  rateLimitCheck: rateLimitCheckMock,
}));

vi.mock("@/lib/observability/cron-healthcheck", () => ({
  pingCronHealthcheck: pingCronHealthcheckMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(async () => ({})),
}));

describe("GET /api/tasks/run-rules", () => {
  const originalCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = originalCronSecret;
    vi.resetModules();
    runTaskAutomationRulesForOrgMock.mockReset();
    forEachSupabaseRangePageMock.mockReset();
    rateLimitCheckMock.mockReset();
    pingCronHealthcheckMock.mockReset();
    rateLimitCheckMock.mockResolvedValue({ ok: true });
    runTaskAutomationRulesForOrgMock.mockResolvedValue({ generated: 2, evaluatedRules: 3, errors: [] });
    forEachSupabaseRangePageMock.mockImplementation(async (_fetchPage, consume) => {
      await consume([{ id: "org-1" }]);
      return { error: null, stoppedByOffsetCap: false, rowsSeen: 1, nextOffset: null };
    });
  });

  it("returns 503 when CRON_SECRET is missing", async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await import("@/app/api/tasks/run-rules/route");
    const req = new Request("http://localhost:3000/api/tasks/run-rules");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.code).toBe("cron_secret_missing");
  });

  it("returns 401 when the request is unsigned", async () => {
    process.env.CRON_SECRET = "cronsecret";
    const { GET } = await import("@/app/api/tasks/run-rules/route");
    const req = new Request("http://localhost:3000/api/tasks/run-rules");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toMatchObject({ error: "Unauthorized", code: "cron_unauthorized" });
  });

  it("returns 207 when org processing is partial or truncated", async () => {
    process.env.CRON_SECRET = "cronsecret";
    runTaskAutomationRulesForOrgMock.mockResolvedValueOnce({
      generated: 1,
      evaluatedRules: 4,
      errors: [
        {
          scope: "org-1:rule-1",
          phase: "source_query",
          diagnostic_id: "task_rule_field_missing_contract_query_failed",
          message: "contracts lookup failed",
        },
      ],
    });
    forEachSupabaseRangePageMock.mockImplementationOnce(async (_fetchPage, consume) => {
      await consume([{ id: "org-1" }]);
      return { error: null, stoppedByOffsetCap: true, rowsSeen: 200, nextOffset: 200 };
    });

    const { GET } = await import("@/app/api/tasks/run-rules/route");
    const req = new Request("http://localhost:3000/api/tasks/run-rules", {
      headers: { "x-cron-secret": "cronsecret" },
    });
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(207);
    expect(body).toMatchObject({
      ok: false,
      partial: true,
      organizations: 1,
      evaluatedRules: 4,
      generated: 1,
      truncated: true,
      next_offset: 200,
      phase: "source_query",
    });
    expect(body.error_details).toEqual([
      expect.objectContaining({ diagnostic_id: "task_rule_field_missing_contract_query_failed" }),
    ]);
    expect(pingCronHealthcheckMock).toHaveBeenCalled();
  });

  it("returns 429 when route rate limit is exceeded", async () => {
    process.env.CRON_SECRET = "cronsecret";
    rateLimitCheckMock.mockResolvedValueOnce({ ok: false, retryAfterMs: 5000 });
    const { GET } = await import("@/app/api/tasks/run-rules/route");
    const req = new Request("http://localhost:3000/api/tasks/run-rules", {
      headers: { "x-cron-secret": "cronsecret" },
    });
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body).toMatchObject({ error: "Too many requests", code: "rate_limited", retryAfterMs: 5000 });
  });
});