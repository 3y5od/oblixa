import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CORE_PLAN_LIMITS,
  CORE_SIDEBAR_NAV,
  DASHBOARD_BANNED_VOCABULARY,
  DASHBOARD_MAIN_SECTIONS,
  DASHBOARD_PRIMARY_CTA,
  DASHBOARD_SECONDARY_CTA,
  DASHBOARD_TITLE,
  DASHBOARD_TOP_CARDS,
} from "@/lib/dashboard/spec-strings";
import { deriveCoreDashboardTopCards } from "@/lib/dashboard/core-dashboard-model";
import { NAV_ITEMS, PRIMARY_NAV_GROUPS } from "@/lib/navigation";

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

const pageRaw = read("src/app/(dashboard)/dashboard/page.tsx");
const componentRaw = read("src/components/dashboard/core-dashboard.tsx");
const modelRaw = read("src/lib/dashboard/core-dashboard-model.ts");
const loadingRaw = read("src/app/(dashboard)/dashboard/loading.tsx");
const headerRaw = read("src/components/layout/header.tsx");

describe("dashboard spec compliance - Core route structure", () => {
  it("keeps the public /dashboard route title fixed to release state", () => {
    expect(DASHBOARD_TITLE).toBe("Contract tracking");
    expect(pageRaw).toContain("export const metadata = { title: DASHBOARD_TITLE }");
    expect(componentRaw).toContain("title={DASHBOARD_TITLE}");
  });

  it("renders stable Core header CTAs and does not promote Review fields into the header", () => {
    expect(DASHBOARD_PRIMARY_CTA).toBe("Upload contract");
    expect(DASHBOARD_SECONDARY_CTA).toBe("Import CSV");
    expect(componentRaw).toContain("{DASHBOARD_PRIMARY_CTA}");
    expect(componentRaw).toContain("{DASHBOARD_SECONDARY_CTA}");
    expect(componentRaw).toContain('href="/contracts/new"');
    expect(componentRaw).toContain('href="/contracts/bulk"');
    expect(componentRaw).not.toContain("metrics.pendingReview > 0");
  });

  it("treats legacy view and quick-filter query params as no-op compatibility inputs", () => {
    expect(pageRaw).toContain("legacyView");
    expect(pageRaw).toContain("legacyQuickFilter");
    expect(pageRaw).toContain("void legacyView");
    expect(pageRaw).toContain("void legacyQuickFilter");
    expect(pageRaw).not.toContain("quickFilter=");
    expect(pageRaw).not.toContain("view=");
  });

  it("does not import or render the removed dashboard upper/lower split", () => {
    expect(pageRaw).not.toContain("DashboardUpper");
    expect(pageRaw).not.toContain("DashboardLower");
    expect(pageRaw).toContain("CoreDashboard");
    expect(pageRaw).toContain("loadCoreDashboardModel");
  });
});

describe("dashboard spec compliance - fixed top cards", () => {
  it("defines exactly six release-state top cards in fixed order", () => {
    expect([...DASHBOARD_TOP_CARDS]).toEqual([
      "Needs review",
      "Upcoming deadlines",
      "Blocked work",
      "Missing owners",
      "Open exceptions",
      "Evidence requested",
    ]);

    const cards = deriveCoreDashboardTopCards({
      needsReview: 1,
      upcomingDeadlines: 2,
      blockedWork: 3,
      missingOwners: 4,
      openExceptions: 5,
      evidenceRequested: 6,
    });
    expect(cards.map((card) => card.label)).toEqual([...DASHBOARD_TOP_CARDS]);
    expect(cards).toHaveLength(6);
  });

  it("renders model top cards without active sorting or extra Core cards", () => {
    expect(componentRaw).toContain("model.topCards.map");
    expect(componentRaw).not.toContain("ui-page-stack-divided");
    expect(componentRaw).toContain("function TopSignal");
    expect(modelRaw).toContain("const TOP_CARD_ORDER");
    expect(modelRaw).not.toContain("displayFocusCards");
    expect(modelRaw).not.toContain(".sort((a, b) => Number(b.isActive)");
    for (const staleCard of [
      "Assigned work",
      "Pending approvals",
      "Recent changes",
      "Renewals needing attention",
    ]) {
      expect(modelRaw).not.toContain(staleCard);
      expect(componentRaw).not.toContain(staleCard);
    }
  });

  it("counts Blocked work from visible v10_work_items instead of a zero stub", () => {
    expect(modelRaw).toContain('from("v10_work_items")');
    expect(modelRaw).toContain("applyV10ReadModelVisibility");
    expect(modelRaw).toContain('.eq("status", "blocked")');
    expect(modelRaw).not.toContain("blockedWork: 0");
  });
});

describe("dashboard spec compliance - fixed main sections", () => {
  it("defines exactly five release-state main sections in fixed order", () => {
    expect(DASHBOARD_MAIN_SECTIONS.map((section) => section.name)).toEqual([
      "Review Queue",
      "Upcoming Deadlines",
      "Work Needing Action",
      "Data Gaps",
      "Recent Activity",
    ]);
    expect(DASHBOARD_MAIN_SECTIONS.map((section) => section.action)).toEqual([
      "Review fields",
      "Create reminder",
      "Open work",
      "Fix missing data",
      null,
    ]);
  });

  it("renders only model sections from the Core model", () => {
    expect(componentRaw).toContain("orderedSections.map");
    expect(componentRaw).toContain('getSection(model, "review_queue")');
    expect(componentRaw).toContain('getSection(model, "recent_activity")');
    expect(modelRaw).toContain("sections: [");
    for (const key of [
      "review_queue",
      "upcoming_deadlines",
      "work_needing_action",
      "data_gaps",
      "recent_activity",
    ]) {
      expect(modelRaw).toContain(`key: "${key}"`);
    }
  });

  it("uses the required Core data sources for each section", () => {
    expect(modelRaw).toContain("fetchReviewQueuePage");
    expect(modelRaw).toContain("getReviewStatsForContractIds");
    expect(modelRaw).toContain("attachOwnerProfiles");
    expect(modelRaw).toContain("DASHBOARD_DEADLINE_FIELDS");
    expect(modelRaw).toContain("notice_window");
    expect(modelRaw).toContain("subDays(renewalDate, noticeDays)");
    expect(modelRaw).toContain("buildWorkRows");
    expect(modelRaw).toContain("buildExceptionWorkRows");
    expect(modelRaw).toContain("buildDataGapRows");
    expect(modelRaw).toContain('from("v10_contract_activity_events")');
    expect(modelRaw).toContain('from("audit_events")');
    expect(modelRaw).toContain("DASHBOARD_AUDIT_ACTIVITY_ACTIONS");
  });

  it("keeps optional count-source errors out of the dominant partial-data alert", () => {
    expect(componentRaw).toContain("getCoreDashboardVisiblePartialErrors");
    expect(componentRaw).toContain("PartialDataNotice count={visiblePartialErrors.length}");
    expect(modelRaw).toContain("NON_BLOCKING_PARTIAL_SOURCES");
  });
});

describe("dashboard spec compliance - Core vocabulary", () => {
  it("does not render public Advanced or Assurance framing in Core dashboard files", () => {
    for (const raw of [pageRaw, componentRaw, modelRaw]) {
      expect(raw).not.toMatch(/\bAdvanced\b/);
      expect(raw).not.toMatch(/\bAssurance\b/);
      expect(raw).not.toContain("Exceptions and decisions requiring attention");
      expect(raw).not.toContain("Daily brief");
    }
  });

  it("keeps the release-state banned vocabulary list pinned", () => {
    for (const term of [
      "Portfolio",
      "Pulse",
      "Execution workspace",
      "Health graph",
      "Autopilot",
    ]) {
      expect(DASHBOARD_BANNED_VOCABULARY as ReadonlyArray<string>).toContain(term);
    }
  });
});

describe("dashboard spec compliance - navigation and shell", () => {
  it("Core primary nav contains the release-state items in order", () => {
    expect([...CORE_SIDEBAR_NAV]).toEqual([
      "Dashboard",
      "Contracts",
      "Work",
      "Renewals",
      "Evidence",
      "Reports",
      "Settings",
    ]);

    const workspace = PRIMARY_NAV_GROUPS.find((group) => group.label === "Workspace");
    expect(workspace?.hrefs).toEqual([
      "/dashboard",
      "/contracts",
      "/work",
      "/contracts/renewals",
      "/contracts/evidence-studio",
      "/reports",
      "/settings",
    ]);
  });

  it("Tools header button remains gated for Core users", () => {
    expect(headerRaw).toContain('navSurface?.mode !== "core"');
  });

  it("Core plan limits match release state", () => {
    expect(CORE_PLAN_LIMITS.activeContracts).toBe(500);
    expect(CORE_PLAN_LIMITS.teamMembers).toBe(10);
  });

  it("primary nav items beyond Core are gated", () => {
    const allowed = new Set<string>([...CORE_SIDEBAR_NAV, "Tools"]);
    const gatedPrefixes = [
      "/decisions",
      "/campaigns",
      "/contracts/programs",
      "/contracts/execution-graph",
      "/relationship-workspaces",
      "/accounts",
      "/counterparties",
      "/assurance",
    ];
    for (const item of NAV_ITEMS) {
      if (item.section !== "primary" || allowed.has(item.name)) continue;
      const hasV5Gate = (item.v5FlagsAnyOf ?? []).length > 0;
      const hasRouteGate = gatedPrefixes.some((prefix) => item.href.startsWith(prefix));
      expect(hasV5Gate || hasRouteGate, `${item.name} (${item.href}) must be Core-gated`).toBe(true);
    }
  });
});

describe("dashboard spec compliance - loading skeleton parity", () => {
  it("matches six Core cards and five Core sections", () => {
    expect(loadingRaw).toContain("Array.from({ length: 6 })");
    expect(loadingRaw).toContain("Array.from({ length: 5 })");
    expect(loadingRaw).not.toContain("Segmented control");
    expect(loadingRaw).not.toContain("Daily brief");
  });
});
