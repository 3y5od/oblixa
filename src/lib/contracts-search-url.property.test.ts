import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { normalizeContractsSearchQuery } from "@/lib/contracts-search-url";

describe("normalizeContractsSearchQuery (property)", () => {
  it("never throws and returns a trimmed string", () => {
    fc.assert(
      fc.property(fc.string(), (raw) => {
        const out = normalizeContractsSearchQuery(raw);
        expect(typeof out).toBe("string");
        expect(out).toBe(out.trim());
      }),
      { numRuns: 80 }
    );
  });
});
