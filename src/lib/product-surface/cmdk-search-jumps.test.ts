import { describe, expect, it } from "vitest";
import type { FeatureFlagKey } from "@/lib/feature-flags";
import type { NavSurfaceInput } from "@/lib/product-surface/nav-visibility";
import { SEARCH_INDEX_CLASSES, workspaceModeAtLeast } from "@/lib/product-surface/feature-registry";
import { getCmdkSearchJumpItems } from "@/lib/product-surface/cmdk-search-jumps";

const noFlags = {} as Record<FeatureFlagKey, boolean>;

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

  it("omits decisions for core mode", () => {
    const items = getCmdkSearchJumpItems(surface({ mode: "core" }), "");
    expect(items.some((i) => i.href.startsWith("/decisions"))).toBe(false);
  });

  it("includes decisions when advanced and module not hidden", () => {
    const items = getCmdkSearchJumpItems(
      surface({ mode: "advanced", seesAdvancedPrimaryNav: true }),
      ""
    );
    expect(items.some((i) => i.href === "/decisions")).toBe(true);
  });

  it("omits decisions when advanced module hidden", () => {
    const items = getCmdkSearchJumpItems(
      surface({
        mode: "advanced",
        seesAdvancedPrimaryNav: true,
        advancedModulesHidden: ["decisions"],
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
      }),
      ""
    );
    expect(items.some((i) => i.href === "/assurance/findings")).toBe(false);
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
      }),
      ""
    );
    const actual = new Set(items.map((i) => i.id.replace(/^search-jump:/, "")));
    expect(actual).toEqual(expected);
  });
});
