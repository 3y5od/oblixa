/**
 * onboarding spec §11.1 / §24.8 — explicit four-dimension scores + auditable weight table.
 *
 * `scoreAdvancedSignals` (calibration-map) decomposes exactly as:
 *   execution_depth + coordination_complexity + complexity_escalation
 * where `complexity_escalation` is only the §9.5 contribution embedded in the advanced score.
 *
 * `simplicity_preference` is a separate axis (higher = user wants a simpler surface); it does not
 * add into `scoreAdvancedSignals` (those lines are modeled as willingness to see more UI depth).
 */
import type { CalibrationAnswersRequired } from "@/lib/onboarding/calibration-types";
import { scoreAdvancedSignals, scoreAssuranceSignals } from "@/lib/onboarding/calibration-map";

/** Per-field deltas for audit (§11.3 determinism). Mirrors calibration-map increments. */
export const CALIBRATION_SCORING_WEIGHTS = {
  primary_use_case: {
    track_contracts_dates: { execution: 0, coordination: 0 },
    tasks_approvals_obligations: { execution: 1, coordination: 0 },
    coordinate_renewals_decisions: { execution: 0, coordination: 3 },
    assurance_control_workflows: { execution: 2, coordination: 0 },
  },
  team_model: {
    solo: { execution: 0, coordination: 0 },
    small_2_5: { execution: 0, coordination: 0 },
    medium_6_20: { execution: 0, coordination: 1 },
    large_cross_functional: { execution: 0, coordination: 2 },
  },
  workflow_maturity: {
    manual_spreadsheet: { execution: 0, coordination: 0 },
    somewhat_structured: { execution: 1, coordination: 0 },
    well_defined_cross_team: { execution: 2, coordination: 0 },
    highly_structured_policy: { execution: 2, coordination: 0 },
  },
  main_pain: {
    find_contracts_dates: { execution: 0, coordination: 0 },
    tasks_obligations: { execution: 0, coordination: 0 },
    decisions_handoffs: { execution: 0, coordination: 2 },
    risk_drift_control: { execution: 1, coordination: 0 },
  },
  complexity_preference: {
    simplest: { escalation: 0, simplicity: 6 },
    more_if_helps: { escalation: 1, simplicity: 4 },
    comfortable_advanced: { escalation: 2, simplicity: 2 },
    full_visibility: { escalation: 3, simplicity: 0 },
  },
  setup_intent: {
    upload_import: { execution: 0, coordination: 0 },
    review_extracted_fields: { execution: 0, coordination: 0 },
    organize_work_renewals: { execution: 0, coordination: 0 },
    configure_workflows_advanced: { execution: 2, coordination: 0 },
  },
} as const;

export type CalibrationDimensionScores = {
  /** Operational / workflow depth signals (excludes coordination-only and complexity-escalation slices). */
  execution_depth: number;
  /** Team scale + handoff / renewal coordination signals. */
  coordination_complexity: number;
  /** Same numeric total as `scoreAssuranceSignals`. */
  assurance_maturity: number;
  /** Higher = stronger preference for a simpler initial surface (invert §9.5). */
  simplicity_preference: number;
};

export function complexityEscalationScore(a: CalibrationAnswersRequired): number {
  const row = CALIBRATION_SCORING_WEIGHTS.complexity_preference[a.complexity_preference];
  return row.escalation;
}

export function coordinationComplexityScore(a: CalibrationAnswersRequired): number {
  let s = 0;
  s += CALIBRATION_SCORING_WEIGHTS.primary_use_case[a.primary_use_case].coordination;
  s += CALIBRATION_SCORING_WEIGHTS.team_model[a.team_model].coordination;
  s += CALIBRATION_SCORING_WEIGHTS.main_pain[a.main_pain].coordination;
  return s;
}

export function executionDepthScore(a: CalibrationAnswersRequired): number {
  let s = 0;
  s += CALIBRATION_SCORING_WEIGHTS.primary_use_case[a.primary_use_case].execution;
  s += CALIBRATION_SCORING_WEIGHTS.workflow_maturity[a.workflow_maturity].execution;
  s += CALIBRATION_SCORING_WEIGHTS.main_pain[a.main_pain].execution;
  s += CALIBRATION_SCORING_WEIGHTS.setup_intent[a.setup_intent].execution;
  return s;
}

export function simplicityPreferenceScore(a: CalibrationAnswersRequired): number {
  return CALIBRATION_SCORING_WEIGHTS.complexity_preference[a.complexity_preference].simplicity;
}

export function computeCalibrationDimensionScores(a: CalibrationAnswersRequired): CalibrationDimensionScores {
  return {
    execution_depth: executionDepthScore(a),
    coordination_complexity: coordinationComplexityScore(a),
    assurance_maturity: scoreAssuranceSignals(a),
    simplicity_preference: simplicityPreferenceScore(a),
  };
}

/** §11 decomposition check: execution + coordination + complexity_escalation === scoreAdvancedSignals. */
export function assertAdvancedSignalDecomposition(a: CalibrationAnswersRequired): boolean {
  const adv = scoreAdvancedSignals(a);
  const sum =
    executionDepthScore(a) + coordinationComplexityScore(a) + complexityEscalationScore(a);
  return adv === sum;
}
