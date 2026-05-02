import { describe, expect, it } from "vitest";

/** CSV formula injection neutralization for spreadsheet exports */
function neutralizeCsvCell(value: string): string {
  if (/^[=+\-@]/.test(value)) return `'${value}`;
  return value;
}

describe("export / CSV safety", () => {
  it("prefixes risky spreadsheet tokens", () => {
    expect(neutralizeCsvCell("=1+1")).toBe("'=1+1");
    expect(neutralizeCsvCell("+123")).toBe("'+123");
    expect(neutralizeCsvCell("-sum(A1)")).toBe("'-sum(A1)");
    expect(neutralizeCsvCell("@ref")).toBe("'@ref");
    expect(neutralizeCsvCell("normal")).toBe("normal");
  });
});
