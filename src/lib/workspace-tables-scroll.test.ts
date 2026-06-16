import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function readTableSurface(rel: string): string {
  if (rel === "src/app/(dashboard)/contracts/tasks/page.tsx") {
    return [read(rel), read("src/app/(dashboard)/contracts/tasks/tasks-ledger.tsx")].join("\n");
  }
  if (rel === "src/app/(dashboard)/contracts/obligations/page.tsx") {
    return [
      read(rel),
      read("src/app/(dashboard)/contracts/obligations/obligations-ledger.tsx"),
    ].join("\n");
  }
  if (rel === "src/app/(dashboard)/contracts/renewals/page.tsx") {
    return [
      read(rel),
      read("src/app/(dashboard)/contracts/renewals/renewals-ledger.tsx"),
      read("src/app/(dashboard)/contracts/renewals/renewals-ledger-constants.ts"),
    ].join("\n");
  }
  return read(rel);
}

describe("V9 workspace tables keep horizontal scroll and aria labels", () => {
  it("aligns secondary queue tables with the contract-table scroll pattern", () => {
    for (const rel of [
      "src/app/(dashboard)/contracts/tasks/page.tsx",
      "src/app/(dashboard)/contracts/obligations/page.tsx",
      "src/app/(dashboard)/contracts/watchlists/page.tsx",
    ]) {
      const raw = readTableSurface(rel);
      // Token match (not an exact className) so layout-containment utilities can
      // sit alongside the scroll class — e.g. obligations now uses
      // className="max-w-full overflow-x-auto [contain:inline-size]". The contract
      // is "the queue table keeps horizontal scroll", not "the wrapper carries no
      // other classes".
      expect(raw, rel).toMatch(/className="[^"]*\boverflow-x-auto\b/);
      expect(raw, rel).toContain("aria-label=");
    }

    const renewals = readTableSurface("src/app/(dashboard)/contracts/renewals/page.tsx");
    // The renewals ledger keeps the bounded horizontal-scroll region and a pinned
    // column header; the header + every row share the six-column template.
    expect(renewals).toMatch(/className="[^"]*\boverflow-x-auto\b/);
    expect(renewals).toContain("RenewalLedgerHeader");
    expect(renewals).toContain(
      "xl:grid-cols-[minmax(15rem,1.45fr)_minmax(7.25rem,0.7fr)_minmax(7.25rem,0.7fr)_minmax(8.5rem,0.78fr)_minmax(7.5rem,0.66fr)_minmax(11rem,0.92fr)]"
    );
  });
});
