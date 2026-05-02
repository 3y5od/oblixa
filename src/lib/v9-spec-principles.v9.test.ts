import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  V9_IMPLEMENTATION_PREFERENCES,
  V9_OPTIMIZATION_DIMENSIONS,
  V9_VISIBLE_PRODUCT_OUTCOMES,
} from "./v9-release-contract";

/**
 * §1 / §2 / §4 principles — each theme/outcome maps to ≥1 automated test path (non-behavioral anchor).
 */
const THEME_ANCHORS: { theme: string; files: string[] }[] = [
  { theme: "usability", files: ["src/components/contracts/contract-table.tsx"] },
  { theme: "reliability", files: ["src/lib/v9-job-lifecycle-copy.ts"] },
  { theme: "performance", files: ["src/components/layout/v9-page-load-reporter.tsx"] },
  { theme: "consistency", files: ["src/lib/contracts.ts"] },
  { theme: "operational trust", files: ["src/lib/recoverable-mutation-error.ts"] },
  { theme: "data quality", files: ["src/lib/review-feedback.ts"] },
  { theme: "workflow speed", files: ["src/app/(dashboard)/contracts/review/page.tsx"] },
  { theme: "error handling", files: ["src/app/(dashboard)/error.tsx"] },
  { theme: "quality of visible behavior", files: ["src/lib/v9-hardening.v9.test.ts"] },
];

const OUTCOME_ANCHORS = [
  "src/components/dashboard/dashboard-lower.tsx",
  "src/app/(dashboard)/work/page.tsx",
  "src/lib/product-telemetry.ts",
];

const OPTIMIZATION_ANCHORS = [
  "src/lib/contract-list.ts",
  "src/lib/product-surface/resolver.ts",
  "src/components/layout/command-palette.tsx",
];

const PREFERENCE_ANCHORS = [
  "src/lib/v9-security-surface-guard.v9.test.ts",
  "src/lib/product-surface/refinement-contract.test.ts",
];

describe("V9 spec principles trace anchors", () => {
  it("§1 nine improvement themes have file anchors", () => {
    expect(THEME_ANCHORS).toHaveLength(9);
    for (const row of THEME_ANCHORS) {
      for (const f of row.files) {
        expect(f.startsWith("src/"), f).toBe(true);
        expect(existsSync(join(process.cwd(), f)), f).toBe(true);
      }
    }
  });

  it("§1 theme vocabulary stays explicit in the anchor list", () => {
    expect(THEME_ANCHORS.map((row) => row.theme)).toEqual([
      "usability",
      "reliability",
      "performance",
      "consistency",
      "operational trust",
      "data quality",
      "workflow speed",
      "error handling",
      "quality of visible behavior",
    ]);
  });

  it("§2 six visible-product outcomes + seven optimization dimensions stay codified", () => {
    expect(V9_VISIBLE_PRODUCT_OUTCOMES).toHaveLength(6);
    expect(V9_VISIBLE_PRODUCT_OUTCOMES[0]).toContain("understandable");
    expect(V9_OPTIMIZATION_DIMENSIONS).toHaveLength(7);
    expect(V9_OPTIMIZATION_DIMENSIONS[0]).toContain("workflow refinement");
  });

  it("§4 five implementation preferences stay codified", () => {
    expect(V9_IMPLEMENTATION_PREFERENCES).toHaveLength(5);
    expect(V9_IMPLEMENTATION_PREFERENCES[0]).toContain("refinement over addition");
  });

  it("§2 / §4 proxy lists stay wired", () => {
    expect(OUTCOME_ANCHORS.length).toBeGreaterThanOrEqual(3);
    expect(OPTIMIZATION_ANCHORS.length).toBeGreaterThanOrEqual(3);
    expect(PREFERENCE_ANCHORS.length).toBeGreaterThanOrEqual(2);
  });
});
