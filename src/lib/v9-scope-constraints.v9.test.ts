import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readDoc(): string {
  return readFileSync(join(process.cwd(), "docs", "v9.md"), "utf8");
}

describe("V9 §3 scope constraints", () => {
  it("lists every positive scope bullet under V9 applies to", () => {
    const doc = readDoc();
    const start = doc.indexOf("V9 applies to:");
    const end = doc.indexOf("V9 does not require:", start);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const slice = doc.slice(start, end);
    const bullets = slice.split("\n").filter((l) => l.trim().startsWith("- "));
    expect(bullets.length).toBeGreaterThanOrEqual(16);
  });

  it("lists six negative constraints verbatim (does not require)", () => {
    const doc = readDoc();
    const negatives = [
      "new product domains,",
      "new top-level navigation areas,",
      "new pricing structure,",
      "broader public feature exposure,",
      "new hidden platform families,",
      "replacement of the existing architecture.",
    ];
    for (const n of negatives) {
      expect(doc).toContain(n);
    }
  });
});
