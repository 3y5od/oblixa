import { describe, it, expect } from "vitest";
import { rateLimitTake, RATE_LIMITS } from "@/lib/rate-limit";

describe("rateLimitTake", () => {
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
});
