import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** When thresholds change, update this test in the same PR as vitest.config.ts */
const EXPECTED_THRESHOLDS = {
  lines: 50,
  functions: 60,
  branches: 45,
  statements: 48,
} as const;

const REQUIRED_INCLUDE_GLOBS = [
  "src/lib/v5/**/*.ts",
  "src/lib/v5/**/*.tsx",
  "src/lib/security/**/*.ts",
  "src/lib/observability/**/*.ts",
  "src/lib/errors/**/*.ts",
  "src/lib/ui/**/*.ts",
  "src/lib/stripe.ts",
];

describe("vitest.config.ts coverage policy", () => {
  it("pins thresholds and required include globs", () => {
    const raw = fs.readFileSync(path.join(process.cwd(), "vitest.config.ts"), "utf8");
    for (const [k, v] of Object.entries(EXPECTED_THRESHOLDS)) {
      expect(raw).toContain(`${k}: ${v}`);
    }
    for (const g of REQUIRED_INCLUDE_GLOBS) {
      expect(raw).toContain(g);
    }
    expect(raw).toContain("**/src/lib/qa/**");
    expect(raw).toContain("exclude:");
  });
});
