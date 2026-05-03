import { afterEach, describe, expect, it } from "vitest";
import { runCronRoute } from "./route-runner";
import { RATE_LIMITS } from "@/lib/rate-limit";

describe("runCronRoute", () => {
  const originalCronSecret = process.env.CRON_SECRET;
  const testRateLimit = RATE_LIMITS.v6CronDefault;

  afterEach(() => {
    if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalCronSecret;
  });

  it("returns controlled 401 before handler when unsigned", async () => {
    process.env.CRON_SECRET = "secret";
    const res = await runCronRoute(new Request("https://example.test/api/cron/test"), {
      route: "/api/cron/test",
      rateLimitKey: "test:unsigned",
      rateLimit: testRateLimit,
      pingHealthcheck: false,
      adminFactory: async () => ({}) as never,
      handler: async () => ({ ok: true }),
    });

    expect(res.status).toBe(401);
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });

  it("wraps successful handlers with duration and route metadata", async () => {
    process.env.CRON_SECRET = "secret";
    const res = await runCronRoute(
      new Request("https://example.test/api/cron/test", { headers: { Authorization: "Bearer secret" } }),
      {
        route: "/api/cron/test",
        rateLimitKey: `test:success:${Date.now()}`,
        rateLimit: RATE_LIMITS.v6CronDefault,
        pingHealthcheck: false,
        adminFactory: async () => ({}) as never,
        handler: async () => ({ processed: 1 }),
      }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, route: "/api/cron/test", processed: 1 });
    expect(typeof body.durationMs).toBe("number");
  });

  it("converts handler exceptions to stable 500 JSON", async () => {
    process.env.CRON_SECRET = "secret";
    const res = await runCronRoute(
      new Request("https://example.test/api/cron/test", { headers: { "x-vercel-cron-secret": "secret" } }),
      {
        route: "/api/cron/test",
        rateLimitKey: `test:error:${Date.now()}`,
        rateLimit: testRateLimit,
        pingHealthcheck: false,
        adminFactory: async () => ({}) as never,
        handler: async () => {
          throw new TypeError("boom");
        },
      }
    );

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, code: "unhandled_cron_error", diagnostic_id: "cron_unhandled_error" });
    expect(body.error_class).toBe("TypeError");
  });
});
