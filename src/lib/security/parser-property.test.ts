import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { isUuid } from "@/lib/security/validation";

describe("parser property checks", () => {
  it("isUuid accepts canonical lowercase UUIDs", () => {
    fc.assert(
      fc.property(fc.uuid(), (u) => {
        expect(isUuid(u.toLowerCase())).toBe(true);
      }),
      { numRuns: 30 }
    );
  });

  it("isUuid rejects garbage strings", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 12 }), (s) => {
        if (/^[0-9a-f-]{36}$/i.test(s)) return true;
        expect(isUuid(s)).toBe(false);
      }),
      { numRuns: 40 }
    );
  });
});
