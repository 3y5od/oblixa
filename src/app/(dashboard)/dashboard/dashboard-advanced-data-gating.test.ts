import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DASHBOARD_PAGE = join(process.cwd(), "src/app/(dashboard)/dashboard/page.tsx");

describe("dashboard advanced data gating (source tripwire)", () => {
  it("keeps portfolio intelligence behind non-core mode checks", () => {
    const raw = readFileSync(DASHBOARD_PAGE, "utf8");
    expect(raw.includes('const isCoreHome = productSurface.mode === "core";')).toBe(true);
    expect(
      raw.includes(
        'const showPortfolioIntel =\n    !isCoreHome && (productSurface.mode === "advanced" || productSurface.mode === "assurance");'
      )
    ).toBe(true);
  });

  it("only fetches compact telemetry after showPortfolioIntel gate", () => {
    const raw = readFileSync(DASHBOARD_PAGE, "utf8");
    const needle = '.from("org_behavior_metrics")';
    const idx = raw.indexOf(needle);
    expect(idx).toBeGreaterThan(-1);
    const slice = raw.slice(Math.max(0, idx - 800), idx);
    expect(
      slice.includes(
        "showPortfolioIntel && (intelligenceOn || showControlRoomStrip) && canViewV5Telemetry"
      )
    ).toBe(true);
  });
});
