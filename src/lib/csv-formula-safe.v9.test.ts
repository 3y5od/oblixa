import { describe, expect, it } from "vitest";
import { escapeCsvCellForSpreadsheet } from "./csv-formula-safe";

describe("escapeCsvCellForSpreadsheet (V9 §19 / Appendix AP)", () => {
  it("neutralizes leading formula characters", () => {
    expect(escapeCsvCellForSpreadsheet("=1+1")).toBe("'=1+1");
    expect(escapeCsvCellForSpreadsheet("+cmd")).toBe("'+cmd");
    expect(escapeCsvCellForSpreadsheet("-2+2")).toBe("'-2+2");
    expect(escapeCsvCellForSpreadsheet("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(escapeCsvCellForSpreadsheet("\tsecret")).toBe("'\tsecret");
    expect(escapeCsvCellForSpreadsheet("\r\n")).toBe(`"'\r\n"`);
  });

  it("quotes commas and embedded quotes", () => {
    expect(escapeCsvCellForSpreadsheet(`a"b,c`)).toBe(`"a""b,c"`);
  });

  it("passes through benign text", () => {
    expect(escapeCsvCellForSpreadsheet("Vendor LLC")).toBe("Vendor LLC");
    expect(escapeCsvCellForSpreadsheet(null)).toBe("");
    expect(escapeCsvCellForSpreadsheet("")).toBe("");
  });
});
