import { describe, expect, it } from "vitest";
import { NEW_WORKSPACE_V6_ORG_SETTINGS_JSON } from "@/lib/supabase/server";
import { getFeatureFlags } from "@/lib/feature-flags";
import { buildProductSurfaceContext } from "@/lib/product-surface/context";
import {
  cmdkFilterRecentHrefsForSurface,
  isHomeBlockAllowed,
} from "@/lib/product-surface/resolver";
import type { NavSurfaceInput } from "@/lib/product-surface/nav-visibility";
import type { CalibrationAnswersRequired } from "@/lib/onboarding/calibration-types";
import {
  finalizeRecommendation,
  recommendationToV6Patch,
} from "@/lib/onboarding/calibration-map";
import type { V6OrgSettingsJson } from "@/lib/v6/org-settings";

const flags = getFeatureFlags();

function baseAnswers(overrides: Partial<CalibrationAnswersRequired> = {}): CalibrationAnswersRequired {
  return {
    primary_use_case: "track_contracts_dates",
    team_model: "solo",
    workflow_maturity: "manual_spreadsheet",
    main_pain: "find_contracts_dates",
    complexity_preference: "simplest",
    setup_intent: "upload_import",
    assurance_intent: "not_now",
    ...overrides,
  };
}

function navSurfaceFromProductContext(
  ctx: ReturnType<typeof buildProductSurfaceContext>
): NavSurfaceInput {
  return {
    mode: ctx.mode,
    role: ctx.role,
    featureFlags: ctx.featureFlags,
    seesAdvancedPrimaryNav: ctx.seesAdvancedPrimaryNav,
    seesAssuranceNav: ctx.seesAssuranceNav,
    advancedModulesHidden: [...ctx.advancedModulesHidden],
    assuranceModulesHidden: [...ctx.assuranceModulesHidden],
    utilityModulesHidden: [...ctx.utilityModulesHidden],
    searchScope: ctx.searchScope,
  };
}

describe("calibration recommendation → V6 patch → surface (search_scope / home / cmd-K)", () => {
  it("core recommendation sets core_only search_scope and hides outcome_intelligence on home", () => {
    const rec = finalizeRecommendation(baseAnswers(), flags);
    const patch = recommendationToV6Patch(rec);
    const v6 = { ...NEW_WORKSPACE_V6_ORG_SETTINGS_JSON, ...patch } as V6OrgSettingsJson;
    expect(rec.recommended_workspace_mode).toBe("core");
    expect(patch.search_scope).toBe("core_only");
    expect(v6.search_scope).toBe("core_only");
    expect(isHomeBlockAllowed("outcome_intelligence", v6)).toBe(false);
    const ctx = buildProductSurfaceContext({
      orgId: "org",
      role: "admin",
      v6,
      featureFlags: flags,
    });
    const nav = navSurfaceFromProductContext(ctx);
    // core_only cmd-K drops paths whose registry min mode is above core (e.g. /decisions).
    expect(cmdkFilterRecentHrefsForSurface(["/contracts/review", "/decisions"], nav)).toEqual([
      "/contracts/review",
    ]);
  });

  it("advanced recommendation uses match_mode and keeps /decisions in cmd-K recent filter", () => {
    const rec = finalizeRecommendation(
      baseAnswers({
        complexity_preference: "full_visibility",
        primary_use_case: "coordinate_renewals_decisions",
        assurance_intent: "not_now",
      }),
      flags
    );
    const patch = recommendationToV6Patch(rec);
    const v6 = { ...NEW_WORKSPACE_V6_ORG_SETTINGS_JSON, ...patch } as V6OrgSettingsJson;
    expect(rec.recommended_workspace_mode).toBe("advanced");
    expect(patch.search_scope).toBe("match_mode");
    const ctx = buildProductSurfaceContext({
      orgId: "org",
      role: "admin",
      v6,
      featureFlags: flags,
    });
    const nav = navSurfaceFromProductContext(ctx);
    expect(cmdkFilterRecentHrefsForSurface(["/dashboard", "/decisions"], nav)).toEqual([
      "/dashboard",
      "/decisions",
    ]);
    expect(isHomeBlockAllowed("control_room_strip", v6)).toBe(true);
  });

  it("§18.1 — core_only search_scope filters cmd-K recent hrefs more aggressively than match_mode for the same list", () => {
    const recCore = finalizeRecommendation(baseAnswers(), flags);
    const patchCore = recommendationToV6Patch(recCore);
    const v6Core = { ...NEW_WORKSPACE_V6_ORG_SETTINGS_JSON, ...patchCore } as V6OrgSettingsJson;

    const recAdv = finalizeRecommendation(
      baseAnswers({
        complexity_preference: "full_visibility",
        primary_use_case: "coordinate_renewals_decisions",
        assurance_intent: "not_now",
      }),
      flags
    );
    const patchAdv = recommendationToV6Patch(recAdv);
    const v6Adv = { ...NEW_WORKSPACE_V6_ORG_SETTINGS_JSON, ...patchAdv } as V6OrgSettingsJson;

    const hrefs = ["/contracts/review", "/decisions", "/campaigns"];

    const navCore = navSurfaceFromProductContext(
      buildProductSurfaceContext({
        orgId: "org",
        role: "admin",
        v6: v6Core,
        featureFlags: flags,
      })
    );
    const navMatch = navSurfaceFromProductContext(
      buildProductSurfaceContext({
        orgId: "org",
        role: "admin",
        v6: { ...v6Adv, search_scope: "match_mode" },
        featureFlags: flags,
      })
    );

    const filteredCore = cmdkFilterRecentHrefsForSurface(hrefs, navCore);
    const filteredMatch = cmdkFilterRecentHrefsForSurface(hrefs, navMatch);
    expect(filteredCore.length).toBeLessThan(filteredMatch.length);
    expect(filteredCore).toEqual(["/contracts/review"]);
    expect(filteredMatch).toContain("/decisions");
  });
});
