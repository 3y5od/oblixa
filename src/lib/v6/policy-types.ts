/**
 * Machine-readable control policy payload (stored in control_policy_versions.policy_json).
 * Aligned with docs/v6.md §9.1 — extended fields merge with column JSON on the version row.
 */
export type ControlPolicyJsonV1 = {
  schema: "v6.control_policy.v1";
  /** Optional numeric thresholds evaluated against live portfolio metrics */
  max_open_exceptions?: number;
  /** If true, any contract in active workflow without owner is a breach */
  require_contract_owner?: boolean;
  /** Alert when pending approvals past due exceed this count */
  max_approvals_past_due?: number;
  /** Minimum portfolio health score (0–100) before warning */
  min_segment_health_score?: number;
  /** Max stale evidence submissions (proxy: submitted >90d ago still "submitted") */
  max_stale_evidence_submissions?: number;
  /** Max open decision workspaces before flagging decision timeliness */
  max_open_decisions?: number;
  /** Max overdue contract tasks */
  max_overdue_tasks?: number;
  /** Minimum renewal readiness index 0–100 (uses scorecard renewal_readiness dimension when available) */
  min_renewal_readiness_score?: number;
  /**
   * Minimum count of active contract_tasks (open, in_progress, blocked) in evaluation scope.
   * Enforces “required work objects” coverage for the scoped contracts.
   */
  min_open_work_items_in_scope?: number;
  /**
   * Maximum overdue obligations (past due_date, status open/in_progress) allowed in scope.
   */
  max_overdue_obligations_in_scope?: number;
  /**
   * Breach when any scoped active contract has no owner longer than this many calendar days (since created_at).
   * Example §9.1: ownerless longer than a short grace window.
   */
  ownerless_grace_calendar_days?: number;
  /**
   * When set (and > 0), ownerless grace uses **business days** (Mon–Fri, UTC) per v6.md §9.1.
   * Takes precedence over `ownerless_grace_calendar_days` when both are set.
   */
  ownerless_grace_business_days?: number;
  /**
   * Contracts with an approved renewal_date within this many days must have finance/legal renewal approval on file.
   * Checks `contract_approvals` with approval_type `renewal_decision` in pending or approved.
   */
  renewal_within_days_require_finance_legal_review?: number;
  /**
   * Open renewal decision workspaces must carry pricing rationale in recommendation_json (keys: pricing_rationale | commercial_rationale).
   */
  renewal_decision_requires_pricing_rationale?: boolean;
};

/** Parsed from control_policy_versions.evidence_expectations_json */
export type EvidenceExpectationsV1 = {
  schema?: "v6.evidence_expectations.v1";
  /** Minimum fraction of contracts with fresh evidence (0–1); optional soft check */
  min_fresh_coverage?: number;
  /** Max age in days for submitted/approved evidence to count as "fresh" for min_fresh_coverage (default 90). */
  fresh_evidence_max_age_days?: number;
  /** Treat attestations in open/overdue as gaps */
  max_attestation_gaps?: number;
  /**
   * Evidence in "submitted" status older than this many days counts toward stale evidence in scope
   * (scoped to evidence_submissions.contract_id when assignments apply).
   */
  max_submitted_evidence_age_days?: number;
};

/** Parsed from control_policy_versions.sla_thresholds_json */
export type SlaThresholdsV1 = {
  schema?: "v6.sla_thresholds.v1";
  /** Max pending approvals (non-past-due) before warning */
  max_pending_approvals?: number;
  /** Max open external action links */
  max_open_external_links?: number;
};

/** Parsed from control_policy_versions.exemption_rules_json — array of rules */
export type ExemptionRuleV1 = {
  /** When set, evaluation is exempt if this segment (`segment_definitions.key`) has ≥1 member in scope (or any member org-wide when scope is global). */
  segment_key?: string;
  /** Skip breach if metric is below this (e.g. low-volume org) */
  exempt_if_exceptions_below?: number;
  note?: string;
};

/** Parsed from control_policy_versions.severity_model_json */
export type SeverityModelV1 = {
  schema?: "v6.severity_model.v1";
  /** Bump breach severity when multiple codes fire */
  escalate_when_codes_gte?: number;
};

export type ParsedPolicyVersionPayload = {
  policyJson: ControlPolicyJsonV1;
  evidenceExpectations: EvidenceExpectationsV1;
  slaThresholds: SlaThresholdsV1;
  exemptionRules: ExemptionRuleV1[];
  severityModel: SeverityModelV1;
};

export function defaultPolicyJson(): ControlPolicyJsonV1 {
  return {
    schema: "v6.control_policy.v1",
    max_open_exceptions: 25,
    require_contract_owner: true,
    max_approvals_past_due: 10,
    min_segment_health_score: 60,
  };
}

export function parsePolicyJson(raw: unknown): ControlPolicyJsonV1 {
  if (raw && typeof raw === "object" && (raw as ControlPolicyJsonV1).schema === "v6.control_policy.v1") {
    return { ...defaultPolicyJson(), ...(raw as ControlPolicyJsonV1) };
  }
  return defaultPolicyJson();
}

export function parseEvidenceExpectations(raw: unknown): EvidenceExpectationsV1 {
  if (raw && typeof raw === "object") {
    return { schema: "v6.evidence_expectations.v1", ...(raw as EvidenceExpectationsV1) };
  }
  return {};
}

export function parseSlaThresholds(raw: unknown): SlaThresholdsV1 {
  if (raw && typeof raw === "object") {
    return { schema: "v6.sla_thresholds.v1", ...(raw as SlaThresholdsV1) };
  }
  return {};
}

export function parseExemptionRules(raw: unknown): ExemptionRuleV1[] {
  if (Array.isArray(raw)) {
    return raw.filter((r) => r && typeof r === "object") as ExemptionRuleV1[];
  }
  return [];
}

export function parseSeverityModel(raw: unknown): SeverityModelV1 {
  if (raw && typeof raw === "object") {
    return { schema: "v6.severity_model.v1", ...(raw as SeverityModelV1) };
  }
  return {};
}

export function mergeVersionPayload(
  policyJsonRaw: unknown,
  evidenceRaw: unknown,
  slaRaw: unknown,
  exemptionRaw: unknown,
  severityRaw: unknown
): ParsedPolicyVersionPayload {
  return {
    policyJson: parsePolicyJson(policyJsonRaw),
    evidenceExpectations: parseEvidenceExpectations(evidenceRaw),
    slaThresholds: parseSlaThresholds(slaRaw),
    exemptionRules: parseExemptionRules(exemptionRaw),
    severityModel: parseSeverityModel(severityRaw),
  };
}
