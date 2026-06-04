import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

describe("V9 workspace tables keep horizontal scroll and aria labels", () => {
  it("aligns secondary queue tables with the contract-table scroll pattern", () => {
    for (const rel of [
      "src/app/(dashboard)/contracts/tasks/page.tsx",
      "src/app/(dashboard)/contracts/obligations/page.tsx",
      "src/app/(dashboard)/contracts/watchlists/page.tsx",
    ]) {
      const raw = read(rel);
      // Token match (not an exact className) so layout-containment utilities can
      // sit alongside the scroll class — e.g. obligations now uses
      // className="max-w-full overflow-x-auto [contain:inline-size]". The contract
      // is "the queue table keeps horizontal scroll", not "the wrapper carries no
      // other classes".
      expect(raw, rel).toMatch(/className="[^"]*\boverflow-x-auto\b/);
      expect(raw, rel).toContain("aria-label=");
    }

    const renewals = read("src/app/(dashboard)/contracts/renewals/page.tsx");
    expect(renewals).toContain("RenewalRowsHeader");
    expect(renewals).toContain("xl:grid-cols-[minmax(13rem,0.9fr)_minmax(0,1.45fr)_minmax(20rem,1fr)]");
  });
});
