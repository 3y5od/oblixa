/**
 * docs/onboarding.md §24.17 — server-safe step index parsing/clamping (no client boundary).
 */
import type { CalibrationAnswersRequired } from "@/lib/onboarding/calibration-types";

export const CALIBRATION_REQUIRED_FIELD_ORDER: (keyof CalibrationAnswersRequired)[] = [
  "primary_use_case",
  "team_model",
  "workflow_maturity",
  "main_pain",
  "complexity_preference",
  "setup_intent",
  "assurance_intent",
];

/** Seven required + optional + review (0…8). */
export const CALIBRATION_LAST_STEP_INDEX = 8;

/**
 * Clamp URL `step` to a reachable index given persisted partial answers (resume without skipping required screens).
 */
export function clampCalibrationWizardStep(
  requested: number,
  initialRequired: Partial<CalibrationAnswersRequired>
): number {
  let s = Math.floor(requested);
  if (!Number.isFinite(s) || Number.isNaN(s)) s = 0;
  s = Math.max(0, Math.min(s, CALIBRATION_LAST_STEP_INDEX));

  let firstMissing = CALIBRATION_REQUIRED_FIELD_ORDER.length;
  for (let i = 0; i < CALIBRATION_REQUIRED_FIELD_ORDER.length; i++) {
    const k = CALIBRATION_REQUIRED_FIELD_ORDER[i];
    if (initialRequired[k] == null) {
      firstMissing = i;
      break;
    }
  }

  const maxStep =
    firstMissing === CALIBRATION_REQUIRED_FIELD_ORDER.length
      ? CALIBRATION_LAST_STEP_INDEX
      : firstMissing;

  return Math.min(s, maxStep);
}

export function parseCalibrationStepQuery(raw: string | undefined): number {
  if (raw == null || raw === "") return 0;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return 0;
  return n;
}
