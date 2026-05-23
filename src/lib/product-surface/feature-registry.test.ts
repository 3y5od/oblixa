import { describe, expect, it } from "vitest";
import { ROUTE_INVENTORY } from "@/lib/product-surface/route-inventory";
import { minWorkspaceModeForPath } from "@/lib/product-surface/routes";
import {
  eligibleReportTypeOptionsForWorkspaceMode,
  featureFamilyForApiPath,
  minWorkspaceModeForReportType,
  minWorkspaceModeForReportsHash,
  PRODUCT_FEATURE_REGISTRY,
  resolveSearchIndexFeatureFamily,
  SEARCH_INDEX_CLASSES,
  featureFamilyForPath,
  minWorkspaceModeForRegistryPath,
  workspaceModeAllowsReportType,
} from "@/lib/product-surface/feature-registry";

function examplePathForPattern(pattern: string): string {
  return pattern
    .replace(/\/\[id\]/g, "/00000000-0000-4000-8000-000000000001")
    .replace(/\/\[key\]/g, "/example-key");
}

describe("product feature registry", () => {
  it("contains unique family keys", () => {
    const keys = PRODUCT_FEATURE_REGISTRY.map((row) => row.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("keeps routes.ts and registry mode floors aligned", () => {
    for (const entry of ROUTE_INVENTORY) {
      const ex = examplePathForPattern(entry.pattern);
      expect(minWorkspaceModeForPath(ex), ex).toBe(minWorkspaceModeForRegistryPath(ex));
    }
  });

  it("resolves advanced/assurance inventory paths to a registry family", () => {
    for (const entry of ROUTE_INVENTORY) {
      if (entry.tier !== "advanced" && entry.tier !== "assurance") continue;
      const ex = examplePathForPattern(entry.pattern);
      expect(featureFamilyForPath(ex), ex).not.toBeNull();
    }
  });

  it("maps reports hashes and report types to expected workspace floors", () => {
    expect(minWorkspaceModeForReportsHash("campaign-drift")).toBe("advanced");
    expect(minWorkspaceModeForReportsHash("assurance-analytics")).toBe("assurance");
    expect(minWorkspaceModeForReportType("monthly_renewal_readiness")).toBe("core");
    expect(minWorkspaceModeForReportType("decision_queue_summary")).toBe("advanced");
    expect(minWorkspaceModeForReportType("scorecard_summary")).toBe("assurance");
  });

  it("keeps Evidence Studio Core-reachable through the registry", () => {
    expect(minWorkspaceModeForRegistryPath("/contracts/evidence-studio")).toBe("core");
    expect(featureFamilyForPath("/contracts/evidence-studio")).toBe("evidence");
    expect(SEARCH_INDEX_CLASSES.find((row) => row.key === "evidence")?.minWorkspaceMode).toBe(
      "core"
    );
  });

  it("workspaceModeAllowsReportType respects mode floor", () => {
    expect(workspaceModeAllowsReportType("core", "weekly_execution_health")).toBe(true);
    expect(workspaceModeAllowsReportType("core", "decision_queue_summary")).toBe(false);
    expect(workspaceModeAllowsReportType("advanced", "decision_queue_summary")).toBe(true);
    expect(workspaceModeAllowsReportType("advanced", "scorecard_summary")).toBe(false);
    expect(workspaceModeAllowsReportType("assurance", "scorecard_summary")).toBe(true);
  });

  it("eligibleReportTypeOptionsForWorkspaceMode excludes advanced types on Core", () => {
    const coreOpts = eligibleReportTypeOptionsForWorkspaceMode("core");
    expect(coreOpts).toContain("weekly_execution_health");
    expect(coreOpts).toContain("contract_portfolio_summary");
    expect(coreOpts).toContain("workspace_health_report");
    expect(coreOpts).toContain("monthly_renewal_readiness");
    expect(coreOpts.some((t) => t.includes("decision"))).toBe(false);
    const advOpts = eligibleReportTypeOptionsForWorkspaceMode("advanced");
    expect(advOpts).toContain("decision_queue_summary");
  });

  it("assigns explicit lifecycle to every advanced and assurance registry row (V7 §18.3)", () => {
    const lifecycles = new Set([
      "active",
      "contained",
      "experimental",
      "admin_only",
      "retired_visible",
      "retired_hidden",
    ]);
    for (const row of PRODUCT_FEATURE_REGISTRY) {
      if (row.parentDomain !== "advanced" && row.parentDomain !== "assurance") continue;
      expect(lifecycles.has(row.lifecycle), row.key).toBe(true);
    }
  });

  it("exports search classes including advanced and assurance classes", () => {
    const keys = new Set(SEARCH_INDEX_CLASSES.map((row) => row.key));
    expect(keys.has("contracts")).toBe(true);
    expect(keys.has("decisions")).toBe(true);
    expect(keys.has("findings")).toBe(true);
  });

  it("maps token calendar feed API paths to reports family for workspace eligibility (V7 §14)", () => {
    expect(featureFamilyForApiPath("/api/export/calendar/feed/abc")).toBe("reports");
  });

  it("maps contracts analytics to the advanced analytics family", () => {
    expect(featureFamilyForPath("/contracts/analytics")).toBe("advanced_analytics");
    expect(minWorkspaceModeForPath("/contracts/analytics")).toBe("advanced");
  });

  it("rescues legacy command-search families via module mapping and href fallback", () => {
    expect(
      resolveSearchIndexFeatureFamily({
        featureFamily: "obligations",
        moduleKey: "obligations",
        href: "/contracts/00000000-0000-4000-8000-000000000001?tab=obligations",
      })
    ).toBe("work");
    expect(
      resolveSearchIndexFeatureFamily({
        featureFamily: "imports",
        moduleKey: "imports",
        href: "/settings/health#jobs",
      })
    ).toBe("settings");
    expect(
      resolveSearchIndexFeatureFamily({
        featureFamily: "simulations",
        moduleKey: "simulations",
        href: "/campaigns/compare?simulation=sim_1",
      })
    ).toBe("compare_views");
    expect(
      resolveSearchIndexFeatureFamily({
        featureFamily: "review",
        moduleKey: "review",
        href: "/contracts/00000000-0000-4000-8000-000000000001?tab=overview#extracted-fields",
      })
    ).toBe("review");
  });
});
