import { describe, expect, it } from "vitest";
import { escapeCsvCellForSpreadsheet } from "@/lib/csv-formula-safe";

/** Tier 25 — import/export formula injection display invariants. */
describe("csv-formula-safe (import preview / export alignment)", () => {
  it("prefixes risk-leading cells for spreadsheet exports", () => {
    const out = escapeCsvCellForSpreadsheet("=1+1");
    expect(out.startsWith("'=")).toBe(true);
  });
});
