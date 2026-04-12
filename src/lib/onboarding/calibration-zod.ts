import { z } from "zod";

const primaryUseCase = z.enum([
  "track_contracts_dates",
  "tasks_approvals_obligations",
  "coordinate_renewals_decisions",
  "assurance_control_workflows",
]);
const teamModel = z.enum(["solo", "small_2_5", "medium_6_20", "large_cross_functional"]);
const workflowMaturity = z.enum([
  "manual_spreadsheet",
  "somewhat_structured",
  "well_defined_cross_team",
  "highly_structured_policy",
]);
const mainPain = z.enum([
  "find_contracts_dates",
  "tasks_obligations",
  "decisions_handoffs",
  "risk_drift_control",
]);
const complexityPreference = z.enum([
  "simplest",
  "more_if_helps",
  "comfortable_advanced",
  "full_visibility",
]);
const setupIntent = z.enum([
  "upload_import",
  "review_extracted_fields",
  "organize_work_renewals",
  "configure_workflows_advanced",
]);
const assuranceIntent = z.enum(["not_now", "maybe_later", "yes_workspace"]);

export const calibrationAnswersRequiredSchema = z.object({
  primary_use_case: primaryUseCase,
  team_model: teamModel,
  workflow_maturity: workflowMaturity,
  main_pain: mainPain,
  complexity_preference: complexityPreference,
  setup_intent: setupIntent,
  assurance_intent: assuranceIntent,
});

export const calibrationAnswersOptionalSchema = z
  .object({
    industry_emphasis: z
      .enum(["unspecified", "prefer_not_say", "saas", "professional_services", "regulated", "other"])
      .optional(),
    import_volume: z.enum(["unknown", "low", "medium", "high"]).optional(),
    org_role: z.enum(["unspecified", "ic", "manager", "exec", "legal_ops"]).optional(),
  })
  .optional();

export type CalibrationAnswersRequiredParsed = z.infer<typeof calibrationAnswersRequiredSchema>;
export type CalibrationAnswersOptionalParsed = z.infer<typeof calibrationAnswersOptionalSchema>;
