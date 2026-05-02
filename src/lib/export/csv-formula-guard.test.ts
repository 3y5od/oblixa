import { describe, it, expect } from "vitest";
import { guardCsvCell, guardSpreadsheetCell } from "./csv-formula-guard";

describe("guardCsvCell", () => {
  it("prefixes leading = + - @", () => {
    expect(guardCsvCell("=cmd|'/c calc'!A0")).toMatch(/^'/);
    expect(guardCsvCell("+123")).toMatch(/^'/);
    expect(guardCsvCell("-sum(A1)")).toMatch(/^'/);
    expect(guardCsvCell("@sum(A1)")).toMatch(/^'/);
  });

  it("leaves benign text unchanged", () => {
    expect(guardCsvCell("Acme Corp")).toBe("Acme Corp");
  });

  it("guardSpreadsheetCell prefixes SYLK ID preamble", () => {
    expect(guardSpreadsheetCell("ID;P")).toMatch(/^'/);
    expect(guardSpreadsheetCell("  id;P")).toMatch(/^'/);
  });
});
