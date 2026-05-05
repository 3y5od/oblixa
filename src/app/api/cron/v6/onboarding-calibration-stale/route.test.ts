import { beforeEach, describe, expect, it, vi } from "vitest";

const gateCronRequest = vi.fn();
const createAdminClient = vi.fn();
const runCron = vi.fn();
const isDisabled = vi.fn();
const rateLimitCheck = vi.fn();

vi.mock("@/lib/security/cron-route-gate", () => ({
  gateCronRequest,
}));

vi.mock("@/lib/v6/cron", () => ({
  listOrganizationIds: vi.fn(async () => ({
    orgIds: ["org-a"],
    error: null,
    stoppedByOffsetCap: false,
    nextOffset: null,
  })),
  logV6Cron: vi.fn(),
  v6CronRunMetadata: (orgsProcessed: number, _startedAtMs: number, errorsCount = 0) => ({
    duration_ms: 1,
    orgs_processed: orgsProcessed,
    errors_count: errorsCount,
  }),
}));
vi.mock("@/lib/supabase/server", () => ({ createAdminClient }));
vi.mock("@/lib/onboarding/calibration-stale-run", () => ({
  runOnboardingCalibrationStaleCron: (...args: unknown[]) => runCron(...args),
}));
vi.mock("@/lib/onboarding/calibration-stale-env", () => ({
  isOnboardingCalibrationStaleCronDisabled: () => isDisabled(),
}));
vi.mock("@/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit")>("@/lib/rate-limit");
  return {
    ...actual,
    rateLimitCheck: (...args: unknown[]) => rateLimitCheck(...args),
  };
});

describe("GET /api/cron/v6/onboarding-calibration-stale", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    gateCronRequest.mockReturnValue(null);
    rateLimitCheck.mockResolvedValue({ ok: true });
    isDisabled.mockReturnValue(false);
  });

  it("returns 401 when cron auth fails", async () => {
    gateCronRequest.mockReturnValueOnce(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    );
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/cron/v6/onboarding-calibration-stale"));
    expect(res.status).toBe(401);
  });

  it("returns 401 when Authorization bearer does not match CRON_SECRET (wrong secret)", async () => {
    gateCronRequest.mockReturnValueOnce(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    );
    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/cron/v6/onboarding-calibration-stale", {
        headers: { Authorization: "Bearer not-the-cron-secret" },
      })
    );
    expect(res.status).toBe(401);
  });

  it("returns skipped when disabled", async () => {
    gateCronRequest.mockReturnValueOnce(null);
    isDisabled.mockReturnValueOnce(true);
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/cron/v6/onboarding-calibration-stale"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skipped).toBe(true);
  });

  it("returns JSON with expected keys when run succeeds", async () => {
    gateCronRequest.mockReturnValueOnce(null);
    isDisabled.mockReturnValueOnce(false);
    rateLimitCheck.mockResolvedValueOnce({ ok: true });
    createAdminClient.mockResolvedValueOnce({});
    runCron.mockResolvedValueOnce({
      ok: true,
      scanned: 1,
      expired: 0,
      would_expire: 0,
      skipped_ineligible: 1,
      skipped_stale_race: 0,
      skipped_bad_timestamp: 0,
      skipped_missing_org_created_at: 0,
      errors_no_admin: 0,
      errors_merge: 0,
      errors_count: 0,
      truncation_warning: false,
      org_cap: 500,
      backpressure_ms: 0,
      dry_run: false,
    });
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/cron/v6/onboarding-calibration-stale"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.expired).toBe("number");
    expect(typeof body.scanned).toBe("number");
    expect(body.orgs_scanned).toBe(body.scanned);
    expect(typeof body.duration_ms).toBe("number");
    expect(typeof body.orgs_processed).toBe("number");
    expect(typeof body.errors_count).toBe("number");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("returns 429 when rate limit fails", async () => {
    gateCronRequest.mockReturnValueOnce(null);
    isDisabled.mockReturnValueOnce(false);
    rateLimitCheck.mockResolvedValueOnce({ ok: false, retryAfterMs: 900 });
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/cron/v6/onboarding-calibration-stale"));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body).toMatchObject({ error: "Too many requests", code: "rate_limited" });
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});
