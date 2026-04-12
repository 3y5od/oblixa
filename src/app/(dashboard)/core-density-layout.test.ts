import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CORE_PAGES = [
  "src/app/(dashboard)/dashboard/page.tsx",
  "src/app/(dashboard)/work/page.tsx",
  "src/app/(dashboard)/contracts/page.tsx",
  "src/app/(dashboard)/contracts/review/page.tsx",
] as const;

describe("core density layout pass", () => {
  for (const rel of CORE_PAGES) {
    it(`keeps tokenized page stack structure in ${rel}`, () => {
      const raw = readFileSync(join(process.cwd(), rel), "utf8");
      expect(raw.includes("ui-page-stack") || raw.includes("ui-panel") || raw.includes("ui-card")).toBe(true);
    });
  }
});
