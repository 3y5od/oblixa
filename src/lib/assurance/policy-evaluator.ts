import type { AdminClient } from "@/lib/assurance/service";
import {
  mergeVersionPayload,
  type ControlPolicyJsonV1,
  type ParsedPolicyVersionPayload,
} from "@/lib/assurance/policy-types";
import {
  gatherPortfolioMetrics,
  gatherPortfolioMetricsForContractIds,
  type V6PortfolioMetrics,
} from "@/lib/assurance/portfolio-metrics";
import { resolveAssignmentContractIds, scopeLabel } from "@/lib/assurance/policy-scope";
import { evaluateWorkObjectPolicyBreaches } from "@/lib/assurance/policy-work-objects";

export type PolicyEvaluationScopeMeta = {
  assignment_id: string | null;
  assignment_type: string;
  label: string;
  /** Contracts in scope (empty means organization-wide rollup was used). */
  contract_ids: string[];
};

export type PolicyEvaluationResult = {
  policy_id: string;
  policy_name: string;
  enforcement_mode: string;
  remediation_playbook_id: string | null;
  pass: boolean;
  breaches: { code: string; detail: string; severity: "low" | "medium" | "high" }[];
  policy_json: ControlPolicyJsonV1;
  version_payload: ParsedPolicyVersionPayload;
  /** Unique key for this evaluation row (policy + assignment scope). */
  evaluation_unit_key: string;
  scope: PolicyEvaluationScopeMeta;
};

function exemptByVolume(
  metrics: V6PortfolioMetrics,
  payload: ParsedPolicyVersionPayload
): boolean {
  const totalEx = metrics.open_exceptions + metrics.open_exceptions_in_progress;
  for (const rule of payload.exemptionRules) {
    if (rule.exempt_if_exceptions_below != null && totalEx < rule.exempt_if_exceptions_below) {
      return true;
    }
  }
  return false;
}

async function segmentKeyHasMembershipInScope(
  admin: AdminClient,
  orgId: string,
  segmentKey: string,
  scopeContractIds: string[]
): Promise<boolean> {
  const { data: seg } = await admin
    .from("segment_definitions")
    .select("id")
    .eq("organization_id", orgId)
    .eq("key", segmentKey)
    .eq("active", true)
    .maybeSingle();
  if (!seg?.id) return false;
  const sid = String((seg as { id: string }).id);
  if (scopeContractIds.length > 0) {
    const batchSize = 2000;
    for (let i = 0; i < scopeContractIds.length; i += batchSize) {
      const batch = scopeContractIds.slice(i, i + batchSize);
      const { count: batchCount } = await admin
        .from("segment_memberships")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("segment_definition_id", sid)
        .eq("entity_type", "contract")
        .in("entity_ref_id", batch);
      if ((batchCount ?? 0) > 0) return true;
    }
    return false;
  }
  const { count } = await admin
    .from("segment_memberships")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("segment_definition_id", sid)
    .eq("entity_type", "contract");
  return (count ?? 0) > 0;
}

async function policyEvaluationExempt(
  admin: AdminClient,
  orgId: string,
  metrics: V6PortfolioMetrics,
  payload: ParsedPolicyVersionPayload,
  scopeContractIds: string[]
): Promise<boolean> {
  if (exemptByVolume(metrics, payload)) return true;
  for (const rule of payload.exemptionRules) {
    const sk = rule.segment_key?.trim();
    if (!sk) continue;
    if (await segmentKeyHasMembershipInScope(admin, orgId, sk, scopeContractIds)) return true;
  }
  return false;
}

function evaluateBreaches(
  metrics: V6PortfolioMetrics,
  payload: ParsedPolicyVersionPayload
): PolicyEvaluationResult["breaches"] {
  const policyJson = payload.policyJson;
  const ev = payload.evidenceExpectations;
  const sla = payload.slaThresholds;
  const breaches: PolicyEvaluationResult["breaches"] = [];

  if (
    policyJson.max_open_exceptions != null &&
    metrics.open_exceptions + metrics.open_exceptions_in_progress > policyJson.max_open_exceptions
  ) {
    breaches.push({
      code: "exception_pressure",
      detail: `Open exceptions (${metrics.open_exceptions + metrics.open_exceptions_in_progress}) exceed max ${policyJson.max_open_exceptions}`,
      severity: "high",
    });
  }

  if (policyJson.require_contract_owner && metrics.contracts_without_owner > 0) {
    breaches.push({
      code: "ownership_gap",
      detail: `${metrics.contracts_without_owner} active contracts have no owner`,
      severity: "high",
    });
  }

  if (
    policyJson.max_approvals_past_due != null &&
    metrics.approvals_past_due > policyJson.max_approvals_past_due
  ) {
    breaches.push({
      code: "approval_sla",
      detail: `Approvals past due (${metrics.approvals_past_due}) exceed max ${policyJson.max_approvals_past_due}`,
      severity: "medium",
    });
  }

  if (sla.max_pending_approvals != null && metrics.pending_approvals > sla.max_pending_approvals) {
    breaches.push({
      code: "pending_approval_volume",
      detail: `Pending approvals (${metrics.pending_approvals}) exceed threshold ${sla.max_pending_approvals}`,
      severity: "medium",
    });
  }

  if (sla.max_open_external_links != null && metrics.open_external_links > sla.max_open_external_links) {
    breaches.push({
      code: "external_link_backlog",
      detail: `Open external links (${metrics.open_external_links}) exceed max ${sla.max_open_external_links}`,
      severity: "low",
    });
  }

  if (
    policyJson.max_stale_evidence_submissions != null &&
    metrics.evidence_stale_proxy > policyJson.max_stale_evidence_submissions
  ) {
    breaches.push({
      code: "evidence_freshness",
      detail: `Stale evidence submissions (${metrics.evidence_stale_proxy}) exceed max ${policyJson.max_stale_evidence_submissions}`,
      severity: "medium",
    });
  }

  if (ev.max_attestation_gaps != null && metrics.attestation_gaps > ev.max_attestation_gaps) {
    breaches.push({
      code: "attestation_gaps",
      detail: `Open/overdue attestation requests (${metrics.attestation_gaps}) exceed max ${ev.max_attestation_gaps}`,
      severity: "medium",
    });
  }

  if (policyJson.max_open_decisions != null && metrics.open_decisions > policyJson.max_open_decisions) {
    breaches.push({
      code: "decision_timeliness",
      detail: `Open decisions (${metrics.open_decisions}) exceed max ${policyJson.max_open_decisions}`,
      severity: "medium",
    });
  }

  if (policyJson.max_overdue_tasks != null && metrics.overdue_tasks > policyJson.max_overdue_tasks) {
    breaches.push({
      code: "task_execution",
      detail: `Overdue tasks (${metrics.overdue_tasks}) exceed max ${policyJson.max_overdue_tasks}`,
      severity: "medium",
    });
  }

  if (
    policyJson.min_segment_health_score != null &&
    metrics.avg_assurance_score != null &&
    metrics.avg_assurance_score < policyJson.min_segment_health_score
  ) {
    breaches.push({
      code: "portfolio_health_low",
      detail: `Average assurance score (${metrics.avg_assurance_score.toFixed(1)}) is below minimum ${policyJson.min_segment_health_score}`,
      severity: "high",
    });
  }

  if (
    policyJson.min_renewal_readiness_score != null &&
    metrics.avg_renewal_readiness != null &&
    metrics.avg_renewal_readiness < policyJson.min_renewal_readiness_score
  ) {
    breaches.push({
      code: "renewal_readiness",
      detail: `Average renewal readiness (${metrics.avg_renewal_readiness.toFixed(1)}) is below minimum ${policyJson.min_renewal_readiness_score}`,
      severity: "medium",
    });
  }

  return breaches;
}

function applyBreachSeverityEscalation(
  breaches: PolicyEvaluationResult["breaches"],
  payload: ParsedPolicyVersionPayload
): PolicyEvaluationResult["breaches"] {
  const escalateAt = payload.severityModel.escalate_when_codes_gte;
  if (escalateAt != null && breaches.length >= escalateAt) {
    return breaches.map((b) => (b.severity === "medium" ? { ...b, severity: "high" as const } : b));
  }
  return breaches;
}

function needsWorkObjectTableEvaluation(payload: ParsedPolicyVersionPayload): boolean {
  const pj = payload.policyJson;
  const ev = payload.evidenceExpectations;
  return (
    pj.min_open_work_items_in_scope != null ||
    pj.max_overdue_obligations_in_scope != null ||
    pj.ownerless_grace_calendar_days != null ||
    pj.ownerless_grace_business_days != null ||
    pj.renewal_within_days_require_finance_legal_review != null ||
    pj.renewal_decision_requires_pricing_rationale === true ||
    ev.max_submitted_evidence_age_days != null ||
    (ev.min_fresh_coverage != null && ev.min_fresh_coverage > 0)
  );
}

async function evaluatePolicyUnit(
  admin: AdminClient,
  orgId: string,
  p: {
    id: string;
    name: string;
    enforcement_mode: string;
    remediation_playbook_id: string | null;
  },
  versionPayload: ParsedPolicyVersionPayload,
  metrics: V6PortfolioMetrics,
  scopeMeta: PolicyEvaluationScopeMeta,
  evaluation_unit_key: string
): Promise<PolicyEvaluationResult> {
  const scopeIds = scopeMeta.assignment_type === "global" ? [] : scopeMeta.contract_ids;
  if (await policyEvaluationExempt(admin, orgId, metrics, versionPayload, scopeIds)) {
    return {
      policy_id: p.id,
      policy_name: p.name,
      enforcement_mode: p.enforcement_mode,
      remediation_playbook_id: p.remediation_playbook_id,
      pass: true,
      breaches: [],
      policy_json: versionPayload.policyJson,
      version_payload: versionPayload,
      evaluation_unit_key,
      scope: scopeMeta,
    };
  }

  let breaches = evaluateBreaches(metrics, versionPayload);

  if (needsWorkObjectTableEvaluation(versionPayload)) {
    const wo = await evaluateWorkObjectPolicyBreaches(
      admin,
      orgId,
      scopeMeta.assignment_type === "global" ? [] : scopeMeta.contract_ids,
      versionPayload.policyJson,
      versionPayload.evidenceExpectations
    );
    breaches = [...breaches, ...wo];
  }

  breaches = applyBreachSeverityEscalation(breaches, versionPayload);

  return {
    policy_id: p.id,
    policy_name: p.name,
    enforcement_mode: p.enforcement_mode,
    remediation_playbook_id: p.remediation_playbook_id,
    pass: breaches.length === 0,
    breaches,
    policy_json: versionPayload.policyJson,
    version_payload: versionPayload,
    evaluation_unit_key,
    scope: scopeMeta,
  };
}

/**
 * Evaluate published policies using control_policy_assignments for scoped metrics.
 * Policies with no active assignments are evaluated once at organization scope.
 */
export async function evaluatePublishedControlPolicies(
  admin: AdminClient,
  orgId: string
): Promise<PolicyEvaluationResult[]> {
  const { data: policies } = await admin
    .from("control_policies")
    .select("id, name, enforcement_mode, latest_version_id, remediation_playbook_id")
    .eq("organization_id", orgId)
    .eq("status", "published");

  if (!policies?.length) return [];

  const policyIds = policies.map((p) => p.id as string);
  const { data: allAssignments } = await admin
    .from("control_policy_assignments")
    .select("id, control_policy_id, assignment_type, segment_id, target_ref_type, target_ref_id, active")
    .eq("organization_id", orgId)
    .in("control_policy_id", policyIds)
    .eq("active", true);

  type AssignmentRow = NonNullable<typeof allAssignments>[number];
  const byPolicy = new Map<string, AssignmentRow[]>();
  for (const a of allAssignments ?? []) {
    const pid = (a as { control_policy_id: string }).control_policy_id;
    const list = byPolicy.get(pid) ?? [];
    list.push(a);
    byPolicy.set(pid, list);
  }

  const orgMetrics = await gatherPortfolioMetrics(admin, orgId);
  const results: PolicyEvaluationResult[] = [];

  for (const p of policies) {
    const versionId = p.latest_version_id as string | null;
    if (!versionId) continue;

    const { data: ver } = await admin
      .from("control_policy_versions")
      .select(
        "policy_json, evidence_expectations_json, sla_thresholds_json, exemption_rules_json, severity_model_json"
      )
      .eq("organization_id", orgId)
      .eq("id", versionId)
      .maybeSingle();

    const versionPayload = mergeVersionPayload(
      ver?.policy_json,
      ver?.evidence_expectations_json,
      ver?.sla_thresholds_json,
      ver?.exemption_rules_json,
      ver?.severity_model_json
    );

    const row = {
      id: p.id as string,
      name: p.name as string,
      enforcement_mode: p.enforcement_mode as string,
      remediation_playbook_id: (p.remediation_playbook_id as string | null) ?? null,
    };

    const assignments = byPolicy.get(p.id as string) ?? [];

    if (assignments.length === 0) {
      const scopeMeta: PolicyEvaluationScopeMeta = {
        assignment_id: null,
        assignment_type: "global",
        label: "Organization (no assignments)",
        contract_ids: [],
      };
      results.push(
        await evaluatePolicyUnit(admin, orgId, row, versionPayload, orgMetrics, scopeMeta, `${p.id}:org`)
      );
      continue;
    }

    for (const asg of assignments) {
      const a = asg as {
        id: string;
        assignment_type: string;
        segment_id: string | null;
        target_ref_type: string | null;
        target_ref_id: string | null;
      };

      const contractIds = await resolveAssignmentContractIds(admin, orgId, a);
      const label = scopeLabel(a);
      const scopeMeta: PolicyEvaluationScopeMeta = {
        assignment_id: a.id,
        assignment_type: a.assignment_type,
        label,
        contract_ids: contractIds,
      };

      const metrics =
        a.assignment_type === "global"
          ? orgMetrics
          : await gatherPortfolioMetricsForContractIds(admin, orgId, contractIds);

      results.push(
        await evaluatePolicyUnit(admin, orgId, row, versionPayload, metrics, scopeMeta, `${p.id}:${a.id}`)
      );
    }
  }

  return results;
}

/**
 * @deprecated Prefer evaluatePublishedControlPolicies — uses assignments and scoped metrics.
 * Evaluates each published policy once against the provided org-wide metrics (legacy).
 */
export async function evaluatePoliciesForOrg(
  admin: AdminClient,
  orgId: string,
  metrics: V6PortfolioMetrics
): Promise<PolicyEvaluationResult[]> {
  const { data: policies } = await admin
    .from("control_policies")
    .select("id, name, enforcement_mode, latest_version_id, remediation_playbook_id")
    .eq("organization_id", orgId)
    .eq("status", "published");

  const results: PolicyEvaluationResult[] = [];

  for (const p of policies ?? []) {
    const versionId = p.latest_version_id as string | null;
    if (!versionId) continue;

    const { data: ver } = await admin
      .from("control_policy_versions")
      .select(
        "policy_json, evidence_expectations_json, sla_thresholds_json, exemption_rules_json, severity_model_json"
      )
      .eq("organization_id", orgId)
      .eq("id", versionId)
      .maybeSingle();

    const versionPayload = mergeVersionPayload(
      ver?.policy_json,
      ver?.evidence_expectations_json,
      ver?.sla_thresholds_json,
      ver?.exemption_rules_json,
      ver?.severity_model_json
    );

    const scopeMeta: PolicyEvaluationScopeMeta = {
      assignment_id: null,
      assignment_type: "global",
      label: "Organization (legacy evaluation)",
      contract_ids: [],
    };

    results.push(
      await evaluatePolicyUnit(
        admin,
        orgId,
        {
          id: p.id as string,
          name: p.name as string,
          enforcement_mode: p.enforcement_mode as string,
          remediation_playbook_id: (p.remediation_playbook_id as string | null) ?? null,
        },
        versionPayload,
        metrics,
        scopeMeta,
        `${p.id}:legacy`
      )
    );
  }

  return results;
}

/**
 * Evaluate one control policy (draft or published) for simulation / UI preview.
 */
export async function evaluateSingleControlPolicy(
  admin: AdminClient,
  orgId: string,
  policyId: string
): Promise<PolicyEvaluationResult[]> {
  const { data: p } = await admin
    .from("control_policies")
    .select("id, name, enforcement_mode, latest_version_id, remediation_playbook_id")
    .eq("organization_id", orgId)
    .eq("id", policyId)
    .maybeSingle();

  if (!p?.id) return [];

  const { data: ver } = await admin
    .from("control_policy_versions")
    .select(
      "id, policy_json, evidence_expectations_json, sla_thresholds_json, exemption_rules_json, severity_model_json, version, published"
    )
    .eq("organization_id", orgId)
    .eq("control_policy_id", policyId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!ver?.id) return [];

  const versionPayload = mergeVersionPayload(
    ver.policy_json,
    ver.evidence_expectations_json,
    ver.sla_thresholds_json,
    ver.exemption_rules_json,
    ver.severity_model_json
  );

  const row = {
    id: p.id as string,
    name: p.name as string,
    enforcement_mode: p.enforcement_mode as string,
    remediation_playbook_id: (p.remediation_playbook_id as string | null) ?? null,
  };

  const { data: allAssignments } = await admin
    .from("control_policy_assignments")
    .select("id, control_policy_id, assignment_type, segment_id, target_ref_type, target_ref_id, active")
    .eq("organization_id", orgId)
    .eq("control_policy_id", policyId)
    .eq("active", true);

  const results: PolicyEvaluationResult[] = [];
  const assignments = allAssignments ?? [];

  if (assignments.length === 0) {
    const orgMetrics = await gatherPortfolioMetrics(admin, orgId);
    const scopeMeta: PolicyEvaluationScopeMeta = {
      assignment_id: null,
      assignment_type: "global",
      label: "Organization (no assignments)",
      contract_ids: [],
    };
    results.push(
      await evaluatePolicyUnit(admin, orgId, row, versionPayload, orgMetrics, scopeMeta, `${p.id}:org`)
    );
    return results;
  }

  for (const asg of assignments) {
    const a = asg as {
      id: string;
      assignment_type: string;
      segment_id: string | null;
      target_ref_type: string | null;
      target_ref_id: string | null;
    };
    const contractIds = await resolveAssignmentContractIds(admin, orgId, a);
    const label = scopeLabel(a);
    const scopeMeta: PolicyEvaluationScopeMeta = {
      assignment_id: a.id,
      assignment_type: a.assignment_type,
      label,
      contract_ids: contractIds,
    };
    const metrics =
      a.assignment_type === "global"
        ? await gatherPortfolioMetrics(admin, orgId)
        : await gatherPortfolioMetricsForContractIds(admin, orgId, contractIds);
    results.push(
      await evaluatePolicyUnit(admin, orgId, row, versionPayload, metrics, scopeMeta, `${p.id}:${a.id}`)
    );
  }

  return results;
}
