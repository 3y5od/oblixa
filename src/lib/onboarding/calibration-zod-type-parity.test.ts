import { describe, expect, it } from "vitest";
import { calibrationAnswersOptionalSchema, calibrationAnswersRequiredSchema } from "@/lib/onboarding/calibration-zod";
import type { CalibrationAnswersOptional, CalibrationAnswersRequired } from "@/lib/onboarding/calibration-types";

type RequiredKeys = keyof CalibrationAnswersRequired;
type OptionalKeys = keyof Required<CalibrationAnswersOptional>;

describe("calibration zod vs calibration-types key parity", () => {
  it("required schema keys match CalibrationAnswersRequired", () => {
    const shapeKeys = Object.keys(calibrationAnswersRequiredSchema.shape) as RequiredKeys[];
    const typeKeys = [
      "primary_use_case",
      "team_model",
      "workflow_maturity",
      "main_pain",
      "complexity_preference",
      "setup_intent",
      "assurance_intent",
    ] as const satisfies readonly RequiredKeys[];
    expect(shapeKeys.sort()).toEqual([...typeKeys].sort());
  });

  it("optional schema object keys match CalibrationAnswersOptional", () => {
    const inner = calibrationAnswersOptionalSchema.unwrap?.() ?? calibrationAnswersOptionalSchema;
    const obj = inner as { shape?: Record<string, unknown> };
    const shapeKeys = Object.keys(obj.shape ?? {}).sort() as OptionalKeys[];
    expect(shapeKeys).toEqual(["import_volume", "industry_emphasis", "org_role"].sort());
  });
});
