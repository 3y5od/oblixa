import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Server modules that are central to V9 telemetry / activation and must keep schema validation. */
const V9_ZOD_TOUCHED_ACTIONS = [
  "src/actions/onboarding-calibration.ts",
  "src/actions/product-telemetry.ts",
] as const;

describe("V9-touched server actions keep Zod imports", () => {
  it("each listed action file imports zod", () => {
    for (const rel of V9_ZOD_TOUCHED_ACTIONS) {
      const body = readFileSync(join(process.cwd(), rel), "utf8");
      expect(body.includes('from "zod"') || body.includes("from 'zod'"), rel).toBe(true);
    }
  });
});
