import { describe, expect, it } from "vitest";
import { getFeatureFlags, type FeatureFlagKey } from "@/lib/feature-flags";
import type { CalibrationAnswersRequired } from "@/lib/onboarding/calibration-types";
import {
  clampModeToFeatureFlags,
  finalizeRecommendation,
  recommendationToV6Patch,
  resolveWorkspaceMode,
} from "@/lib/onboarding/calibration-map";

const flags = getFeatureFlags();

function base(overrides: Partial<CalibrationAnswersRequired> = {}): CalibrationAnswersRequired {
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

function modeRank(m: "core" | "advanced" | "assurance"): number {
  if (m === "core") return 0;
  if (m === "advanced") return 1;
  return 2;
}

const primaryCases: CalibrationAnswersRequired["primary_use_case"][] = [
  "track_contracts_dates",
  "tasks_approvals_obligations",
  "coordinate_renewals_decisions",
  "assurance_control_workflows",
];
const complexityCases: CalibrationAnswersRequired["complexity_preference"][] = [
  "simplest",
  "more_if_helps",
  "comfortable_advanced",
  "full_visibility",
];
const assuranceCases: CalibrationAnswersRequired["assurance_intent"][] = ["not_now", "maybe_later", "yes_workspace"];

describe("calibration-map property checks", () => {
  it("same answers → identical finalizeRecommendation", () => {
    const a = base({ complexity_preference: "more_if_helps", primary_use_case: "coordinate_renewals_decisions" });
    expect(finalizeRecommendation(a, flags)).toEqual(finalizeRecommendation({ ...a }, flags));
  });

  it("recommendationToV6Patch never enables autopilot on a sampled grid", () => {
    for (const primary_use_case of primaryCases) {
      for (const complexity_preference of complexityCases) {
        for (const assurance_intent of assuranceCases) {
          const a = base({ primary_use_case, complexity_preference, assurance_intent });
          const rec = finalizeRecommendation(a, flags);
          expect(recommendationToV6Patch(rec).autopilot_allow_execution).toBe(false);
        }
      }
    }
  });

  it("clampModeToFeatureFlags: turning a flag off never increases mode rank vs all-true baseline", () => {
    const allTrue = Object.fromEntries(
      Object.keys(getFeatureFlags()).map((k) => [k, true])
    ) as Record<FeatureFlagKey, boolean>;

    const candidates: CalibrationAnswersRequired[] = [
      base(),
      base({ complexity_preference: "full_visibility", primary_use_case: "assurance_control_workflows" }),
      base({ complexity_preference: "more_if_helps", primary_use_case: "coordinate_renewals_decisions" }),
    ];

    for (const key of Object.keys(allTrue) as FeatureFlagKey[]) {
      const offOne = { ...allTrue, [key]: false };
      for (const a of candidates) {
        const raw = resolveWorkspaceMode(a);
        const clampedAll = clampModeToFeatureFlags(raw, allTrue);
        const clampedOff = clampModeToFeatureFlags(raw, offOne);
        expect(modeRank(clampedOff)).toBeLessThanOrEqual(modeRank(clampedAll));
      }
    }
  });
});
