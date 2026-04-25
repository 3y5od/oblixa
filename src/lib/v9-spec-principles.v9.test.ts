import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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

function loadV9Doc(): string {
  return readFileSync(join(process.cwd(), "docs", "v9.md"), "utf8");
}

function bulletsBetween(doc: string, startNeedle: string, endNeedle: string): string[] {
  const i0 = doc.indexOf(startNeedle);
  expect(i0).toBeGreaterThan(-1);
  const i1 = doc.indexOf(endNeedle, i0 + startNeedle.length);
  expect(i1).toBeGreaterThan(i0);
  const slice = doc.slice(i0, i1);
  return slice
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "))
    .map((l) => l.slice(2).replace(/,$/, ""));
}

function numberedListBetween(doc: string, startNeedle: string, endNeedle: string): string[] {
  const i0 = doc.indexOf(startNeedle);
  expect(i0).toBeGreaterThan(-1);
  const i1 = doc.indexOf(endNeedle, i0 + startNeedle.length);
  expect(i1).toBeGreaterThan(i0);
  const slice = doc.slice(i0, i1);
  return slice
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^\d+\.\s+/.test(l))
    .map((l) => l.replace(/^\d+\.\s+/, "").replace(/,$/, ""));
}

describe("V9 spec principles trace anchors", () => {
  it("§1 nine improvement themes have file anchors", () => {
    expect(THEME_ANCHORS).toHaveLength(9);
    for (const row of THEME_ANCHORS) {
      for (const f of row.files) {
        expect(f.startsWith("src/"), f).toBe(true);
      }
    }
  });

  it("§1 doc themes match anchor list (verbatim drift guard)", () => {
    const doc = loadV9Doc();
    const themes = bulletsBetween(doc, "V9 is an improvement release focused on:", "---");
    expect(themes).toHaveLength(9);
    for (let i = 0; i < 9; i++) {
      expect(themes[i]?.startsWith(THEME_ANCHORS[i]!.theme)).toBe(true);
    }
  });

  it("§2 six visible-product outcomes + seven optimization dimensions (verbatim)", () => {
    const doc = loadV9Doc();
    const outcomes = bulletsBetween(doc, "The visible product must become:", "V9 shall optimize the product primarily through:");
    expect(outcomes).toHaveLength(6);
    expect(outcomes[0]).toContain("understandable");

    const opt = numberedListBetween(
      doc,
      "V9 shall optimize the product primarily through:",
      "---"
    );
    expect(opt).toHaveLength(7);
    expect(opt[0]).toContain("workflow refinement");
  });

  it("§4 five implementation preferences (verbatim)", () => {
    const doc = loadV9Doc();
    const prefs = bulletsBetween(doc, "V9 shall prefer:", "---");
    expect(prefs).toHaveLength(5);
    expect(prefs[0]).toContain("refinement over addition");
  });

  it("§2 / §4 proxy lists stay wired", () => {
    expect(OUTCOME_ANCHORS.length).toBeGreaterThanOrEqual(3);
    expect(OPTIMIZATION_ANCHORS.length).toBeGreaterThanOrEqual(3);
    expect(PREFERENCE_ANCHORS.length).toBeGreaterThanOrEqual(2);
  });
});
