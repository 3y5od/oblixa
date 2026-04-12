import { beforeEach, describe, expect, it, vi } from "vitest";

const ensureCronAuthorized = vi.fn();
const rateLimitCheck = vi.fn();
const getV6OrgSettingsJson = vi.fn();
const cronMatchesUtc = vi.fn();

vi.mock("@/lib/v4/cron", () => ({
  ensureCronAuthorized,
}));

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: { v4ReportPacksCron: { max: 60, windowMs: 60_000 } },
  rateLimitCheck,
}));

vi.mock("@/lib/v4/cron-schedule", () => ({
  cronMatchesUtc: (...args: unknown[]) => cronMatchesUtc(...args),
}));

vi.mock("@/lib/v6/org-settings", () => ({
  getV6OrgSettingsJson: (...args: unknown[]) => getV6OrgSettingsJson(...args),
}));

vi.mock("@/lib/observability/cron-healthcheck", () => ({
  pingCronHealthcheck: vi.fn(),
}));

const createAdminClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: (...args: unknown[]) => createAdminClient(...args),
}));

describe("GET /api/cron/v4/report-packs-generate", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    ensureCronAuthorized.mockReturnValue(null);
    rateLimitCheck.mockResolvedValue({ ok: true });
    cronMatchesUtc.mockReturnValue(true);
    getV6OrgSettingsJson.mockResolvedValue({
      workspace_mode: "core",
      advanced_modules_hidden: [],
      assurance_modules_hidden: [],
      utility_modules_hidden: [],
      search_scope: "match_mode",
    });
    createAdminClient.mockReset();
  });

  it("returns unauthorized response from cron guard", async () => {
    ensureCronAuthorized.mockReturnValueOnce(new Response("Unauthorized", { status: 401 }));
    const { GET } = await import("@/app/api/cron/v4/report-packs-generate/route");
    const res = await GET(new Request("http://localhost:3000/api/cron/v4/report-packs-generate"));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate-limited", async () => {
    rateLimitCheck.mockResolvedValueOnce({ ok: false, retryAfterMs: 2500 });
    const { GET } = await import("@/app/api/cron/v4/report-packs-generate/route");
    const res = await GET(new Request("http://localhost:3000/api/cron/v4/report-packs-generate"));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "Too many requests", retryAfterMs: 2500 });
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
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.generated).toBe(0);
    expect(body.subscriptionEmailsSent).toBe(0);
  });
});
