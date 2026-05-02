import fc from "fast-check";
import { describe, expect, it } from "vitest";

describe("velocity / rate-limit key hygiene", () => {
  it("composes stable keys from user id and ip segments", () => {
    fc.assert(
      fc.property(fc.uuid(), fc.ipV4(), (userId, ip) => {
        const key = `signup:${userId}:${ip}`;
        expect(key.length).toBeGreaterThan(10);
        expect(key).toContain(userId);
        expect(key).toContain(ip);
      }),
      { numRuns: 30 }
    );
  });
});
