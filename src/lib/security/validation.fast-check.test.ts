import fc from "fast-check";
import { describe, it } from "vitest";
import { isUuid } from "@/lib/security/validation";

describe("validation properties (fast-check)", () => {
  it("isUuid accepts lowercase UUID strings", () => {
    fc.assert(
      fc.property(fc.uuid(), (u) => {
        const s = u.toLowerCase();
        return isUuid(s) === true;
      }),
      { numRuns: 40 }
    );
  });

  it("isUuid rejects strings with non-hex or wrong shape", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 20 }), (s) => {
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)) {
          return true;
        }
        return isUuid(s) === false;
      }),
      { numRuns: 80 }
    );
  });
});
