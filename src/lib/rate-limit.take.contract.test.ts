import { describe, expect, it } from "vitest";
import { rateLimitTake } from "./rate-limit";

describe("rateLimitTake (in-memory path mirrors Upstash cardinality)", () => {
  it("exhausts after max requests for the same key", () => {
    const key = `contract-rl-${Math.random().toString(36).slice(2)}`;
    const cfg = { max: 2, windowMs: 60_000 };
    expect(rateLimitTake(key, cfg).ok).toBe(true);
    expect(rateLimitTake(key, cfg).ok).toBe(true);
    const blocked = rateLimitTake(key, cfg);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.retryAfterMs).toBeGreaterThanOrEqual(0);
    }
  });
});
