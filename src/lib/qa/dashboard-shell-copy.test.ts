import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SHELL_FILES = [
  "src/app/(dashboard)/error.tsx",
  "src/app/(dashboard)/dashboard/loading.tsx",
  "src/app/(dashboard)/settings/loading.tsx",
] as const;

describe("dashboard shell copy stays Core-neutral (V7 §22.3)", () => {
  for (const rel of SHELL_FILES) {
    it(`does not upsell hidden product families in ${rel}`, () => {
      const raw = readFileSync(join(process.cwd(), rel), "utf8");
      expect(raw).not.toMatch(/\bDecisions\b/);
      expect(raw).not.toMatch(/\bCampaigns\b/);
      expect(raw).not.toMatch(/\bAssurance\b/);
    });
  }
});
