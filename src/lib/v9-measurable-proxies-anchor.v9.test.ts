import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("V9 §30 measurable proxy artifacts", () => {
  it("retains completion + autonomous surface harness entrypoints", () => {
    for (const rel of [
      "src/lib/v9-completion-proxies.v9.test.ts",
      "src/lib/v9-autonomous-plan-surfaces.v9.test.ts",
      "src/lib/v9-section-30-preamble.ts",
      "e2e/v9-core-smoke.spec.ts",
      "src/components/layout/v9-page-load-reporter.tsx",
    ]) {
      expect(existsSync(join(process.cwd(), rel)), rel).toBe(true);
    }
  });
});
