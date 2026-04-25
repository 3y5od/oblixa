import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("V9 §25.3 / §26 — contract table semantics + narrow-width scroll", () => {
  it("uses a native table with header row and horizontal scroll wrapper", () => {
    const src = readFileSync(join(process.cwd(), "src/components/contracts/contract-table.tsx"), "utf8");
    expect(src).toContain('<div className="overflow-x-auto">');
    expect(src).toMatch(/<table[\s\n]/);
    expect(src).toContain("<thead");
    expect(src).toMatch(/Contract[\s\S]*?<\/th>/);
    expect(src).toMatch(/Counterparty[\s\S]*?<\/th>/);
    expect(src).toMatch(/Status[\s\S]*?<\/th>/);
    expect(src).toContain('aria-label="Select all contracts on this page"');
    expect(src).toContain('aria-label="Contracts in this workspace"');
  });
});
