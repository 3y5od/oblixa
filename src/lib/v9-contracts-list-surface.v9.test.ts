import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

describe("V9 §9 contract list — URL filters + selection stability anchors", () => {
  it("keeps contracts page wired to shared sort + intersect id resolution", () => {
    const page = read("src/app/(dashboard)/contracts/page.tsx");
    expect(page).toContain("parseContractListSort");
    expect(page).toContain("combineContractListIntersectIds");
    expect(page).toContain("resolveAuxiliaryContractListIntersectIds");
    expect(page).toContain("buildContractsListHref");
  });

  it("persists bulk selection across filters/pages with visible off-page counts", () => {
    const table = read("src/components/contracts/contract-table.tsx");
    const storage = read("src/lib/security/client-storage.ts");
    expect(storage).toContain("oblixa.contract-table.selection:");
    expect(table).toContain("writeContractTableSelection");
    expect(table).toContain("hiddenSelectedCount");
    expect(table).toMatch(/across pages|filters/i);
  });

  it("keeps the contracts list empty state actionable with shared EmptyState + upload CTA", () => {
    const table = read("src/components/contracts/contract-table.tsx");
    expect(table).toMatch(/EmptyState|V10RecoverableState/);
    expect(table).toContain('title="No contracts yet"');
    expect(table).toContain('href="/contracts/new"');
  });

  it("keeps evidence-gap filters and row signals on the shared required-or-rejected helper", () => {
    const filters = read("src/lib/contract-list-id-filters.ts");
    const signals = read("src/lib/contract-list-row-signals.ts");
    expect(filters).toContain("EVIDENCE_GAP_STATUSES");
    expect(signals).toContain("EVIDENCE_GAP_STATUSES");
  });
});
