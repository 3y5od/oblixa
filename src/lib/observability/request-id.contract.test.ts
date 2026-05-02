import { describe, it, expect } from "vitest";

describe("request correlation ids", () => {
  it("generates distinct UUIDs for parallel logical requests", () => {
    const ids = new Set(Array.from({ length: 64 }, () => crypto.randomUUID()));
    expect(ids.size).toBe(64);
  });

  it("accepts W3C traceparent shape for outbound propagation", () => {
    const traceId = "0".repeat(32);
    const spanId = "1".repeat(16);
    const tp = `00-${traceId}-${spanId}-01`;
    expect(/^[\da-f]{2}-[\da-f]{32}-[\da-f]{16}-[\da-f]{2}$/i.test(tp)).toBe(true);
  });
});
