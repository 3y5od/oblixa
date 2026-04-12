import { describe, expect, it } from "vitest";
import { z } from "zod";
import { stripPrototypePollutionKeys } from "@/lib/security/strip-prototype-pollution";
import {
  calibrationAnswersOptionalSchema,
  calibrationAnswersRequiredSchema,
} from "@/lib/onboarding/calibration-zod";

const previewPayloadSchema = z
  .object({
    answers_required: calibrationAnswersRequiredSchema,
    answers_optional: calibrationAnswersOptionalSchema.nullish(),
  })
  .strict();

const partialAnswersSchema = z
  .object({
    answers_required: calibrationAnswersRequiredSchema.partial().optional(),
    answers_optional: calibrationAnswersOptionalSchema.nullish(),
  })
  .strict();

const validRequired = {
  primary_use_case: "track_contracts_dates",
  team_model: "solo",
  workflow_maturity: "manual_spreadsheet",
  main_pain: "find_contracts_dates",
  complexity_preference: "simplest",
  setup_intent: "upload_import",
  assurance_intent: "not_now",
} as const;

describe("onboarding-calibration Zod payloads (adversarial)", () => {
  it("previewPayloadSchema rejects unknown enum strings", () => {
    const r = previewPayloadSchema.safeParse({
      answers_required: { ...validRequired, primary_use_case: "nope" },
    });
    expect(r.success).toBe(false);
  });

  it("previewPayloadSchema rejects extra top-level keys under .strict()", () => {
    const r = previewPayloadSchema.safeParse({
      answers_required: { ...validRequired },
      organization_id: "evil",
    });
    expect(r.success).toBe(false);
  });

  it("partialAnswersSchema rejects empty object as answers_required when paired with invalid shape", () => {
    const r = partialAnswersSchema.safeParse({
      answers_required: { primary_use_case: "not_valid" },
    });
    expect(r.success).toBe(false);
  });

  it("stripPrototypePollutionKeys removes __proto__ before strict parse", () => {
    const raw: Record<string, unknown> = { answers_required: { ...validRequired } };
    raw["__proto__"] = { polluted: true };
    const cleaned = stripPrototypePollutionKeys(raw as never);
    const r = previewPayloadSchema.safeParse(cleaned);
    expect(r.success).toBe(true);
  });
});
