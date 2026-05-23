import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NAV_ITEMS } from "@/lib/navigation";
import { isNavItemVisibleForSurface, type NavSurfaceInput } from "@/lib/product-surface/nav-visibility";
import { HOME_SECTION_IDS } from "@/lib/product-surface/resolver";

const ROUTE_GUARD_FILE = join(process.cwd(), "src/lib/product-surface/route-guard.ts");
const TRANSITIONS_ACTION_FILE = join(process.cwd(), "src/actions/product-surface-settings.ts");
const TRANSITIONS_ACTION_HELPER_FILE = join(process.cwd(), "src/actions/product-surface-settings-helpers.ts");
const WORKSPACE_TRANSITION_FILE = join(process.cwd(), "src/lib/product-surface/workspace-transition.ts");
const HREF_AUDIT_SCRIPT = join(process.cwd(), "scripts/audit-v7-cross-surface-hrefs.mjs");
const CMDK_BRIDGE_FILE = join(process.cwd(), "src/lib/product-surface/command-palette-bridge.ts");

const CORE_ADMIN_SURFACE: NavSurfaceInput = {
  mode: "core",
  role: "admin",
  featureFlags: {} as NavSurfaceInput["featureFlags"],
  seesAdvancedPrimaryNav: false,
  seesAssuranceNav: false,
  advancedModulesHidden: [],
  assuranceModulesHidden: [],
  utilityModulesHidden: [],
  searchScope: "match_mode",
};

describe("v7 acceptance matrix", () => {
  it("keeps core primary nav free of advanced and assurance top-level entries", () => {
    const visiblePrimary = NAV_ITEMS.filter(
      (item) => item.section === "primary" && isNavItemVisibleForSurface(item, CORE_ADMIN_SURFACE)
    ).map((item) => item.name);

    // v11 dashboard spec compliance: Renewals + Evidence are now top-level
    // primary nav per docs/oblixa-release-state.md §In-App Pages.
    expect(visiblePrimary).toEqual(
      expect.arrayContaining([
        "Dashboard",
        "Contracts",
        "Work",
        "Renewals",
        "Evidence",
        "Reports",
        "Settings",
      ])
    );
    expect(visiblePrimary).not.toContain("Decisions");
    expect(visiblePrimary).not.toContain("Campaigns");
    expect(visiblePrimary).not.toContain("Assurance");
    expect(visiblePrimary).not.toContain("Report packs");
  });

  it("keeps restored Core workflows reachable as top-level primary nav", () => {
    // v11 dashboard spec compliance: Evidence + Renewals are top-level
    // primary nav per spec §In-App Pages. Reports remains top-level.
    // Tier 5.6: Report packs child link removed from nav (route still
    // exists at /contracts/reports but is no longer surfaced).
    expect(NAV_ITEMS.find((i) => i.href === "/contracts/evidence-studio")).toBeTruthy();
    expect(NAV_ITEMS.find((i) => i.href === "/contracts/renewals")).toBeTruthy();
    expect(NAV_ITEMS.find((i) => i.href === "/reports")).toBeTruthy();
  });

  it("keeps deep-link mismatch guard policy wired for 404 path handling", () => {
    const raw = readFileSync(ROUTE_GUARD_FILE, "utf8");
    expect(raw.includes("notFound()")).toBe(true);
    expect(raw.includes("assertWorkspaceModeAtLeast")).toBe(true);
  });

  it("keeps mode-transition side effects wired to suppress stale delivery surfaces", () => {
    const settingsRaw = readFileSync(TRANSITIONS_ACTION_FILE, "utf8");
    const transitionRaw = readFileSync(WORKSPACE_TRANSITION_FILE, "utf8");
    expect(settingsRaw.includes("applyWorkspaceProductTransitionSideEffects")).toBe(true);
    expect(transitionRaw.includes("suppressNotificationTypesForModeDowngrade")).toBe(true);
    expect(transitionRaw.includes("workspace.report_pack_subscriptions_suppressed")).toBe(true);
  });

  it("keeps V7 href audit script and cmd-K bridge entrypoints present", () => {
    const hrefAudit = readFileSync(HREF_AUDIT_SCRIPT, "utf8");
    expect(hrefAudit.includes("src/app/(dashboard)")).toBe(true);
    expect(hrefAudit.includes("NATIVE_TREE_REL_PREFIXES")).toBe(true);
    expect(readFileSync(CMDK_BRIDGE_FILE, "utf8").includes("COMMAND_PALETTE_OPEN_EVENT")).toBe(true);
  });

  it("keeps settings home hide keys aligned with resolver HOME_SECTION_IDS", () => {
    const raw = `${readFileSync(TRANSITIONS_ACTION_FILE, "utf8")}\n${readFileSync(TRANSITIONS_ACTION_HELPER_FILE, "utf8")}`;
    for (const id of HOME_SECTION_IDS) {
      expect(raw.includes(id), id).toBe(true);
    }
  });
});
