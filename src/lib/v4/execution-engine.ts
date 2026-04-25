import { createAdminClient } from "@/lib/supabase/server";
import { emitProductTelemetryEvent } from "@/lib/product-telemetry";

type ProgramDefinition = {
  /** UUIDs of org evidence templates; first template is attached to each generated obligation. */
  evidenceTemplateIds?: string[];
  slas?: Array<{
    approvalType: string;
    slaHours?: number;
  }>;
  escalationRules?: Array<Record<string, unknown>>;
  taskBundles?: Array<{
    title: string;
    details?: string;
    dueOffsetDays?: number;
    priority?: "low" | "medium" | "high";
    teamKey?: string;
  }>;
  obligationBundles?: Array<{
    title: string;
    details?: string;
    obligationType?: string;
    cadence?: string;
    dueOffsetDays?: number;
  }>;
  approvalSequences?: Array<{
    approvalType: string;
    notes?: string;
    dueHours?: number;
  }>;
  renewalCheckpoints?: Array<{
    label: string;
    dueOffsetDays?: number;
  }>;
};

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;

const MAX_BUNDLES = 200;

function addDaysIso(days: number): string {
  return new Date(Date.now() + Math.max(0, days) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function resolveAssigneeByTeam(input: {
  teamKey?: string;
  overrideJson: Record<string, unknown>;
  defaultRoutingJson: Record<string, unknown>;
  autoAssignmentRules: unknown[];
}): string | null {
  const teamKey = String(input.teamKey ?? "ops");
  const overrideAssignee = String(input.overrideJson.assignee_id ?? "").trim();
  if (overrideAssignee) return overrideAssignee;

  const overrideByTeam = asRecord(input.overrideJson.assignee_by_team);
  const overrideTeamAssignee = String(overrideByTeam[teamKey] ?? "").trim();
  if (overrideTeamAssignee) return overrideTeamAssignee;

  for (const rawRule of input.autoAssignmentRules) {
    const rule = asRecord(rawRule);
    const match = asRecord(rule.match);
    const assigneeId = String(rule.assignee_id ?? "").trim();
    if (!assigneeId) continue;
    const matchTeamKey = String(match.team_key ?? "").trim();
    if (!matchTeamKey || matchTeamKey === teamKey) {
      return assigneeId;
    }
  }

  const defaults = asRecord(input.defaultRoutingJson.default_assignee_by_team);
  const defaultTeamAssignee = String(defaults[teamKey] ?? "").trim();
  if (defaultTeamAssignee) return defaultTeamAssignee;

  return null;
}

function chooseSlaId(input: {
  approvalType: string;
  contractType: string | null;
  slas: Array<{
    id: string;
    approval_type: string;
    contract_type: string | null;
  }>;
}) {
  const exact = input.slas.find(
    (row) => row.approval_type === input.approvalType && row.contract_type === input.contractType
  );
  if (exact) return exact.id;
  const typeDefault = input.slas.find(
    (row) => row.approval_type === input.approvalType && row.contract_type === null
  );
  if (typeDefault) return typeDefault.id;
  return input.slas.find((row) => row.approval_type === "default" && row.contract_type === null)?.id ?? null;
}

export async function applyProgramToContract(input: {
  admin: AdminClient;
  organizationId: string;
  contractId: string;
  programId: string;
  assignmentId: string;
  versionId: string | null;
  actorUserId: string;
}) {
  const [{ data: assignment }, { data: program }, { data: contract }, { data: orgSlas }] = await Promise.all([
    input.admin
      .from("contract_program_assignments")
      .select("id, override_json")
      .eq("organization_id", input.organizationId)
      .eq("id", input.assignmentId)
      .maybeSingle(),
    input.admin
      .from("contract_programs")
      .select("id, auto_assignment_rules, default_routing_json")
      .eq("organization_id", input.organizationId)
      .eq("id", input.programId)
      .maybeSingle(),
    input.admin
      .from("contracts")
      .select("id, contract_type")
      .eq("organization_id", input.organizationId)
      .eq("id", input.contractId)
      .maybeSingle(),
    input.admin
      .from("approval_slas")
      .select("id, approval_type, contract_type")
      .eq("organization_id", input.organizationId)
      .eq("active", true),
  ]);
  const { data: version } = await input.admin
    .from("contract_program_versions")
    .select("definition_json")
    .eq("organization_id", input.organizationId)
    .eq("id", input.versionId)
    .maybeSingle();

  const definition = ((version?.definition_json as ProgramDefinition | null) ?? {}) as ProgramDefinition;
  const evidenceTemplateIds = Array.isArray(definition.evidenceTemplateIds)
    ? definition.evidenceTemplateIds.map((id) => String(id).trim()).filter(Boolean)
    : [];
  const primaryEvidenceTemplateId = evidenceTemplateIds[0] ?? null;
  type EvidenceTpl = {
    id: string;
    name: string;
    requirement_type: string;
    template_json: unknown;
  };
  let evidenceTemplateRow: EvidenceTpl | null = null;
  if (primaryEvidenceTemplateId) {
    const { data: tpl } = await input.admin
      .from("evidence_requirement_templates")
      .select("id, name, requirement_type, template_json")
      .eq("organization_id", input.organizationId)
      .eq("id", primaryEvidenceTemplateId)
      .maybeSingle();
    if (tpl) evidenceTemplateRow = tpl as unknown as EvidenceTpl;
  }
  const overrideJson = asRecord(assignment?.override_json);
  const defaultRoutingJson = asRecord(program?.default_routing_json);
  const autoAssignmentRules = Array.isArray(program?.auto_assignment_rules) ? program.auto_assignment_rules : [];
  const contractType = contract?.contract_type ?? null;
  const slas =
    (orgSlas as Array<{ id: string; approval_type: string; contract_type: string | null }> | null) ?? [];
  const generated = {
    tasks: 0,
    obligations: 0,
    approvals: 0,
    renewals: 0,
    edges: 0,
  };

  const firstApprovals: string[] = [];
  const firstTasks: string[] = [];
  const firstObligations: string[] = [];
  const firstRenewals: string[] = [];

  const cappedTaskBundles = (definition.taskBundles ?? []).slice(0, MAX_BUNDLES);
  const cappedObligationBundles = (definition.obligationBundles ?? []).slice(0, MAX_BUNDLES);
  const cappedApprovalSequences = (definition.approvalSequences ?? []).slice(0, MAX_BUNDLES);
  const cappedRenewalCheckpoints = (definition.renewalCheckpoints ?? []).slice(0, MAX_BUNDLES);

  for (const task of cappedTaskBundles) {
    const assigneeId = resolveAssigneeByTeam({
      teamKey: task.teamKey,
      overrideJson,
      defaultRoutingJson,
      autoAssignmentRules,
    });
    const { data: row } = await input.admin
      .from("contract_tasks")
      .insert({
        contract_id: input.contractId,
        organization_id: input.organizationId,
        created_by: input.actorUserId,
        assignee_id: assigneeId,
        title: task.title,
        details: task.details ?? null,
        status: "open",
        priority: task.priority ?? "medium",
        created_via: "rule",
        team_key: task.teamKey ?? "ops",
        due_date: addDaysIso(task.dueOffsetDays ?? 7),
        program_assignment_id: input.assignmentId,
        execution_status: "ready",
      })
      .select("id")
      .maybeSingle();
    if (row?.id) {
      firstTasks.push(String(row.id));
      generated.tasks += 1;
    }
  }

  for (const obligation of cappedObligationBundles) {
    const ownerId = resolveAssigneeByTeam({
      teamKey: "obligations",
      overrideJson,
      defaultRoutingJson,
      autoAssignmentRules,
    });
    const { data: row } = await input.admin
      .from("contract_obligations")
      .insert({
        contract_id: input.contractId,
        organization_id: input.organizationId,
        created_by: input.actorUserId,
        owner_id: ownerId,
        title: obligation.title,
        details: obligation.details ?? null,
        obligation_type: obligation.obligationType ?? "general",
        cadence: obligation.cadence ?? null,
        due_date: addDaysIso(obligation.dueOffsetDays ?? 14),
        status: "open",
        program_assignment_id: input.assignmentId,
      })
      .select("id")
      .maybeSingle();
    if (row?.id) {
      firstObligations.push(String(row.id));
      generated.obligations += 1;
      if (evidenceTemplateRow) {
        const dueAt = new Date(Date.now() + (obligation.dueOffsetDays ?? 14) * 24 * 60 * 60 * 1000).toISOString();
        const { data: reqRow } = await input.admin
          .from("evidence_requirements")
          .insert({
            organization_id: input.organizationId,
            contract_id: input.contractId,
            program_id: input.programId,
            work_item_type: "obligation",
            work_item_id: row.id,
            requirement_type: evidenceTemplateRow.requirement_type,
            title: evidenceTemplateRow.name,
            required: true,
            due_at: dueAt,
            status: "required",
            config_json: asRecord(evidenceTemplateRow.template_json),
          })
          .select("id")
          .maybeSingle();
        if (reqRow?.id) {
          await input.admin
            .from("contract_obligations")
            .update({ evidence_requirement_id: reqRow.id })
            .eq("id", row.id)
            .eq("organization_id", input.organizationId);
          await emitProductTelemetryEvent(input.admin, {
            organizationId: input.organizationId,
            userId: input.actorUserId,
            contractId: input.contractId,
            action: "product.v9.evidence_requested",
            details: {
              requirementId: reqRow.id,
              workItemType: "obligation",
              obligationId: row.id,
            },
          });
        }
      }
    }
  }

  for (const approval of cappedApprovalSequences) {
    const approvalAssignee =
      String(overrideJson.approver_id ?? "").trim() ||
      String(defaultRoutingJson.default_approver_id ?? "").trim() ||
      null;
    const slaId = chooseSlaId({ approvalType: approval.approvalType, contractType, slas });
    const dueHours = Math.max(1, Math.trunc(Number(approval.dueHours ?? 72)));
    const { data: row } = await input.admin
      .from("contract_approvals")
      .insert({
        contract_id: input.contractId,
        organization_id: input.organizationId,
        approval_type: approval.approvalType,
        requested_by: input.actorUserId,
        approver_id: approvalAssignee,
        due_at: new Date(Date.now() + dueHours * 60 * 60 * 1000).toISOString(),
        status: "pending",
        sla_id: slaId,
        notes: approval.notes ?? null,
      })
      .select("id")
      .maybeSingle();
    if (row?.id) {
      firstApprovals.push(String(row.id));
      generated.approvals += 1;
    }
  }

  for (const checkpoint of cappedRenewalCheckpoints) {
    const { data: row } = await input.admin
      .from("contract_renewal_checkpoints")
      .insert({
        contract_id: input.contractId,
        organization_id: input.organizationId,
        label: checkpoint.label,
        due_date: addDaysIso(checkpoint.dueOffsetDays ?? 90),
        status: "pending",
      })
      .select("id")
      .maybeSingle();
    if (row?.id) {
      firstRenewals.push(String(row.id));
      generated.renewals += 1;
    }
  }

  // Link generated work as execution graph dependencies.
  const edges: Array<Record<string, unknown>> = [];
  for (const approvalId of firstApprovals) {
    for (const taskId of firstTasks) {
      edges.push({
        organization_id: input.organizationId,
        contract_id: input.contractId,
        from_entity_type: "task",
        from_entity_id: taskId,
        to_entity_type: "approval",
        to_entity_id: approvalId,
        relation_type: "depends_on",
        status: "active",
      });
    }
    for (const obligationId of firstObligations) {
      edges.push({
        organization_id: input.organizationId,
        contract_id: input.contractId,
        from_entity_type: "obligation",
        from_entity_id: obligationId,
        to_entity_type: "approval",
        to_entity_id: approvalId,
        relation_type: "depends_on",
        status: "active",
      });
    }
  }
  for (const renewalId of firstRenewals) {
    for (const taskId of firstTasks) {
      edges.push({
        organization_id: input.organizationId,
        contract_id: input.contractId,
        from_entity_type: "renewal_checkpoint",
        from_entity_id: renewalId,
        to_entity_type: "task",
        to_entity_id: taskId,
        relation_type: "depends_on",
        status: "active",
      });
    }
  }

  if (edges.length > 0) {
    await input.admin.from("execution_graph_edges").insert(edges);
    generated.edges = edges.length;
  }

  return generated;
}
