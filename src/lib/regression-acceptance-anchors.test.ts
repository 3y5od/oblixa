import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("V9 §29 acceptance + regression bundle anchors", () => {
  it("keeps core regression harness files on disk", () => {
    for (const rel of [
      "src/lib/regression-bridge.test.ts",
      "src/lib/plan-enforcement-bundles.test.ts",
      "src/lib/zod-touched-actions.test.ts",
      "src/lib/acceptance-criteria.test.ts",
      "src/lib/api-critical-routes-matrix.test.ts",
    ]) {
      expect(existsSync(join(process.cwd(), rel)), rel).toBe(true);
    }
  });
});
