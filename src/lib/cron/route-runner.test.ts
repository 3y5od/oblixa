import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pingCronHealthcheck = vi.hoisted(() => vi.fn());

vi.mock("@/lib/observability/cron-healthcheck", () => ({
  pingCronHealthcheck,
}));

import { runCronRoute } from "./route-runner";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { __clearCronSingleFlightMemoryLocksForTests } from "./single-flight-lock";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("runCronRoute", () => {
  const originalCronSecret = process.env.CRON_SECRET;
  const originalKillCronFamily = process.env.OBLIXA_KILL_CRON_FAMILY;
  const originalUpstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalUpstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const testRateLimit = RATE_LIMITS.v6CronDefault;

  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.OBLIXA_KILL_CRON_FAMILY;
    __clearCronSingleFlightMemoryLocksForTests();
    pingCronHealthcheck.mockReset();
  });

  afterEach(() => {
    if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalCronSecret;
    if (originalUpstashUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = originalUpstashUrl;
    if (originalUpstashToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = originalUpstashToken;
    if (originalKillCronFamily === undefined) delete process.env.OBLIXA_KILL_CRON_FAMILY;
    else process.env.OBLIXA_KILL_CRON_FAMILY = originalKillCronFamily;
    __clearCronSingleFlightMemoryLocksForTests();
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
    expect(body).toMatchObject({
      ok: true,
      route: "/api/cron/test",
      processed: 1,
      processed_count: 1,
      skipped_count: 0,
      failed_count: 0,
      retry_count: 0,
      errors_count: 0,
    });
    expect(body.job_id).toMatch(/^api-cron-test:\d+$/);
    expect(Date.parse(body.started_at)).not.toBeNaN();
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
    expect(body).toMatchObject({
      ok: false,
      code: "unhandled_cron_error",
      diagnostic_id: "cron_unhandled_error",
      failed_count: 1,
      errors_count: 1,
    });
    expect(body.error_class).toBe("TypeError");
  });

  it("blocks overlapping runs for the same route with a single-flight conflict", async () => {
    process.env.CRON_SECRET = "secret";
    const started = deferred<void>();
    const finish = deferred<Record<string, unknown>>();
    const handler = vi.fn(async () => {
      started.resolve();
      return finish.promise;
    });

    const first = runCronRoute(
      new Request("https://example.test/api/cron/test", { headers: { Authorization: "Bearer secret" } }),
      {
        route: "/api/cron/test",
        rateLimitKey: `test:single-flight:${Date.now()}:first`,
        rateLimit: testRateLimit,
        singleFlightTtlMs: 10_000,
        pingHealthcheck: false,
        adminFactory: async () => ({}) as never,
        handler,
      }
    );
    await started.promise;

    const second = await runCronRoute(
      new Request("https://example.test/api/cron/test", { headers: { Authorization: "Bearer secret" } }),
      {
        route: "/api/cron/test",
        rateLimitKey: `test:single-flight:${Date.now()}:second`,
        rateLimit: testRateLimit,
        singleFlightTtlMs: 10_000,
        pingHealthcheck: false,
        adminFactory: async () => ({}) as never,
        handler: async () => ({ shouldNotRun: true }),
      }
    );

    expect(second.status).toBe(409);
    expect(second.headers.get("Retry-After")).toBe("10");
    await expect(second.json()).resolves.toMatchObject({
      ok: false,
      code: "job_already_running",
      diagnostic_id: "cron_job_already_running",
      skipped: true,
      reason: "job_already_running",
    });

    finish.resolve({ processed: 1 });
    const firstResponse = await first;
    expect(firstResponse.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);

    const afterRelease = await runCronRoute(
      new Request("https://example.test/api/cron/test", { headers: { Authorization: "Bearer secret" } }),
      {
        route: "/api/cron/test",
        rateLimitKey: `test:single-flight:${Date.now()}:after-release`,
        rateLimit: testRateLimit,
        singleFlightTtlMs: 10_000,
        pingHealthcheck: false,
        adminFactory: async () => ({}) as never,
        handler: async () => ({ processed: 2 }),
      }
    );
    expect(afterRelease.status).toBe(200);
  });

  it("applies extra response headers on deny and success responses", async () => {
    process.env.CRON_SECRET = "secret";

    const denied = await runCronRoute(new Request("https://example.test/api/cron/test"), {
      route: "/api/cron/test",
      rateLimitKey: "test:headers-deny",
      rateLimit: testRateLimit,
      responseHeaders: { "X-Content-Type-Options": "nosniff" },
      pingHealthcheck: false,
      adminFactory: async () => ({}) as never,
      handler: async () => ({ ok: true }),
    });
    expect(denied.headers.get("X-Content-Type-Options")).toBe("nosniff");

    const success = await runCronRoute(
      new Request("https://example.test/api/cron/test", { headers: { Authorization: "Bearer secret" } }),
      {
        route: "/api/cron/test",
        rateLimitKey: "test:headers-success",
        rateLimit: testRateLimit,
        responseHeaders: { "X-Content-Type-Options": "nosniff" },
        pingHealthcheck: false,
        adminFactory: async () => ({}) as never,
        handler: async () => ({ processed: 1 }),
      }
    );
    expect(success.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(success.headers.get("Cache-Control")).toContain("no-store");
  });

  it("emits skipped telemetry fields when handler returns a skipped payload", async () => {
    process.env.CRON_SECRET = "secret";
    await runCronRoute(
      new Request("https://example.test/api/cron/test", { headers: { Authorization: "Bearer secret" } }),
      {
        route: "/api/cron/test",
        rateLimitKey: "test:handler-skip",
        rateLimit: testRateLimit,
        adminFactory: async () => ({}) as never,
        handler: async () => ({ ok: true, skipped: true, reason: "feature_disabled" }),
      }
    );

    expect(pingCronHealthcheck).toHaveBeenCalledWith(
      "/api/cron/test",
      expect.objectContaining({
        ok: true,
        status: 200,
        reason: "skipped",
        skipped: true,
        skip_reason: "feature_disabled",
      })
    );
  });

  it("emits skipped telemetry fields when preflight returns a skipped payload", async () => {
    process.env.CRON_SECRET = "secret";
    await runCronRoute(
      new Request("https://example.test/api/cron/test", { headers: { Authorization: "Bearer secret" } }),
      {
        route: "/api/cron/test",
        rateLimitKey: "test:preflight-skip",
        rateLimit: testRateLimit,
        adminFactory: async () => ({}) as never,
        preflight: async () =>
          NextResponse.json({ ok: true, skipped: true, reason: "disabled" }, { status: 200 }),
        handler: async () => ({ ok: true }),
      }
    );

    expect(pingCronHealthcheck).toHaveBeenCalledWith(
      "/api/cron/test",
      expect.objectContaining({
        ok: true,
        status: 200,
        reason: "skipped",
        skipped: true,
        skip_reason: "disabled",
      })
    );
  });

  it("fails closed when cron family kill switch is active after cron auth", async () => {
    process.env.CRON_SECRET = "secret";
    process.env.OBLIXA_KILL_CRON_FAMILY = "1";
    const handler = vi.fn(async () => ({ processed: 1 }));

    const res = await runCronRoute(
      new Request("https://example.test/api/cron/test", { headers: { Authorization: "Bearer secret" } }),
      {
        route: "/api/cron/test",
        rateLimitKey: `test:cron-kill:${Date.now()}`,
        rateLimit: testRateLimit,
        adminFactory: async () => ({}) as never,
        handler,
      }
    );

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({
      ok: false,
      code: "service_temporarily_unavailable",
      diagnostic_id: "kill_switch_active",
      details: { subsystem: "cron_family" },
      failed_count: 1,
    });
    expect(handler).not.toHaveBeenCalled();
    expect(pingCronHealthcheck).toHaveBeenCalledWith(
      "/api/cron/test",
      expect.objectContaining({
        ok: false,
        status: 503,
        reason: "kill_switch_active",
      })
    );
  });
});
