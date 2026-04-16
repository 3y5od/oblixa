import type { AdminClient } from "@/lib/v6/service";
import { createRow, listRows, updateRowById } from "@/lib/v6/service";
import { nowIso } from "@/lib/v5/api";
import { evaluateSingleControlPolicy } from "@/lib/v6/policy-evaluator";
import { parseFullVersionFromPublishBody, validateControlPolicyVersionPayload } from "@/lib/v6/policy-validation";

export function listControlPolicies(admin: AdminClient, orgId: string) {
  return listRows(
    admin,
    "control_policies",
    orgId,
    "id, name, objective, enforcement_mode, status, latest_version_id, updated_at"
  );
}

export function createControlPolicy(
  admin: AdminClient,
  orgId: string,
  userId: string,
  payload: { name: string; objective: string; enforcementMode?: string; scope?: Record<string, unknown> }
) {
  return createRow(admin, "control_policies", orgId, {
    name: payload.name,
    objective: payload.objective,
    enforcement_mode: payload.enforcementMode ?? "observe_only",
    scope_json: payload.scope ?? {},
    created_by: userId,
  });
}

export async function publishControlPolicy(
  admin: AdminClient,
  orgId: string,
  policyId: string,
  userId: string,
  options?: {
    policyJson?: Record<string, unknown>;
    evidenceExpectationsJson?: unknown;
    slaThresholdsJson?: unknown;
    exemptionRulesJson?: unknown;
    severityModelJson?: unknown;
  }
) {
  const { data: policyRow } = await admin
    .from("control_policies")
    .select("objective")
    .eq("organization_id", orgId)
    .eq("id", policyId)
    .maybeSingle();

  const payload = parseFullVersionFromPublishBody({
    policyJson: options?.policyJson,
    evidenceExpectationsJson: options?.evidenceExpectationsJson,
    slaThresholdsJson: options?.slaThresholdsJson,
    exemptionRulesJson: options?.exemptionRulesJson,
    severityModelJson: options?.severityModelJson,
  });
  const validation = validateControlPolicyVersionPayload(payload);
  if (!validation.ok) {
    return {
      version: null,
      policy: null,
      error: {
        message: "Policy version validation failed",
        issues: validation.issues,
      },
    };
  }

  const mergedPolicyJson = {
    ...payload.policyJson,
    published_by: userId,
    published_at: nowIso(),
  };

  const { data: existing } = await admin
    .from("control_policy_versions")
    .select("version")
    .eq("organization_id", orgId)
    .eq("control_policy_id", policyId)
    .order("version", { ascending: false })
    .limit(1);

  let version = Number(existing?.[0]?.version ?? 0) + 1;

  const buildVersionRow = (v: number) => ({
    control_policy_id: policyId,
    version: v,
    objective: (policyRow?.objective as string) || "Published policy version",
    policy_json: mergedPolicyJson,
    evidence_expectations_json: payload.evidenceExpectations,
    sla_thresholds_json: payload.slaThresholds,
    exemption_rules_json: payload.exemptionRules,
    severity_model_json: payload.severityModel,
    published: true,
    published_at: nowIso(),
    created_by: userId,
  });

  let versionInsert = await createRow(admin, "control_policy_versions", orgId, buildVersionRow(version));

  if (versionInsert.error) {
    const { data: latest } = await admin
      .from("control_policy_versions")
      .select("version")
      .eq("organization_id", orgId)
      .eq("control_policy_id", policyId)
      .order("version", { ascending: false })
      .limit(1);
    version = Number(latest?.[0]?.version ?? 0) + 1;
    versionInsert = await createRow(admin, "control_policy_versions", orgId, buildVersionRow(version));
  }

  const policyUpdate = await updateRowById(admin, "control_policies", orgId, policyId, {
    status: "published",
    latest_version_id: versionInsert.data?.id,
  });

  return { version: versionInsert.data, policy: policyUpdate.data, error: versionInsert.error ?? policyUpdate.error };
}

export async function simulateControlPolicy(admin: AdminClient, orgId: string, policyId: string, userId: string) {
  const evaluations = await evaluateSingleControlPolicy(admin, orgId, policyId);
  const failed = evaluations.filter((e) => !e.pass);
  const sim = await createRow(admin, "change_simulations", orgId, {
    simulation_type: "control_policy",
    name: `Control policy what-if`,
    input_json: { control_policy_id: policyId, v6_scope_json: { evaluation_units: evaluations.length } },
    created_by: userId,
  });
  if (sim.error || !sim.data?.id) {
    return { data: null, error: sim.error, evaluations };
  }

  const run = await createRow(admin, "change_simulation_runs", orgId, {
    simulation_id: sim.data.id,
    status: "completed",
    result_json: {
      control_policy_id: policyId,
      mode: "live_eval_preview",
      evaluation_units: evaluations.length,
      failing_units: failed.length,
      evaluations: evaluations.map((e) => ({
        evaluation_unit_key: e.evaluation_unit_key,
        pass: e.pass,
        scope_label: e.scope.label,
        breach_codes: e.breaches.map((b) => b.code),
        breach_details: e.breaches.map((b) => b.detail),
        enforcement_mode: e.enforcement_mode,
      })),
    },
    created_by: userId,
  });

  return { data: run.data, error: run.error, evaluations };
}

export function assignControlPolicy(
  admin: AdminClient,
  orgId: string,
  policyId: string,
  userId: string,
  payload: { assignmentType: string; segmentId?: string; targetRefType?: string; targetRefId?: string }
) {
  return createRow(admin, "control_policy_assignments", orgId, {
    control_policy_id: policyId,
    assignment_type: payload.assignmentType,
    segment_id: payload.segmentId ?? null,
    target_ref_type: payload.targetRefType ?? null,
    target_ref_id: payload.targetRefId ?? null,
    active: true,
    created_by: userId,
  });
}

export async function patchControlPolicySettings(
  admin: AdminClient,
  orgId: string,
  policyId: string,
  patch: { remediationPlaybookId?: string | null }
) {
  const row: Record<string, unknown> = { updated_at: nowIso() };
  if ("remediationPlaybookId" in patch) {
    const v = patch.remediationPlaybookId;
    row.remediation_playbook_id = v === "" || v === undefined ? null : v;
  }
  return updateRowById(admin, "control_policies", orgId, policyId, row);
}
