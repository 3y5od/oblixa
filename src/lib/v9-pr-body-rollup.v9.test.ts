import { describe, expect, it } from "vitest";
import { renderV9PrBodyRollup } from "@/lib/v9-pr-body-rollup";

describe("V9 PR body rollup renderer", () => {
  it("includes spec sections, green scripts, and test-anchor updates", () => {
    const body = renderV9PrBodyRollup({
      summaryBullets: ["Tighten visual anchors and normalize business-date rendering."],
      specSectionsTouched: ["§19.3", "§24", "§26"],
      scriptsRunGreen: ["`npm run lint`", "`npm run typecheck`"],
      testAnchorUpdates: ["Updated `src/lib/v9-spec-trace-map.ts` for §24."],
    });

    expect(body).toContain("## Summary");
    expect(body).toContain("## Validation");
    expect(body).toContain("## Implementation Rollup");
    expect(body).toContain("References touched: §19.3, §24, §26");
    expect(body).toContain("`npm run lint`");
    expect(body).toContain("Test-anchor updates: Updated `src/lib/v9-spec-trace-map.ts` for §24.");
  });

  it("ships a safe placeholder template when details are omitted", () => {
    const body = renderV9PrBodyRollup();
    expect(body).toContain("List the implementation references touched in this batch.");
    expect(body).toContain("List the acceptance scripts that ran green.");
    expect(body).toContain("Test-anchor updates: None.");
  });
});
