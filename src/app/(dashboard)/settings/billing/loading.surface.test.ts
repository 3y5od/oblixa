import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// SPEC: docs/billing-page-refinement-pass.md §14.19 — loading.tsx
// skeleton shape pins.

const LOADING_SRC = readFileSync(
  join(process.cwd(), "src/app/(dashboard)/settings/billing/loading.tsx"),
  "utf8"
);

describe("billing loading.tsx — skeleton shape (§14.19)", () => {
  it("uses canonical .ui-skeleton + .ui-loading-panel classes", () => {
    expect(LOADING_SRC).toContain("ui-skeleton");
    expect(LOADING_SRC).toContain("ui-loading-panel");
  });

  it("sets aria-busy on the outer wrapper", () => {
    expect(LOADING_SRC).toContain('aria-busy="true"');
  });

  it("renders DashboardPageHeader with skeleton metaStrip", () => {
    expect(LOADING_SRC).toContain("DashboardPageHeader");
  });

  it("includes 8 dl row skeletons matching the canonical grid", () => {
    expect(LOADING_SRC).toContain("Array.from({ length: 8 })");
    expect(LOADING_SRC).toContain("sm:grid-cols-[10rem_minmax(0,1fr)]");
  });

  it("includes 6 FAQ row skeletons with medallion + 44px tap target", () => {
    expect(LOADING_SRC).toContain("Array.from({ length: 6 })");
    expect(LOADING_SRC).toContain("min-h-[44px]");
  });

  it("renders a footer skeleton (ChipCapsule placeholder)", () => {
    expect(LOADING_SRC).toContain("h-7 w-48");
  });
});
