import { describe, expect, it } from "vitest";
import type { FeatureFlagKey } from "@/lib/feature-flags";
import type { NavSurfaceInput } from "@/lib/product-surface/nav-visibility";
import { SEARCH_INDEX_CLASSES, workspaceModeAtLeast } from "@/lib/product-surface/feature-registry";
import { getCmdkSearchJumpItems } from "@/lib/product-surface/cmdk-search-jumps";

const noFlags = {} as Record<FeatureFlagKey, boolean>;
const allFlagsOn = {
  v5DecisionFoundation: true,
  v5PortfolioCampaigns: true,
  v5RelationshipLayer: true,
  v6AssuranceCore: true,
  v6ControlPolicies: true,
  v6AdaptivePlaybooks: true,
  v6ReviewBoards: true,
  v6Segments: true,
} as Record<FeatureFlagKey, boolean>;

function surface(over: Partial<NavSurfaceInput>): NavSurfaceInput {
  return {
    mode: "core",
    role: "viewer",
    featureFlags: noFlags,
    seesAdvancedPrimaryNav: false,
    seesAssuranceNav: false,
    advancedModulesHidden: [],
    assuranceModulesHidden: [],
    utilityModulesHidden: [],
    searchScope: "match_mode",
    ...over,
  };
}

describe("getCmdkSearchJumpItems", () => {
  it("includes contracts for core viewer", () => {
    const items = getCmdkSearchJumpItems(surface({}), "");
    expect(items.some((i) => i.href.startsWith("/contracts"))).toBe(true);
  });

  it("keeps contracts search jump copy aligned with the sanitized destination query", () => {
    const item = getCmdkSearchJumpItems(surface({}), '  Acme%_"Legal"  ').find(
      (row) => row.id === "search-jump:contracts"
    );
    expect(item?.href).toBe("/contracts?search=AcmeLegal");
    expect(item?.name).toBe("Search contracts: AcmeLegal");
    expect(item?.description).toContain('"AcmeLegal"');
    expect(item?.meta).toContain("/contracts");
  });

  it("exposes disambiguating name + description on every Core jump (§16.2)", () => {
    const items = getCmdkSearchJumpItems(surface({}), "");
    expect(items.length).toBeGreaterThan(4);
    for (const row of items) {
      expect(row.name.trim().length, row.id).toBeGreaterThan(0);
      expect(row.description.trim().length, row.id).toBeGreaterThan(0);
      expect(row.meta.trim().length, row.id).toBeGreaterThan(0);
      expect(row.href.startsWith("/"), row.id).toBe(true);
    }
  });

  it("routes core queue jumps to the exact actionable destinations", () => {
    const items = getCmdkSearchJumpItems(surface({}), "");
    expect(items.find((i) => i.id === "search-jump:tasks")?.href).toBe("/work?type=contract_task");
    expect(items.find((i) => i.id === "search-jump:tasks")?.meta).toBe("Work · task filter");
    expect(items.find((i) => i.id === "search-jump:approvals")?.href).toBe("/work?tab=approvals");
    expect(items.find((i) => i.id === "search-jump:obligations")?.href).toBe("/work?tab=obligations");
    expect(items.find((i) => i.id === "search-jump:exceptions")?.href).toBe(
      "/contracts/exceptions?status=open"
    );
    expect(items.find((i) => i.id === "search-jump:evidence")?.href).toBe(
      "/contracts/evidence-studio#live-request-queue"
    );
    expect(items.find((i) => i.id === "search-jump:renewals")?.href).toBe(
      "/contracts/renewals?window=90"
    );
  });

  it("omits decisions for core mode", () => {
    const items = getCmdkSearchJumpItems(surface({ mode: "core" }), "");
    expect(items.some((i) => i.href.startsWith("/decisions"))).toBe(false);
  });

  it("includes decisions when advanced and module not hidden", () => {
    const items = getCmdkSearchJumpItems(
      surface({
        mode: "advanced",
        seesAdvancedPrimaryNav: true,
        featureFlags: allFlagsOn,
      }),
      ""
    );
    expect(items.some((i) => i.href === "/decisions")).toBe(true);
  });

  it("omits decisions when advanced mode role cannot see advanced primary nav", () => {
    const items = getCmdkSearchJumpItems(
      surface({ mode: "advanced", seesAdvancedPrimaryNav: false }),
      ""
    );
    expect(items.some((i) => i.href === "/decisions")).toBe(false);
  });

  it("omits decisions when advanced module hidden", () => {
    const items = getCmdkSearchJumpItems(
      surface({
        mode: "advanced",
        seesAdvancedPrimaryNav: true,
        advancedModulesHidden: ["decisions"],
        featureFlags: allFlagsOn,
      }),
      ""
    );
    expect(items.some((i) => i.href === "/decisions")).toBe(false);
  });

  it("omits non-core search jumps when search scope is core_only", () => {
    const items = getCmdkSearchJumpItems(
      surface({
        mode: "assurance",
        seesAdvancedPrimaryNav: true,
        seesAssuranceNav: true,
        searchScope: "core_only",
      }),
      ""
    );
    expect(items.some((i) => i.href.startsWith("/decisions"))).toBe(false);
    expect(items.some((i) => i.href.startsWith("/assurance"))).toBe(false);
  });

  it("omits campaigns when campaigns module is hidden", () => {
    const items = getCmdkSearchJumpItems(
      surface({
        mode: "advanced",
        seesAdvancedPrimaryNav: true,
        advancedModulesHidden: ["campaigns"],
        featureFlags: allFlagsOn,
      }),
      ""
    );
    expect(items.some((i) => i.href === "/campaigns")).toBe(false);
  });

  it("omits assurance findings when findings module is hidden", () => {
    const items = getCmdkSearchJumpItems(
      surface({
        mode: "assurance",
        seesAdvancedPrimaryNav: true,
        seesAssuranceNav: true,
        assuranceModulesHidden: ["findings"],
        featureFlags: allFlagsOn,
      }),
      ""
    );
    expect(items.some((i) => i.href === "/assurance/findings")).toBe(false);
  });

  it("omits assurance search jumps when assurance nav is not visible", () => {
    const items = getCmdkSearchJumpItems(
      surface({
        mode: "assurance",
        seesAdvancedPrimaryNav: true,
        seesAssuranceNav: false,
      }),
      ""
    );
    expect(items.some((i) => i.href.startsWith("/assurance/"))).toBe(false);
  });

  it("Core mode exposes exactly the globalSearch index classes at core floor (V7 §11.2)", () => {
    const expected = new Set(
      SEARCH_INDEX_CLASSES.filter((r) => r.globalSearch && r.minWorkspaceMode === "core").map((r) => r.key)
    );
    const items = getCmdkSearchJumpItems(surface({ mode: "core" }), "");
    const actual = new Set(items.map((i) => i.id.replace(/^search-jump:/, "")));
    expect(actual).toEqual(expected);
  });

  it("Advanced mode admin exposes every globalSearch row whose min mode is satisfied by advanced (§11.3)", () => {
    const expected = new Set(
      SEARCH_INDEX_CLASSES.filter(
        (r) => r.globalSearch && workspaceModeAtLeast("advanced", r.minWorkspaceMode)
      ).map((r) => r.key)
    );
    const items = getCmdkSearchJumpItems(
      surface({
        mode: "advanced",
        role: "admin",
        seesAdvancedPrimaryNav: true,
        seesAssuranceNav: true,
        featureFlags: allFlagsOn,
      }),
      ""
    );
    const actual = new Set(items.map((i) => i.id.replace(/^search-jump:/, "")));
    expect(actual).toEqual(expected);
  });

  it("Assurance mode admin exposes all globalSearch registry rows (§11.4)", () => {
    const expected = new Set(SEARCH_INDEX_CLASSES.filter((r) => r.globalSearch).map((r) => r.key));
    const items = getCmdkSearchJumpItems(
      surface({
        mode: "assurance",
        role: "admin",
        seesAdvancedPrimaryNav: true,
        seesAssuranceNav: true,
        featureFlags: allFlagsOn,
      }),
      ""
    );
    const actual = new Set(items.map((i) => i.id.replace(/^search-jump:/, "")));
    expect(actual).toEqual(expected);
  });
});
