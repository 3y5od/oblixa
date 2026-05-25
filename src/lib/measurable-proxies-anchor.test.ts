import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("V9 §30 measurable proxy artifacts", () => {
  it("retains completion + autonomous surface harness entrypoints", () => {
    for (const rel of [
      "src/lib/completion-proxies.test.ts",
      "src/lib/autonomous-plan-surfaces.test.ts",
      "src/lib/section-30-preamble.ts",
      "e2e/compatibility-core-smoke.spec.ts",
      "src/components/layout/page-load-reporter.tsx",
    ]) {
      expect(existsSync(join(process.cwd(), rel)), rel).toBe(true);
    }
  });
});
