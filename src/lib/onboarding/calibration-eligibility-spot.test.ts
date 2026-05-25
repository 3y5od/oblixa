import { describe, expect, it } from "vitest";
import { getFeatureFlags } from "@/lib/feature-flags";
import { finalizeRecommendation, recommendationToV6Patch } from "@/lib/onboarding/calibration-map";
import type { CalibrationAnswersRequired } from "@/lib/onboarding/calibration-types";
import { buildProductSurfaceContext } from "@/lib/product-surface/context";
import { evaluateFeatureEligibility } from "@/lib/product-surface/eligibility";
import type { OrgSettingsJson } from "@/lib/assurance/org-settings";

const flags = getFeatureFlags();

const simplestAnswers: CalibrationAnswersRequired = {
  primary_use_case: "track_contracts_dates",
  team_model: "solo",
  workflow_maturity: "manual_spreadsheet",
  main_pain: "find_contracts_dates",
  complexity_preference: "simplest",
  setup_intent: "upload_import",
  assurance_intent: "not_now",
};

describe("calibration apply vs eligibility (spot)", () => {
  it("core-safe recommendation yields no decisions eligibility on Core", () => {
    const rec = finalizeRecommendation(simplestAnswers, flags);
    expect(rec.recommended_workspace_mode).toBe("core");
    const patch = recommendationToV6Patch(rec);
    const ctx = buildProductSurfaceContext({
      orgId: "org-test",
      role: "viewer",
      v6: patch as OrgSettingsJson,
      featureFlags: flags,
    });
    expect(evaluateFeatureEligibility(ctx, "decisions").allowed).toBe(false);
  });
});
