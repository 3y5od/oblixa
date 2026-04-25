import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** §27.2 bullets must remain documented; UI anchors are distributed across job copy + health. */
describe("V9 §27.2 reliability states map", () => {
  it("retains required state vocabulary in docs", () => {
    const doc = readFileSync(join(process.cwd(), "docs", "v9.md"), "utf8");
    for (const phrase of [
      "extraction in progress",
      "extraction failed",
      "import in progress",
      "import failed or partial",
      "reminder active",
      "reminder inactive due to missing approved dates",
      "report generation in progress",
      "report generation failed",
    ]) {
      expect(doc.toLowerCase()).toContain(phrase);
    }
  });

  it("anchors job lifecycle copy + health diagnostics surfaces", () => {
    expect(readFileSync(join(process.cwd(), "src/lib/v9-job-lifecycle-copy.ts"), "utf8").length).toBeGreaterThan(
      80
    );
    expect(readFileSync(join(process.cwd(), "src/app/(dashboard)/settings/health/page.tsx"), "utf8")).toContain(
      "Health"
    );
  });

  it("surfaces extraction job freshness via shared §27 relative-age helper", () => {
    const alert = readFileSync(join(process.cwd(), "src/components/contracts/extraction-job-alert.tsx"), "utf8");
    expect(alert).toContain("formatRelativeSampleAge");
    expect(alert).toContain("@/lib/v9-data-freshness");
  });
});
