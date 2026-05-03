import { describe, expect, it } from "vitest";
import type {
  AssuranceIntentId,
  CalibrationAnswersRequired,
  ComplexityPreferenceId,
  MainPainId,
  PrimaryUseCaseId,
  SetupIntentId,
  TeamModelId,
  WorkflowMaturityId,
} from "@/lib/onboarding/calibration-types";
import { scoreAdvancedSignals } from "@/lib/onboarding/calibration-map";
import {
  assertAdvancedSignalDecomposition,
  CALIBRATION_SCORING_WEIGHTS,
  complexityEscalationScore,
  computeCalibrationDimensionScores,
  coordinationComplexityScore,
  executionDepthScore,
} from "@/lib/onboarding/calibration-dimensions";

const PRIMARIES: PrimaryUseCaseId[] = [
  "track_contracts_dates",
  "tasks_approvals_obligations",
  "coordinate_renewals_decisions",
  "assurance_control_workflows",
];
const TEAMS: TeamModelId[] = ["solo", "small_2_5", "medium_6_20", "large_cross_functional"];
const WORKFLOWS: WorkflowMaturityId[] = [
  "manual_spreadsheet",
  "somewhat_structured",
  "well_defined_cross_team",
  "highly_structured_policy",
];
const PAINS: MainPainId[] = [
  "find_contracts_dates",
  "tasks_obligations",
  "decisions_handoffs",
  "risk_drift_control",
];
const COMPLEXITY: ComplexityPreferenceId[] = [
  "simplest",
  "more_if_helps",
  "comfortable_advanced",
  "full_visibility",
];
const SETUPS: SetupIntentId[] = [
  "upload_import",
  "review_extracted_fields",
  "organize_work_renewals",
  "configure_workflows_advanced",
];
const ASSURANCE: AssuranceIntentId[] = ["not_now", "maybe_later", "yes_workspace"];

describe("calibration-dimensions (onboarding spec §11.1)", () => {
  it("exported CALIBRATION_SCORING_WEIGHTS is structurally complete for every enum value", () => {
    for (const p of PRIMARIES) expect(CALIBRATION_SCORING_WEIGHTS.primary_use_case[p]).toBeDefined();
    for (const t of TEAMS) expect(CALIBRATION_SCORING_WEIGHTS.team_model[t]).toBeDefined();
    for (const w of WORKFLOWS) expect(CALIBRATION_SCORING_WEIGHTS.workflow_maturity[w]).toBeDefined();
    for (const m of PAINS) expect(CALIBRATION_SCORING_WEIGHTS.main_pain[m]).toBeDefined();
    for (const c of COMPLEXITY) expect(CALIBRATION_SCORING_WEIGHTS.complexity_preference[c]).toBeDefined();
    for (const s of SETUPS) expect(CALIBRATION_SCORING_WEIGHTS.setup_intent[s]).toBeDefined();
  });

  it("decomposes scoreAdvancedSignals for every required-answer combination (12,288 vectors)", () => {
    let count = 0;
    for (const primary_use_case of PRIMARIES) {
      for (const team_model of TEAMS) {
        for (const workflow_maturity of WORKFLOWS) {
          for (const main_pain of PAINS) {
            for (const complexity_preference of COMPLEXITY) {
              for (const setup_intent of SETUPS) {
                for (const assurance_intent of ASSURANCE) {
                  const a: CalibrationAnswersRequired = {
                    primary_use_case,
                    team_model,
                    workflow_maturity,
                    main_pain,
                    complexity_preference,
                    setup_intent,
                    assurance_intent,
                  };
                  expect(assertAdvancedSignalDecomposition(a)).toBe(true);
                  const adv = scoreAdvancedSignals(a);
                  expect(
                    executionDepthScore(a) + coordinationComplexityScore(a) + complexityEscalationScore(a)
                  ).toBe(adv);
                  const d = computeCalibrationDimensionScores(a);
                  expect(d.assurance_maturity).toBeGreaterThanOrEqual(0);
                  expect(d.simplicity_preference).toBeGreaterThanOrEqual(0);
                  count++;
                }
              }
            }
          }
        }
      }
    }
    expect(count).toBe(12288);
  });

  it("same answers yield identical dimension scores", () => {
    const a: CalibrationAnswersRequired = {
      primary_use_case: "coordinate_renewals_decisions",
      team_model: "medium_6_20",
      workflow_maturity: "well_defined_cross_team",
      main_pain: "decisions_handoffs",
      complexity_preference: "more_if_helps",
      setup_intent: "configure_workflows_advanced",
      assurance_intent: "maybe_later",
    };
    expect(computeCalibrationDimensionScores(a)).toEqual(computeCalibrationDimensionScores({ ...a }));
  });
});
