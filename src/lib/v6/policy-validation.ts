import type { ControlPolicyJsonV1, ParsedPolicyVersionPayload } from "@/lib/v6/policy-types";
import {
  defaultPolicyJson,
  mergeVersionPayload,
  parseEvidenceExpectations,
  parseExemptionRules,
  parseSeverityModel,
  parseSlaThresholds,
} from "@/lib/v6/policy-types";

export type PolicyValidationIssue = { path: string; message: string; code: string };

const SCHEMA = "v6.control_policy.v1";

function push(issues: PolicyValidationIssue[], path: string, code: string, message: string) {
  issues.push({ path, code, message });
}

function checkOptionalNonNegInt(
  issues: PolicyValidationIssue[],
  path: string,
  v: unknown,
  name: string
) {
  if (v === undefined || v === null) return;
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || !Number.isInteger(v)) {
    push(issues, path, "invalid_number", `${name} must be a non-negative integer`);
  }
}

function checkOptionalFiniteRange(
  issues: PolicyValidationIssue[],
  path: string,
  v: unknown,
  name: string,
  min: number,
  max: number
) {
  if (v === undefined || v === null) return;
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) {
    push(issues, path, "out_of_range", `${name} must be a number between ${min} and ${max}`);
  }
}

/**
 * Validates merged policy version JSON before publish (v6.md §9.1, §16 explainability).
 */
export function validateControlPolicyVersionPayload(payload: ParsedPolicyVersionPayload): {
  ok: boolean;
  issues: PolicyValidationIssue[];
} {
  const issues: PolicyValidationIssue[] = [];
  const pj = payload.policyJson;

  if (pj.schema !== SCHEMA) {
    push(issues, "policy_json.schema", "invalid_schema", `policy_json.schema must be "${SCHEMA}"`);
  }

  checkOptionalNonNegInt(issues, "policy_json.max_open_exceptions", pj.max_open_exceptions, "max_open_exceptions");
  checkOptionalNonNegInt(
    issues,
    "policy_json.max_approvals_past_due",
    pj.max_approvals_past_due,
    "max_approvals_past_due"
  );
  checkOptionalFiniteRange(
    issues,
    "policy_json.min_segment_health_score",
    pj.min_segment_health_score,
    "min_segment_health_score",
    0,
    100
  );
  checkOptionalNonNegInt(
    issues,
    "policy_json.max_stale_evidence_submissions",
    pj.max_stale_evidence_submissions,
    "max_stale_evidence_submissions"
  );
  checkOptionalNonNegInt(issues, "policy_json.max_open_decisions", pj.max_open_decisions, "max_open_decisions");
  checkOptionalNonNegInt(issues, "policy_json.max_overdue_tasks", pj.max_overdue_tasks, "max_overdue_tasks");
  checkOptionalFiniteRange(
    issues,
    "policy_json.min_renewal_readiness_score",
    pj.min_renewal_readiness_score,
    "min_renewal_readiness_score",
    0,
    100
  );
  checkOptionalNonNegInt(
    issues,
    "policy_json.min_open_work_items_in_scope",
    pj.min_open_work_items_in_scope,
    "min_open_work_items_in_scope"
  );
  checkOptionalNonNegInt(
    issues,
    "policy_json.max_overdue_obligations_in_scope",
    pj.max_overdue_obligations_in_scope,
    "max_overdue_obligations_in_scope"
  );
  checkOptionalNonNegInt(
    issues,
    "policy_json.ownerless_grace_calendar_days",
    pj.ownerless_grace_calendar_days,
    "ownerless_grace_calendar_days"
  );
  checkOptionalNonNegInt(
    issues,
    "policy_json.ownerless_grace_business_days",
    pj.ownerless_grace_business_days,
    "ownerless_grace_business_days"
  );
  checkOptionalNonNegInt(
    issues,
    "policy_json.renewal_within_days_require_finance_legal_review",
    pj.renewal_within_days_require_finance_legal_review,
    "renewal_within_days_require_finance_legal_review"
  );

  const ev = payload.evidenceExpectations;
  checkOptionalFiniteRange(
    issues,
    "evidence_expectations.min_fresh_coverage",
    ev.min_fresh_coverage,
    "min_fresh_coverage",
    0,
    1
  );
  checkOptionalNonNegInt(
    issues,
    "evidence_expectations.max_attestation_gaps",
    ev.max_attestation_gaps,
    "max_attestation_gaps"
  );
  checkOptionalNonNegInt(
    issues,
    "evidence_expectations.max_submitted_evidence_age_days",
    ev.max_submitted_evidence_age_days,
    "max_submitted_evidence_age_days"
  );
  checkOptionalNonNegInt(
    issues,
    "evidence_expectations.fresh_evidence_max_age_days",
    ev.fresh_evidence_max_age_days,
    "fresh_evidence_max_age_days"
  );

  const sla = payload.slaThresholds;
  checkOptionalNonNegInt(issues, "sla_thresholds.max_pending_approvals", sla.max_pending_approvals, "max_pending_approvals");
  checkOptionalNonNegInt(
    issues,
    "sla_thresholds.max_open_external_links",
    sla.max_open_external_links,
    "max_open_external_links"
  );

  const sm = payload.severityModel;
  checkOptionalNonNegInt(
    issues,
    "severity_model.escalate_when_codes_gte",
    sm.escalate_when_codes_gte,
    "escalate_when_codes_gte"
  );

  payload.exemptionRules.forEach((rule, i) => {
    if (rule.exempt_if_exceptions_below != null) {
      checkOptionalNonNegInt(
        issues,
        `exemption_rules[${i}].exempt_if_exceptions_below`,
        rule.exempt_if_exceptions_below,
        "exempt_if_exceptions_below"
      );
    }
  });

  return { ok: issues.length === 0, issues };
}

export function buildPayloadFromVersionRow(row: {
  policy_json?: unknown;
  evidence_expectations_json?: unknown;
  sla_thresholds_json?: unknown;
  exemption_rules_json?: unknown;
  severity_model_json?: unknown;
}): ParsedPolicyVersionPayload {
  return mergeVersionPayload(
    row.policy_json,
    row.evidence_expectations_json,
    row.sla_thresholds_json,
    row.exemption_rules_json,
    row.severity_model_json
  );
}

export function validateRawVersionRow(row: {
  policy_json?: unknown;
  evidence_expectations_json?: unknown;
  sla_thresholds_json?: unknown;
  exemption_rules_json?: unknown;
  severity_model_json?: unknown;
}): { ok: boolean; issues: PolicyValidationIssue[]; payload: ParsedPolicyVersionPayload } {
  const payload = buildPayloadFromVersionRow(row);
  const v = validateControlPolicyVersionPayload(payload);
  return { ...v, payload };
}

/** Coerce unknown policy_json from client into typed object before merge. */
export function coerceIncomingPolicyJson(raw: unknown): Partial<ControlPolicyJsonV1> {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const out: Partial<ControlPolicyJsonV1> = {};
  const assignNum = (k: keyof ControlPolicyJsonV1) => {
    const x = o[k as string];
    if (typeof x === "number" && Number.isFinite(x)) (out as Record<string, unknown>)[k as string] = x;
  };
  const assignBool = (k: keyof ControlPolicyJsonV1) => {
    const x = o[k as string];
    if (typeof x === "boolean") (out as Record<string, unknown>)[k as string] = x;
  };
  assignNum("max_open_exceptions");
  assignNum("max_approvals_past_due");
  assignNum("min_segment_health_score");
  assignNum("max_stale_evidence_submissions");
  assignNum("max_open_decisions");
  assignNum("max_overdue_tasks");
  assignNum("min_renewal_readiness_score");
  assignNum("min_open_work_items_in_scope");
  assignNum("max_overdue_obligations_in_scope");
  assignNum("ownerless_grace_calendar_days");
  assignNum("ownerless_grace_business_days");
  assignNum("renewal_within_days_require_finance_legal_review");
  assignBool("require_contract_owner");
  assignBool("renewal_decision_requires_pricing_rationale");
  return out;
}

export function parseFullVersionFromPublishBody(body: {
  policyJson?: unknown;
  evidenceExpectationsJson?: unknown;
  slaThresholdsJson?: unknown;
  exemptionRulesJson?: unknown;
  severityModelJson?: unknown;
}): ParsedPolicyVersionPayload {
  const base = defaultPolicyJsonFromPartial(body.policyJson);
  return {
    policyJson: base,
    evidenceExpectations: parseEvidenceExpectations(body.evidenceExpectationsJson),
    slaThresholds: parseSlaThresholds(body.slaThresholdsJson),
    exemptionRules: parseExemptionRules(body.exemptionRulesJson),
    severityModel: parseSeverityModel(body.severityModelJson),
  };
}

function defaultPolicyJsonFromPartial(raw: unknown): ControlPolicyJsonV1 {
  const base = defaultPolicyJson();
  if (raw && typeof raw === "object" && (raw as ControlPolicyJsonV1).schema === SCHEMA) {
    return { ...base, ...(raw as ControlPolicyJsonV1), schema: SCHEMA };
  }
  return { ...base, ...coerceIncomingPolicyJson(raw), schema: SCHEMA };
}
