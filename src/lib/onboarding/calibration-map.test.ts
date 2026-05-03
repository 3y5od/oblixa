import { describe, expect, it } from "vitest";
import { getFeatureFlags, type FeatureFlagKey } from "@/lib/feature-flags";
import type { CalibrationAnswersRequired } from "@/lib/onboarding/calibration-types";
import type { CalibrationRecommendation } from "@/lib/onboarding/calibration-types";
import {
  clampAdvancedFamiliesToFeatureFlags,
  computeRecommendation,
  finalizeRecommendation,
  resolveWorkspaceMode,
  recommendationToV6Patch,
  coreFallbackV6Patch,
} from "@/lib/onboarding/calibration-map";

const flags = getFeatureFlags();

function baseAnswers(
  overrides: Partial<CalibrationAnswersRequired> = {}
): CalibrationAnswersRequired {
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

describe("calibration-map", () => {
  it("resolveWorkspaceMode is deterministic for the same answers", () => {
    const a = baseAnswers({ complexity_preference: "full_visibility" });
    expect(resolveWorkspaceMode(a)).toBe(resolveWorkspaceMode({ ...a }));
  });

  it("caps at core when complexity is simplest for typical signals", () => {
    const a = baseAnswers({
      complexity_preference: "simplest",
      primary_use_case: "coordinate_renewals_decisions",
    });
    expect(resolveWorkspaceMode(a)).toBe("core");
  });

  it("finalizeRecommendation never enables autopilot execution in the patch", () => {
    const rec = finalizeRecommendation(
      baseAnswers({
        complexity_preference: "full_visibility",
        assurance_intent: "yes_workspace",
        primary_use_case: "assurance_control_workflows",
        workflow_maturity: "highly_structured_policy",
        main_pain: "risk_drift_control",
      }),
      flags
    );
    const patch = recommendationToV6Patch(rec);
    expect(patch.autopilot_allow_execution).toBe(false);
  });

  it("coreFallbackV6Patch matches core-safe shape", () => {
    const p = coreFallbackV6Patch();
    expect(p.workspace_mode).toBe("core");
    expect(p.search_scope).toBe("core_only");
    expect(p.autopilot_allow_execution).toBe(false);
    expect(p.advanced_modules_hidden?.length).toBeGreaterThan(0);
    expect(p.utility_modules_hidden).toContain("execution_graph");
  });

  const ALLOWED_V6_PATCH_KEYS = new Set([
    "workspace_mode",
    "advanced_modules_hidden",
    "assurance_modules_hidden",
    "utility_modules_hidden",
    "home_hidden_sections",
    "search_scope",
    "default_landing_path",
    "autopilot_allow_execution",
  ]);

  it("recommendationToV6Patch and coreFallbackV6Patch only set allowed V6 keys (onboarding spec §24.1)", () => {
    const rec = finalizeRecommendation(
      baseAnswers({ complexity_preference: "full_visibility", assurance_intent: "yes_workspace" }),
      flags
    );
    for (const k of Object.keys(recommendationToV6Patch(rec))) {
      expect(ALLOWED_V6_PATCH_KEYS.has(k)).toBe(true);
    }
    for (const k of Object.keys(coreFallbackV6Patch())) {
      expect(ALLOWED_V6_PATCH_KEYS.has(k)).toBe(true);
    }
  });

  it("optional industry_emphasis does not change mode or surface patch (onboarding spec §10.1)", () => {
    const a = baseAnswers({ complexity_preference: "more_if_helps" });
    const r1 = finalizeRecommendation(a, flags, { industry_emphasis: "saas" });
    const r2 = finalizeRecommendation(a, flags, { industry_emphasis: "regulated" });
    expect(r1.recommended_workspace_mode).toBe(r2.recommended_workspace_mode);
    expect(r1.recommended_advanced_families_enabled).toEqual(r2.recommended_advanced_families_enabled);
    expect(r1.recommended_assurance_families_enabled).toEqual(r2.recommended_assurance_families_enabled);
    expect(recommendationToV6Patch(r1).workspace_mode).toBe(recommendationToV6Patch(r2).workspace_mode);
    expect(r2.recommended_setup_checklist[0]).toBe("compliance_alignment");
    expect(r1.recommended_setup_checklist.includes("compliance_alignment")).toBe(false);
  });

  it("recommendationToV6Patch forces /dashboard when landing is invalid for the target mode", () => {
    const rec = finalizeRecommendation(baseAnswers(), flags);
    const manipulated: CalibrationRecommendation = {
      ...rec,
      recommended_workspace_mode: "core",
      recommended_default_landing_path: "/decisions",
    };
    expect(recommendationToV6Patch(manipulated).default_landing_path).toBe("/dashboard");
  });

  it("finalizeRecommendation includes report profile aligned with core mode", () => {
    const coreRec = finalizeRecommendation(baseAnswers(), flags);
    expect(coreRec.recommended_report_profile.aligns_with_workspace_transition).toBe(true);
    expect(coreRec.recommended_report_profile.suppress_incompatible_subscriptions).toBe(true);
    const advRec = finalizeRecommendation(
      baseAnswers({
        complexity_preference: "full_visibility",
        primary_use_case: "coordinate_renewals_decisions",
      }),
      flags
    );
    if (advRec.recommended_workspace_mode !== "core") {
      expect(advRec.recommended_report_profile.suppress_incompatible_subscriptions).toBe(false);
    }
  });

  it("same answers yield identical recommendation snapshot", () => {
    const a = baseAnswers({ team_model: "large_cross_functional" });
    const r1 = finalizeRecommendation(a, flags);
    const r2 = finalizeRecommendation(a, flags);
    expect(r1).toEqual(r2);
  });

  it("computeRecommendation matches finalizeRecommendation", () => {
    const a = baseAnswers();
    expect(computeRecommendation(a, flags)).toEqual(finalizeRecommendation(a, flags));
  });

  it("clampAdvancedFamiliesToFeatureFlags removes decisions when v5DecisionFoundation is off", () => {
    const flagsOff = { ...flags, v5DecisionFoundation: false };
    expect(
      clampAdvancedFamiliesToFeatureFlags(["decisions", "analytics"], flagsOff).includes("decisions")
    ).toBe(false);
    expect(clampAdvancedFamiliesToFeatureFlags(["decisions", "analytics"], flagsOff)).toContain("analytics");
  });

  it("finalizeRecommendation clamps assurance to core when all v5/v6 feature flags are off (§19.3)", () => {
    const allFalse = Object.fromEntries(
      Object.keys(getFeatureFlags()).map((k) => [k, false])
    ) as Record<FeatureFlagKey, boolean>;
    const assuranceAnswers = baseAnswers({
      complexity_preference: "full_visibility",
      assurance_intent: "yes_workspace",
      primary_use_case: "assurance_control_workflows",
      workflow_maturity: "highly_structured_policy",
      main_pain: "risk_drift_control",
    });
    expect(resolveWorkspaceMode(assuranceAnswers)).toBe("assurance");
    const rec = finalizeRecommendation(assuranceAnswers, allFalse);
    expect(rec.recommended_workspace_mode).toBe("core");
  });
});
