import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("V9 §19.1–19.2 reports operational emphasis", () => {
  it("reports shell emphasizes Core operational exports without Advanced/Assurance framing", () => {
    const page = readFileSync(join(process.cwd(), "src/app/(dashboard)/reports/page.tsx"), "utf8");
    const spec = readFileSync(join(process.cwd(), "src/lib/reports/spec-strings.ts"), "utf8");
    const merged = `${page}\n${spec}`.toLowerCase();
    for (const w of ["reports", "export report", "preview table", "last generated timestamp"]) {
      expect(merged).toContain(w);
    }
    for (const forbidden of ["outcome intelligence", "assurance scorecards", "autopilot results"]) {
      expect(merged).not.toContain(forbidden);
    }
  });
});
