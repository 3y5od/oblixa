import type { AdminClient } from "@/lib/v6/service";
import { createRow, listRows, updateRowById } from "@/lib/v6/service";
import { nowIso } from "@/lib/v5/api";
import { evaluateSingleControlPolicy } from "@/lib/v6/policy-evaluator";
import { parseFullVersionFromPublishBody, validateControlPolicyVersionPayload } from "@/lib/v6/policy-validation";

const CONTROL_POLICY_REVIEW_CONTRACT_LIMIT = 50;

function hasEvidenceExpectations(input: unknown): boolean {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  return Object.keys(input).some((key) => key !== "schema" && (input as Record<string, unknown>)[key] != null);
}

function dueInDays(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

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
    .select("name, objective")
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

  const generatedWork =
    versionInsert.error || policyUpdate.error
      ? { reviewTaskIds: [], evidenceRequirementIds: [], skippedReason: "publish_failed" as const }
      : await generateControlPolicyReviewWork(admin, orgId, policyId, userId, {
          policyName: String((policyRow as { name?: string } | null)?.name ?? (policyRow?.objective as string) ?? "Control policy"),
          evidenceExpectationsJson: payload.evidenceExpectations,
        });

  return { version: versionInsert.data, policy: policyUpdate.data, generatedWork, error: versionInsert.error ?? policyUpdate.error };
}

export async function generateControlPolicyReviewWork(
  admin: AdminClient,
  orgId: string,
  policyId: string,
  userId: string,
  options?: {
    policyName?: string;
    evidenceExpectationsJson?: unknown;
  }
): Promise<{
  reviewTaskIds: string[];
  evidenceRequirementIds: string[];
  skippedReason: "no_scoped_contracts" | "publish_failed" | null;
}> {
  const evaluations = await evaluateSingleControlPolicy(admin, orgId, policyId);
  const contractIds = [
    ...new Set(evaluations.flatMap((evaluation) => evaluation.scope.contract_ids.map(String).filter(Boolean))),
  ].slice(0, CONTROL_POLICY_REVIEW_CONTRACT_LIMIT);
  if (contractIds.length === 0) {
    return { reviewTaskIds: [], evidenceRequirementIds: [], skippedReason: "no_scoped_contracts" };
  }

  const policyName = options?.policyName?.trim() || evaluations[0]?.policy_name || "Control policy";
  const taskTitle = `Review control policy: ${policyName}`;
  const evidenceTitle = `Evidence for control policy: ${policyName}`;

  const { data: existingTasks } = await admin
    .from("contract_tasks")
    .select("id, contract_id, title")
    .eq("organization_id", orgId)
    .in("contract_id", contractIds)
    .eq("title", taskTitle);
  const existingTaskByContract = new Map(
    (existingTasks ?? []).map((row) => [String((row as { contract_id?: string }).contract_id), String((row as { id?: string }).id)])
  );

  const reviewTaskIds: string[] = [...existingTaskByContract.values()].filter(Boolean);
  const createdTaskByContract = new Map<string, string>();
  for (const contractId of contractIds) {
    if (existingTaskByContract.has(contractId)) continue;
    const task = await createRow(admin, "contract_tasks", orgId, {
      contract_id: contractId,
      created_by: userId,
      assignee_id: userId,
      title: taskTitle,
      details: `Published control policy "${policyName}" requires review for this contract.`,
      priority: "medium",
      due_date: dueInDays(7).slice(0, 10),
    });
    if (task.data?.id) {
      const taskId = String(task.data.id);
      reviewTaskIds.push(taskId);
      createdTaskByContract.set(contractId, taskId);
    }
  }

  const evidenceRequirementIds: string[] = [];
  if (hasEvidenceExpectations(options?.evidenceExpectationsJson)) {
    const { data: existingEvidence } = await admin
      .from("evidence_requirements")
      .select("id, contract_id, title")
      .eq("organization_id", orgId)
      .in("contract_id", contractIds)
      .eq("title", evidenceTitle);
    const existingEvidenceContracts = new Set(
      (existingEvidence ?? []).map((row) => String((row as { contract_id?: string }).contract_id))
    );
    evidenceRequirementIds.push(
      ...(existingEvidence ?? []).map((row) => String((row as { id?: string }).id)).filter(Boolean)
    );

    for (const contractId of contractIds) {
      const taskId = createdTaskByContract.get(contractId) ?? existingTaskByContract.get(contractId);
      if (!taskId || existingEvidenceContracts.has(contractId)) continue;
      const evidence = await createRow(admin, "evidence_requirements", orgId, {
        contract_id: contractId,
        work_item_type: "control_policy_review",
        work_item_id: taskId,
        requirement_type: "attestation",
        title: evidenceTitle,
        required: true,
        due_at: dueInDays(14),
        review_due_at: dueInDays(21),
        reviewer_id: userId,
        status: "required",
        config_json: {
          source: "control_policy_publish",
          control_policy_id: policyId,
          expectation_keys: Object.keys((options?.evidenceExpectationsJson ?? {}) as Record<string, unknown>).filter((key) => key !== "schema"),
        },
      });
      if (evidence.data?.id) evidenceRequirementIds.push(String(evidence.data.id));
    }
  }

  return { reviewTaskIds, evidenceRequirementIds, skippedReason: null };
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
