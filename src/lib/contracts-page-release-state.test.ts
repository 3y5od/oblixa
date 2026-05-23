import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

const pageRaw = read("src/app/(dashboard)/contracts/page.tsx");
const tableRaw = read("src/components/contracts/contract-table.tsx");
const listRaw = read("src/lib/contract-list.ts");
const idFiltersRaw = read("src/lib/contract-list-id-filters.ts");

describe("contracts page release-state surface", () => {
  it("uses Core contracts copy and stable header CTAs", () => {
    expect(pageRaw).toContain('eyebrow="Contract inventory"');
    expect(pageRaw).toContain('title="Contracts"');
    expect(pageRaw).toContain("Upload contract");
    expect(pageRaw).toContain("Import CSV");
    expect(pageRaw).not.toContain('eyebrow="Portfolio"');
    expect(pageRaw).not.toContain(">Bulk import<");
  });

  it("supports the release-state search and filter axes", () => {
    expect(pageRaw).toContain("Search contracts by name, counterparty, owner, or tag");
    expect(pageRaw).toContain("getContractIdsMatchingOwnerOrTagSearch");
    expect(pageRaw).toContain("Status");
    expect(pageRaw).toContain("Owner");
    expect(pageRaw).toContain("Counterparty");
    expect(pageRaw).toContain("Contract type");
    expect(pageRaw).toContain("Date preset");
    expect(pageRaw).toContain("Needs review");
    expect(pageRaw).toContain("Missing dates");
    expect(pageRaw).toContain("Open work");
    expect(listRaw).toContain("counterparty?: string");
    expect(listRaw).toContain("contractType?: string");
    expect(idFiltersRaw).toContain("getContractIdsWithOpenWork");
  });

  it("renders the release-state inventory fields", () => {
    for (const label of [
      "Contract",
      "Counterparty",
      "Owner",
      "Status",
      "Next important date",
      "Review state",
      "Open work",
      "Last updated",
    ]) {
      expect(tableRaw).toContain(label);
    }
  });

  it("keeps release-state row and bulk actions available", () => {
    for (const label of [
      "Export CSV",
      "Request review",
      "Archive",
      "Open contract",
      "Assign owner",
      "Add reminder",
      "Create work",
    ]) {
      expect(tableRaw).toContain(label);
    }
    expect(tableRaw).toContain("/contracts/maintenance?action=archive");
    expect(tableRaw).toContain("/contracts/review?contractIds=");
  });
});
