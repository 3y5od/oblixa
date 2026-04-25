import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("V9 §29 acceptance + regression bundle anchors", () => {
  it("keeps core regression harness files on disk", () => {
    for (const rel of [
      "src/lib/v9-regression-bridge.v9.test.ts",
      "src/lib/v9-plan-enforcement-bundles.v9.test.ts",
      "src/lib/v9-zod-v9-touched-actions.v9.test.ts",
      "src/lib/v9-acceptance-criteria.test.ts",
      "src/lib/v9-api-critical-routes-matrix.v9.test.ts",
    ]) {
      expect(existsSync(join(process.cwd(), rel)), rel).toBe(true);
    }
  });
});
