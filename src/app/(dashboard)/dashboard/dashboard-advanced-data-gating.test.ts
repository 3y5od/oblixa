import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DASHBOARD_PAGE = join(process.cwd(), "src/app/(dashboard)/dashboard/page.tsx");

describe("dashboard advanced data gating (source tripwire)", () => {
  // v22 structural refactor: the dashboard route is now Core-only. The
  // page never fetches Advanced/Assurance data sources, so the prior
  // inline `isCoreHome` + `showPortfolioIntel` gating was deleted along
  // with the source fetches it guarded. The tripwire is now an
  // ABSENCE check: the page must NOT pull advanced data sources at all,
  // and must delegate Core data loading to the spec-compliant model.

  it("does not fetch portfolio intelligence on the Core dashboard route", () => {
    const raw = readFileSync(DASHBOARD_PAGE, "utf8");
    expect(raw).not.toContain("showPortfolioIntel");
    expect(raw).not.toContain('.from("org_behavior_metrics")');
    expect(raw).not.toContain('.from("v5_signal_quality")');
    expect(raw).not.toContain("V5ControlRoomStrip");
    expect(raw).not.toContain("V5TelemetryCompact");
  });

  it("delegates data loading to the Core dashboard model (loadCoreDashboardModel)", () => {
    const raw = readFileSync(DASHBOARD_PAGE, "utf8");
    expect(raw).toContain("loadCoreDashboardModel");
    expect(raw).toContain("<CoreDashboard");
    // Page is a thin wrapper around the Core composition — no inline
    // Advanced/Assurance section guards remain.
    expect(raw).not.toContain("DashboardAssuranceSignalsSection");
    expect(raw).not.toContain("DashboardOutcomeIntelligenceSection");
    expect(raw).not.toContain("DashboardV6AssuranceSnapshotSection");
  });
});
