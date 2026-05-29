import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const upstash = vi.hoisted(() => ({
  limit: vi.fn(),
  fromEnv: vi.fn(() => ({})),
  slidingWindow: vi.fn(() => ({})),
}));

vi.mock("@upstash/redis", () => ({
  Redis: {
    fromEnv: upstash.fromEnv,
  },
}));

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class MockRatelimit {
    static slidingWindow = upstash.slidingWindow;
    limit = upstash.limit;
  },
}));

describe("rateLimitCheck provider outage behavior", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "upstash-token");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("fails closed in production when Upstash limit() fails", async () => {
    vi.stubEnv("NODE_ENV", "production");
    upstash.limit.mockRejectedValueOnce(new Error("redis unavailable"));

    const { rateLimitCheck } = await import("@/lib/rate-limit");
    const result = await rateLimitCheck("provider-outage:prod", { max: 10, windowMs: 30_000 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.retryAfterMs).toBeGreaterThanOrEqual(60_000);
    expect(upstash.limit).toHaveBeenCalledWith("provider-outage:prod");
  });

  it("honors successful and rejected Upstash responses with bounded retry values", async () => {
    vi.stubEnv("NODE_ENV", "production");
    upstash.limit
      .mockResolvedValueOnce({ success: true, reset: Date.now() + 30_000 })
      .mockResolvedValueOnce({ success: false, reset: Date.now() + 10_000 });

    const { rateLimitCheck } = await import("@/lib/rate-limit");
    await expect(rateLimitCheck("provider-outage:success", { max: 10, windowMs: 30_000 })).resolves.toEqual({ ok: true });
    const denied = await rateLimitCheck("provider-outage:denied", { max: 10, windowMs: 30_000 });

    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.retryAfterMs).toBeGreaterThanOrEqual(0);
  });

  it("treats malformed Upstash responses as backend failure and fails closed in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    upstash.limit.mockResolvedValueOnce({ success: false });

    const { rateLimitCheck } = await import("@/lib/rate-limit");
    const result = await rateLimitCheck("provider-outage:malformed", { max: 10, windowMs: 30_000 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.retryAfterMs).toBeGreaterThanOrEqual(60_000);
  });

  it("times out slow Upstash responses and fails closed in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    upstash.limit.mockReturnValueOnce(new Promise(() => undefined));

    const { rateLimitCheck } = await import("@/lib/rate-limit");
    const result = await rateLimitCheck("provider-outage:timeout", { max: 10, windowMs: 30_000 }, { timeoutMs: 1 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.retryAfterMs).toBeGreaterThanOrEqual(60_000);
  });

  it("uses the in-process fallback outside production when Upstash limit() fails", async () => {
    vi.stubEnv("NODE_ENV", "development");
    upstash.limit.mockRejectedValueOnce(new Error("redis unavailable"));

    const { rateLimitCheck } = await import("@/lib/rate-limit");
    const result = await rateLimitCheck("provider-outage:dev", { max: 10, windowMs: 30_000 });

    expect(result.ok).toBe(true);
    expect(upstash.limit).toHaveBeenCalledWith("provider-outage:dev");
  });

  it("sanitizes unsafe rate-limit keys before sending them to Upstash", async () => {
    vi.stubEnv("NODE_ENV", "production");
    upstash.limit.mockResolvedValueOnce({ success: true, reset: Date.now() + 30_000 });

    const { rateLimitCheck } = await import("@/lib/rate-limit");
    await rateLimitCheck("email:user@example.com token=secret", { max: 10, windowMs: 30_000 });

    expect(upstash.limit).toHaveBeenCalledWith(expect.stringMatching(/^sanitized-rate-limit-key:[a-f0-9]{64}$/));
  });
});
