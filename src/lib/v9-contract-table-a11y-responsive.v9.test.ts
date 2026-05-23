import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("V9 §25.3 / §26 — contract inventory semantics + responsive cards", () => {
  it("uses readable card-list semantics without a horizontal scroll or spreadsheet-header dependency", () => {
    const src = readFileSync(join(process.cwd(), "src/components/contracts/contract-table.tsx"), "utf8");
    expect(src).toContain('role="list"');
    expect(src).toContain('role="listitem"');
    expect(src).toContain("signalGridClass");
    expect(src).toContain("md:grid-cols-2 xl:grid-cols-4");
    expect(src).toContain("signalCellClass");
    expect(src).not.toContain('role="table"');
    expect(src).not.toContain('role="columnheader"');
    expect(src).not.toContain('role="cell"');
    expect(src).not.toContain("detailListClass");
    expect(src).not.toContain("inventoryGridClass");
    expect(src).not.toContain("laneGridClass");
    expect(src).not.toContain("factGridClass");
    expect(src).not.toContain("signalItemClass");
    expect(src).not.toContain("flex flex-wrap items-center gap-x-5");
    expect(src).not.toContain('<div className="overflow-x-auto">');
    expect(src).not.toMatch(/<table[\s\n]/);
    expect(src).toContain("Contract");
    for (const label of [
      "Counterparty",
      "Owner",
      "Status",
      "Next important date",
      "Review state",
      "Open work",
      "Last updated",
      "Actions",
    ]) {
      expect(src).toContain(label);
    }
    expect(src).toContain("Open contract");
    expect(src).toContain("Select all on page");
    expect(src).toContain('aria-label="Select all contracts on this page"');
    expect(src).toContain('aria-label="Contracts in this workspace"');
  });
});
