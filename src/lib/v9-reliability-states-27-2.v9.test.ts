import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { V9_RELIABILITY_STATES } from "./v9-release-contract";

/** §27.2 bullets must remain codified; UI anchors are distributed across job copy + health. */
describe("V9 §27.2 reliability states map", () => {
  it("retains required state vocabulary", () => {
    expect(V9_RELIABILITY_STATES).toHaveLength(8);
    expect(V9_RELIABILITY_STATES).toContain("reminder inactive due to missing approved dates");
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
