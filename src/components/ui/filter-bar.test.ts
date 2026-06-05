import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const FILTER_BAR = join(process.cwd(), "src/components/ui/filter-bar.tsx");

describe("shared FilterBar / FilterSelect contract", () => {
  const src = readFileSync(FILTER_BAR, "utf8");

  it("is the single toolbar recipe — toolbar band, pill h-10, no native select", () => {
    // The one band class every Core filter bar reuses.
    expect(src).toContain("ui-filter-toolbar");
    // The locked pill height (40px) — never a native <select> (§7.3 / §11.1).
    expect(src).toContain("h-10");
    expect(src).not.toMatch(/<select[\s>]/);
  });

  it("renders a Filters count chip + Clear only when filters are active", () => {
    expect(src).toContain("CountChip");
    // The "Filters N" chip and the Clear link are both gated on the active count.
    expect(src).toContain("activeFilterCount > 0");
    expect(src).toContain("Clear filters");
  });

  it("composes an accessible name that pairs the label with its current value", () => {
    // e.g. "Owner: Any owner" rather than a bare "Owner" that hides the selection.
    expect(src).toContain("${label}: ${selectedLabel}");
  });

  it("drives the active-filter tint through an inline style override", () => {
    // Inline style is the only reliable override of the base pill border/bg.
    expect(src).toContain("buttonStyle");
    expect(src).toContain("ACTIVE_TINT");
  });
});
