import { describe, expect, it } from "vitest";
import type { CalibrationAnswersRequired } from "@/lib/onboarding/calibration-types";
import {
  clampCalibrationWizardStep,
  parseCalibrationStepQuery,
} from "@/lib/onboarding/calibration-wizard-step";

describe("calibration-wizard-step", () => {
  it("parseCalibrationStepQuery handles invalid input", () => {
    expect(parseCalibrationStepQuery(undefined)).toBe(0);
    expect(parseCalibrationStepQuery("")).toBe(0);
    expect(parseCalibrationStepQuery("abc")).toBe(0);
    expect(parseCalibrationStepQuery("3")).toBe(3);
    expect(parseCalibrationStepQuery("3.7")).toBe(3);
    expect(parseCalibrationStepQuery("-2")).toBe(-2);
    expect(parseCalibrationStepQuery("  4  ")).toBe(4);
    expect(parseCalibrationStepQuery("0")).toBe(0);
    expect(parseCalibrationStepQuery("NaN")).toBe(0);
  });

  it("clampCalibrationWizardStep bounds NaN and huge requested indices", () => {
    const full: Partial<CalibrationAnswersRequired> = {
      primary_use_case: "track_contracts_dates",
      team_model: "solo",
      workflow_maturity: "manual_spreadsheet",
      main_pain: "find_contracts_dates",
      complexity_preference: "simplest",
      setup_intent: "upload_import",
      assurance_intent: "not_now",
    };
    expect(clampCalibrationWizardStep(Number.NaN, full)).toBe(0);
    expect(clampCalibrationWizardStep(Number.POSITIVE_INFINITY, full)).toBe(0);
    expect(clampCalibrationWizardStep(-3, full)).toBe(0);
    expect(clampCalibrationWizardStep(99, full)).toBe(8);
  });

  it("clamps to first incomplete required step", () => {
    const partial: Partial<CalibrationAnswersRequired> = {
      primary_use_case: "track_contracts_dates",
      team_model: "solo",
    };
    expect(clampCalibrationWizardStep(8, partial)).toBe(2);
  });

  it("requested step beyond first missing required field is clamped to that index", () => {
    const partial: Partial<CalibrationAnswersRequired> = {
      primary_use_case: "track_contracts_dates",
      team_model: "solo",
    };
    expect(clampCalibrationWizardStep(5, partial)).toBe(2);
    expect(parseCalibrationStepQuery("5")).toBe(5);
  });

  it("allows review when all required answers present", () => {
    const full: Partial<CalibrationAnswersRequired> = {
      primary_use_case: "track_contracts_dates",
      team_model: "solo",
      workflow_maturity: "manual_spreadsheet",
      main_pain: "find_contracts_dates",
      complexity_preference: "simplest",
      setup_intent: "upload_import",
      assurance_intent: "not_now",
    };
    expect(clampCalibrationWizardStep(8, full)).toBe(8);
  });
});
