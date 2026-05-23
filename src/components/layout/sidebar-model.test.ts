import { describe, expect, it } from "vitest";
import type { FeatureFlagKey } from "@/lib/feature-flags";
import type { NavSurfaceInput } from "@/lib/product-surface/nav-visibility";
import { buildSidebarModel, parseSidebarHref, isSidebarHrefExactActive, sidebarPrefetch } from "./sidebar-model";

const allFlags = {
  v5DecisionFoundation: true,
  v5ControlRoomUx: true,
  v5PortfolioCampaigns: true,
  v5RelationshipLayer: true,
  v6AssuranceCore: true,
  v6ControlPolicies: true,
  v6AdaptivePlaybooks: true,
  v6ReviewBoards: true,
  v6Autopilot: true,
  v6Segments: true,
  v6OutcomeIntelligence: true,
} as Record<FeatureFlagKey, boolean>;

function surface(overrides: Partial<NavSurfaceInput> = {}): NavSurfaceInput {
  return {
    mode: "core",
    role: "viewer",
    featureFlags: {} as Record<FeatureFlagKey, boolean>,
    seesAdvancedPrimaryNav: false,
    seesAssuranceNav: false,
    advancedModulesHidden: [],
    assuranceModulesHidden: [],
    utilityModulesHidden: [],
    searchScope: "match_mode",
    ...overrides,
  };
}

function model(input: Partial<Parameters<typeof buildSidebarModel>[0]> = {}) {
  return buildSidebarModel({
    pathname: "/dashboard",
    search: "",
    hash: "",
    surface: surface(),
    navBadges: {},
    showToolsLink: true,
    forcedCollapsed: false,
    ...input,
  });
}

function topLevelNames(m = model()) {
  return m.sections.flatMap((section) => section.items.map((item) => item.name));
}

function primaryNames(m = model()) {
  return m.sections
    .filter((section) => section.variant === "primary" || section.variant === "rail")
    .flatMap((section) => section.items.map((item) => item.name));
}

function findItem(name: string, m = model()) {
  return m.sections.flatMap((section) => section.items).find((item) => item.name === name);
}

describe("sidebar model", () => {
  it("keeps the Core primary navigation contract", () => {
    expect(primaryNames()).toEqual([
      "Dashboard",
      "Contracts",
      "Work",
      "Renewals",
      "Evidence",
      "Reports",
      "Settings",
    ]);
  });

  it("keeps the Core admin primary navigation contract without advanced access", () => {
    expect(primaryNames(model({ surface: surface({ role: "admin" }) }))).toEqual(primaryNames());
  });

  it("shows Advanced primary labels when advanced nav is allowed", () => {
    const names = primaryNames(model({ surface: surface({ mode: "advanced", role: "admin", featureFlags: allFlags, seesAdvancedPrimaryNav: true }) }));
    expect(names).toEqual(expect.arrayContaining(["Decisions", "Campaigns", "Programs", "Relationships"]));
  });

  it("hides Advanced primary labels for Advanced viewers without advanced nav access", () => {
    const names = primaryNames(model({ surface: surface({ mode: "advanced", role: "viewer", featureFlags: allFlags, seesAdvancedPrimaryNav: false }) }));
    expect(names).not.toEqual(expect.arrayContaining(["Decisions", "Campaigns", "Programs", "Relationships"]));
  });

  it("shows Assurance primary and child labels when assurance nav is allowed", () => {
    const m = model({ surface: surface({ mode: "assurance", role: "manager", featureFlags: allFlags, seesAdvancedPrimaryNav: true, seesAssuranceNav: true }) });
    const assurance = findItem("Assurance", m);
    expect(assurance?.children.map((child) => child.name)).toEqual([
      "Findings",
      "Control policies",
      "Scorecards",
      "Playbooks",
      "Review boards",
      "Autopilot",
      "Segments",
      "Program evolution",
      "Health graph",
    ]);
  });

  it("hides advanced and assurance modules for Core", () => {
    expect(topLevelNames()).not.toEqual(expect.arrayContaining(["Decisions", "Campaigns", "Programs", "Relationships", "Assurance"]));
  });

  it("removes hidden advanced, assurance, and utility modules including badges", () => {
    const m = model({
      surface: surface({
        mode: "assurance",
        role: "admin",
        featureFlags: allFlags,
        seesAdvancedPrimaryNav: true,
        seesAssuranceNav: true,
        advancedModulesHidden: ["campaigns"],
        assuranceModulesHidden: ["playbooks"],
        utilityModulesHidden: ["watchlists", "more_tools"],
      }),
      navBadges: { reviewQueue: 4, watchlists: 7 },
      showToolsLink: false,
    });
    expect(topLevelNames(m)).not.toContain("Campaigns");
    expect(topLevelNames(m)).not.toContain("Tools");
    expect(findItem("Assurance", m)?.children.map((child) => child.name)).not.toContain("Playbooks");
    expect(findItem("Watchlists", m)).toBeUndefined();
    expect(findItem("Contracts", m)?.children.find((child) => child.name === "Review fields")?.badge?.displayValue).toBe("4");
  });

  it("marks the release-state Work destination exact-active without legacy child lanes", () => {
    const m = model({ pathname: "/work" });
    const work = findItem("Work", m);
    expect(work?.active).toBe(true);
    expect(work?.exactActive).toBe(true);
    expect(work?.children).toEqual([]);
  });

  it("keeps contracts root and settings exact-active semantics", () => {
    expect(isSidebarHrefExactActive(parseSidebarHref("/contracts/abc"), parseSidebarHref("/contracts"))).toBe(true);
    const settings = findItem("Settings", model({ pathname: "/settings/security" }));
    expect(settings?.active).toBe(true);
    expect(settings?.exactActive).toBe(false);
  });

  it("chooses query children deterministically", () => {
    const decisions = findItem("Decisions", model({ pathname: "/decisions", search: "type=renewal", surface: surface({ mode: "advanced", role: "admin", featureFlags: allFlags, seesAdvancedPrimaryNav: true }) }));
    expect(decisions?.children.find((child) => child.name === "Renewals")?.active).toBe(true);
    expect(decisions?.children.find((child) => child.name === "Decision queue")?.active).toBe(false);
  });

  it("does not activate a different campaign query child", () => {
    const campaigns = findItem("Campaigns", model({ pathname: "/campaigns", search: "status=active", surface: surface({ mode: "advanced", role: "admin", featureFlags: allFlags, seesAdvancedPrimaryNav: true }) }));
    expect(campaigns?.children.find((child) => child.name === "Active")?.active).toBe(true);
    expect(campaigns?.children.find((child) => child.name === "History")?.active).toBe(false);
  });

  it("keeps same-page Settings anchors out of sidebar children", () => {
    const settings = findItem("Settings", model({ pathname: "/settings", hash: "#team-access" }));
    expect(settings?.active).toBe(true);
    expect(settings?.exactActive).toBe(true);
    expect(settings?.children).toEqual([]);
  });

  it("renders Renewals as a top-level primary nav item active for its route", () => {
    // v11 dashboard spec compliance: Renewals promoted from Work child to
    // top-level primary nav per docs/oblixa-release-state.md §In-App Pages.
    const m = model({ pathname: "/contracts/renewals" });
    expect(findItem("Renewals", m)).toBeDefined();
    expect(findItem("Renewals", m)?.active).toBe(true);
  });

  it("treats collapsed mode as a first-class rail with ordered items and 99+ child badges", () => {
    const m = model({ forcedCollapsed: true, pathname: "/contracts/review", navBadges: { reviewQueue: 101 } });
    expect(m.collapsed).toBe(true);
    expect(m.sections[0]?.variant).toBe("rail");
    expect(m.sections[0]?.items.map((item) => item.name)).toEqual([
      "Dashboard",
      "Contracts",
      "Work",
      "Renewals",
      "Evidence",
      "Reports",
      "Settings",
    ]);
    expect(findItem("Contracts", m)?.badge).toMatchObject({ displayValue: "99+", label: "101 field review items need action" });
  });

  it("preserves review badge semantics and keeps old Work queue badges off Core sidebar", () => {
    const zero = model({ pathname: "/contracts/review", navBadges: { reviewQueue: 0 } });
    expect(findItem("Contracts", zero)?.children.find((child) => child.name === "Review fields")?.badge).toBeUndefined();

    const positive = model({ pathname: "/contracts/approvals", navBadges: { approvals: 4 } });
    expect(findItem("Work", positive)?.children).toEqual([]);

    const large = model({ pathname: "/contracts/obligations", navBadges: { obligations: 104 } });
    expect(findItem("Work", large)?.children).toEqual([]);
  });

  it("does not aggregate hidden old Work lane badges when collapsed in Core", () => {
    const m = model({ forcedCollapsed: true, pathname: "/work", navBadges: { approvals: 4, obligations: 8 } });
    expect(findItem("Work", m)?.badge).toBeUndefined();
  });

  it("keeps Work as a single release-state destination", () => {
    expect(findItem("Work")?.children).toEqual([]);
  });

  it("keeps Reports focused on output destinations", () => {
    // Report packs and analytics anchors are no longer surfaced in Core
    // navigation. Reports remains a single export destination.
    expect(findItem("Reports")?.children.map((child) => child.name)).not.toContain("Report packs");
    expect(findItem("Reports")?.children.map((child) => child.name)).not.toContain("Contract report packs");
    expect(findItem("Reports")?.children).toEqual([]);
  });

  it("does not render one-item My views sections in default Core", () => {
    expect(model().sections.map((section) => section.label)).not.toContain("My views");
  });

  it("uses unique section labels and omits empty sections", () => {
    const labels = model().sections.map((section) => section.ariaLabel);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels).not.toContain("Workspace navigation");
  });

  it("keeps Settings as one sidebar destination; its directory owns subsections", () => {
    const m = model({ surface: surface({ role: "admin" }) });
    expect(m.sections.find((section) => section.variant === "workspace")).toBeUndefined();
    const settings = findItem("Settings", m);
    expect(settings?.children).toEqual([]);
  });

  it("keeps prefetch disabled for heavy destinations and defaulted for light destinations", () => {
    expect(sidebarPrefetch("/contracts")).toBe(false);
    expect(sidebarPrefetch("/reports#portfolio-signals")).toBe(false);
    expect(sidebarPrefetch("/assurance/findings")).toBe(false);
    expect(sidebarPrefetch("/more")).toBe(false);
    expect(sidebarPrefetch("/dashboard")).toBeUndefined();
  });
});
