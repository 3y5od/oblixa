import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { CONTRACTS_SEARCH_MAX_LENGTH, normalizeContractsSearchQuery } from "@/lib/contracts-search-url";

describe("normalizeContractsSearchQuery (property)", () => {
  it("never throws and returns a trimmed string", () => {
    fc.assert(
      fc.property(fc.string(), (raw) => {
        const out = normalizeContractsSearchQuery(raw);
        expect(typeof out).toBe("string");
        expect(out).toBe(out.trim());
        expect(out.length).toBeLessThanOrEqual(CONTRACTS_SEARCH_MAX_LENGTH);
      }),
      { numRuns: 80 }
    );
  });

  it("normalizes Unicode, strips unsafe controls, and collapses empty/special-only input", () => {
    expect(normalizeContractsSearchQuery("ＡＣＭＥ\u202e\n%_() renewal")).toBe("ACME renewal");
    expect(normalizeContractsSearchQuery("%_\\()\"',.*")).toBe("");
    expect(normalizeContractsSearchQuery(`${"renewal ".repeat(80)}`)).toHaveLength(CONTRACTS_SEARCH_MAX_LENGTH);
  });
});
