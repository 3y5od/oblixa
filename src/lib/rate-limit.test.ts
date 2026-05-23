import { afterEach, describe, it, expect, vi } from "vitest";
import {
  hasDistributedRateLimitConfig,
  isProductionLikeRateLimitEnv,
  normalizeRateLimitKey,
  rateLimitCheck,
  rateLimitTake,
  RATE_LIMITS,
} from "@/lib/rate-limit";

describe("rateLimitTake", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("allows up to max requests in the window", () => {
    const key = `test:${Math.random()}`;
    const cfg = { max: 3, windowMs: 60_000 };
    expect(rateLimitTake(key, cfg).ok).toBe(true);
    expect(rateLimitTake(key, cfg).ok).toBe(true);
    expect(rateLimitTake(key, cfg).ok).toBe(true);
    const fourth = rateLimitTake(key, cfg);
    expect(fourth.ok).toBe(false);
    if (!fourth.ok) {
      expect(fourth.retryAfterMs).toBeGreaterThan(0);
    }
  });

  it("uses extract limits config shape", () => {
    expect(RATE_LIMITS.extract.max).toBeGreaterThan(0);
    expect(RATE_LIMITS.extract.windowMs).toBeGreaterThan(0);
  });

  it("preserves bounded scoped keys", () => {
    const key = "workspace-api:org_123:/api/contracts.export";
    expect(normalizeRateLimitKey(key)).toBe(key);
  });

  it("hashes empty, malformed, and overlong keys without retaining raw material", () => {
    const unsafeKey = `external-submit:${"a".repeat(300)}\nraw-secret-token`;
    const normalized = normalizeRateLimitKey(unsafeKey);

    expect(normalized).toMatch(/^sanitized-rate-limit-key:[a-f0-9]{64}$/);
    expect(normalized.length).toBeLessThanOrEqual(96);
    expect(normalized).not.toContain("raw-secret-token");
    expect(normalizeRateLimitKey(unsafeKey)).toBe(normalized);
    expect(normalizeRateLimitKey(`${unsafeKey}:other`)).not.toBe(normalized);
    expect(normalizeRateLimitKey("")).toMatch(/^sanitized-rate-limit-key:[a-f0-9]{64}$/);
  });

  it("applies normalized keys to the in-memory limiter", () => {
    const unsafeKey = `unsafe:${Math.random()}:${"x".repeat(300)}\nsecret`;
    const otherUnsafeKey = `${unsafeKey}:other`;
    const cfg = { max: 1, windowMs: 60_000 };

    expect(rateLimitTake(unsafeKey, cfg).ok).toBe(true);
    expect(rateLimitTake(unsafeKey, cfg).ok).toBe(false);
    expect(rateLimitTake(otherUnsafeKey, cfg).ok).toBe(true);
  });

  it("detects distributed limiter configuration", () => {
    expect(hasDistributedRateLimitConfig({} as NodeJS.ProcessEnv)).toBe(false);
    expect(
      hasDistributedRateLimitConfig({
        UPSTASH_REDIS_REST_URL: "https://redis.example",
        UPSTASH_REDIS_REST_TOKEN: "token",
      } as unknown as NodeJS.ProcessEnv)
    ).toBe(true);
  });

  it("treats production and Vercel production as production-like for limiter safety", () => {
    expect(isProductionLikeRateLimitEnv({ NODE_ENV: "development" } as NodeJS.ProcessEnv)).toBe(false);
    expect(isProductionLikeRateLimitEnv({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toBe(true);
    expect(isProductionLikeRateLimitEnv({ VERCEL_ENV: "production" } as unknown as NodeJS.ProcessEnv)).toBe(true);
  });

  it("fails closed in production when distributed limiter config is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await rateLimitCheck("prod-missing-upstash", { max: 10, windowMs: 30_000 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.retryAfterMs).toBeGreaterThanOrEqual(60_000);
    expect(error).toHaveBeenCalledWith(
      "[rate-limit] Distributed limiter is required in production; failing closed"
    );
  });
});
