import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

describe("V9 workspace tables keep horizontal scroll and aria labels", () => {
  it("aligns secondary queue tables with the contract-table scroll pattern", () => {
    for (const rel of [
      "src/app/(dashboard)/contracts/renewals/page.tsx",
      "src/app/(dashboard)/contracts/tasks/page.tsx",
      "src/app/(dashboard)/contracts/obligations/page.tsx",
      "src/app/(dashboard)/contracts/watchlists/page.tsx",
    ]) {
      const raw = read(rel);
      expect(raw, rel).toContain('className="overflow-x-auto"');
      expect(raw, rel).toContain("aria-label=");
    }
  });
});
