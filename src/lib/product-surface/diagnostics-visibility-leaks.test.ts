import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cmdkFilterRecentHrefsForSurface } from "@/lib/product-surface/resolver";
import { filterNavBadgesForSurface, type NavSurfaceInput } from "@/lib/product-surface/nav-visibility";

const DASHBOARD_PAGE = join(process.cwd(), "src/app/(dashboard)/dashboard/page.tsx");
const REPORT_PACKS_CRON = join(process.cwd(), "src/app/api/cron/v4/report-packs-generate/route.ts");
const NOTIFICATION_POLICY = join(process.cwd(), "src/lib/notification-policy.ts");
const API_WORKSPACE_GUARD = join(process.cwd(), "src/lib/product-surface/api-workspace-guard.ts");
const HREF_ELIGIBILITY = join(process.cwd(), "src/lib/product-surface/href-eligibility.ts");
const NAV_VISIBILITY = join(process.cwd(), "src/lib/product-surface/nav-visibility.ts");

const CORE_SURFACE: NavSurfaceInput = {
  mode: "core",
  role: "viewer",
  featureFlags: {
    v3TasksEngine: true,
    v3ObligationsExecution: true,
    v3ApprovalsSla: true,
    v3RenewalWorkspace: true,
    v3IntakePipeline: true,
    v3PersonaDashboards: true,
    v3ReportingHistory: true,
    v3AutomationExpansion: true,
    v5DecisionFoundation: true,
    v5PortfolioCampaigns: true,
    v5SimulationAndIntelligence: true,
    v5RelationshipLayer: true,
    v5ExternalCollaboration: true,
    v5ControlRoomUx: true,
    v6AssuranceCore: false,
    v6ControlPolicies: false,
    v6AdaptivePlaybooks: false,
    v6Autopilot: false,
    v6OutcomeIntelligence: false,
    v6ReviewBoards: false,
    v6Segments: false,
    v6AutopilotAllowExecution: false,
  },
  seesAdvancedPrimaryNav: false,
  seesAssuranceNav: false,
  advancedModulesHidden: [],
  assuranceModulesHidden: [],
  utilityModulesHidden: [],
  searchScope: "match_mode",
};

describe("product-surface diagnostics leak guards", () => {
  it("drops hidden badge keys from core nav badge payloads", () => {
    const filtered = filterNavBadgesForSurface({ watchlists: 7, reviewQueue: 2 }, CORE_SURFACE);
    expect(filtered.watchlists).toBeUndefined();
    expect(filtered.reviewQueue).toBe(2);
  });

  it("drops hidden recent cmd-k hrefs for core mode", () => {
    const filtered = cmdkFilterRecentHrefsForSurface(
      ["/dashboard", "/decisions", "/campaigns", "/contracts/review"],
      CORE_SURFACE
    );
    expect(filtered).toEqual(["/dashboard", "/contracts/review"]);
  });

  it("keeps dashboard advanced data fetching behind surface gates", () => {
    const raw = readFileSync(DASHBOARD_PAGE, "utf8");
    // v22 structural refactor: dashboard route is now Core-only — the
    // route never fetches Advanced/Assurance data sources (portfolio
    // intelligence, control-room telemetry, behavior metrics, etc.).
    // The prior inline `isCoreHome` + `showPortfolioIntel` gating was
    // unnecessary once the page stopped reading those sources. Verify
    // by absence: no advanced data fetches in page.tsx, all loading
    // delegated to loadCoreDashboardModel which queries only Core tables.
    expect(raw).toContain("loadCoreDashboardModel");
    expect(raw).not.toContain('.from("org_behavior_metrics")');
    expect(raw).not.toContain("V5ControlRoomStrip");
    expect(raw).not.toContain("DashboardAssuranceSignalsSection");
    expect(raw).not.toContain("DashboardOutcomeIntelligenceSection");
  });

  it("keeps report-pack cron delivery guarded by report mode and feature eligibility", () => {
    const raw = readFileSync(REPORT_PACKS_CRON, "utf8");
    expect(raw.includes("workspaceModeAtLeast(workspaceProductMode, minModeForReport)")).toBe(true);
    expect(raw.includes("evaluateFeatureEligibility")).toBe(true);
    expect(raw.includes("continue")).toBe(true);
  });

  it("keeps notification workspace-family gating in notification policy", () => {
    const raw = readFileSync(NOTIFICATION_POLICY, "utf8");
    expect(raw.includes("isNotificationTypeAllowedForWorkspace")).toBe(true);
    expect(raw.includes("NOTIFICATION_TAXONOMY_BY_TYPE")).toBe(true);
  });

  it("logs workspace-gate denial diagnostics from api guard", () => {
    const raw = readFileSync(API_WORKSPACE_GUARD, "utf8");
    expect(raw.includes("logProductSurfaceDiagnostic")).toBe(true);
    expect(raw.includes('"api_workspace_gate_denied"')).toBe(true);
  });

  it("logs href eligibility denial diagnostics for hidden paths", () => {
    const raw = readFileSync(HREF_ELIGIBILITY, "utf8");
    expect(raw.includes("logProductSurfaceDiagnostic")).toBe(true);
    expect(raw.includes('"href_eligibility_denied"')).toBe(true);
  });

  it("logs nav badge payload filtering diagnostics when keys are removed", () => {
    const raw = readFileSync(NAV_VISIBILITY, "utf8");
    expect(raw.includes("logProductSurfaceDiagnostic")).toBe(true);
    expect(raw.includes('"nav_badge_payload_filtered"')).toBe(true);
  });
});
