import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("V9 §19.1–19.2 reports operational emphasis", () => {
  it("reports shell emphasizes operational exports + portfolio entry points", () => {
    const page = readFileSync(join(process.cwd(), "src/app/(dashboard)/reports/page.tsx"), "utf8").toLowerCase();
    const advanced = readFileSync(
      join(process.cwd(), "src/app/(dashboard)/reports/reports-advanced-content.tsx"),
      "utf8"
    ).toLowerCase();
    const merged = `${page}\n${advanced}`;
    for (const w of ["operational", "export", "portfolio", "report", "execution"]) {
      expect(merged).toContain(w);
    }
  });
});
