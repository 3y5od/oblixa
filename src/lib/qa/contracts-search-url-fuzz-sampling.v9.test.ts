import { describe, it } from "vitest";
import * as fc from "fast-check";
import { buildContractsSearchListHref, normalizeContractsSearchQuery } from "@/lib/contracts-search-url";

/** Tier 13 / 69 — generative spot checks (bounded) for search URL invariants. */
describe("contracts search URL (fast-check sampling)", () => {
  it("normalizes and rebuilds list href for arbitrary trimmed queries", () => {
    fc.assert(
      fc.property(fc.string(), (q) => {
        const n = normalizeContractsSearchQuery(q);
        if (n.length > 2000) return true;
        const href = buildContractsSearchListHref(n);
        return href.startsWith("/contracts");
      }),
      { numRuns: 40 }
    );
  });
});
