import { redirect } from "next/navigation";
import { createAdminClient, createClient, getOrEnsureDeterministicMembership } from "@/lib/supabase/server";
import { type ContractStatus, type OrgRole } from "@/lib/types";
import {
  requireContractWriteAccess as requireWriteAccess,
  verifyOrgMembership,
} from "@/lib/actions/contracts-access";
import { mapDataSourceError } from "@/lib/errors/user-facing";
import { canEditContracts } from "@/lib/permissions";
import { isUuid } from "@/lib/security/validation";
import { enqueueOutboundEvent } from "@/lib/integrations/events";
import { recomputeContractSignals } from "@/lib/workflow-signals";
import { emitProductTelemetryIfFirstInOrganization } from "@/lib/product-telemetry";

const VALID_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  draft: ["pending_review"],
  pending_review: ["active"],
  active: ["expired", "terminated"],
  expired: ["active"],
  terminated: ["active"],
};

const MAX_REQUIRED_NEXT_STEP_LEN = 240;
const MAX_SOURCE_SYSTEM_LEN = 80;
const MAX_EXTERNAL_REF_LEN = 160;
const MAX_REGION_LEN = 40;
const MAX_ANNUAL_VALUE = 999999999999.99;

export async function updateContractStatus(
  contractId: string,
  newStatus: string,
  applyContractTemplatePack: (contractId: string) => Promise<{ error?: string } | { success: true }>
) {
  const supabase = await createClient();
  const admin = await createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(contractId)) return { error: "Invalid contract" };

  const validStatuses = ["draft", "pending_review", "active", "expired", "terminated"];
  if (!validStatuses.includes(newStatus)) {
    return { error: "Invalid status" };
  }

  const { data: contract } = await admin
    .from("contracts")
    .select("organization_id, title, status, owner_id")
    .eq("id", contractId)
    .single();

  if (!contract) return { error: "Contract not found" };

  if (!(await verifyOrgMembership(admin, user.id, contract.organization_id))) {
    return { error: "Access denied" };
  }

  const writeErr = await requireWriteAccess(admin, user.id, contract.organization_id);
  if (writeErr) return writeErr;

  const currentStatus = contract.status as ContractStatus;
  const allowed = VALID_TRANSITIONS[currentStatus];
  if (!allowed?.includes(newStatus as ContractStatus)) {
    return { error: `Cannot transition from ${currentStatus} to ${newStatus}` };
  }

  if (newStatus === "active") {
    if (!contract.owner_id) {
      return { error: "Assign an owner before moving a contract to active." };
    }
    const { data: requiredFields } = await admin
      .from("extracted_fields")
      .select("field_name, status")
      .eq("contract_id", contractId)
      .in("field_name", ["end_date", "renewal_date", "notice_window"]);
    const approvedRequired = new Set(
      (requiredFields ?? [])
        .filter((f) => f.status === "approved")
        .map((f) => f.field_name)
    );
    if (approvedRequired.size < 2) {
      return {
        error:
          "Active status requires owner plus approved key dates (at least two of end_date, renewal_date, notice_window).",
      };
    }
  }

  const statusPatch: Record<string, unknown> = { status: newStatus };
  if (newStatus === "active") {
    statusPatch.intake_status = "active";
    statusPatch.operationally_active_at = new Date().toISOString();
    statusPatch.reviewed_at = new Date().toISOString();
    statusPatch.required_next_step = null;
    statusPatch.health_status = "healthy";
  } else if (newStatus === "terminated") {
    statusPatch.intake_status = "archived";
  }

  const { error } = await admin
    .from("contracts")
    .update(statusPatch)
    .eq("id", contractId);

  if (error) return { error: mapDataSourceError(error.message) };

  await admin.from("audit_events").insert({
    organization_id: contract.organization_id,
    contract_id: contractId,
    user_id: user.id,
    action: "contract.status_changed",
    details: { old_status: contract.status, new_status: newStatus },
  });

  await admin.from("contract_intake_history").insert({
    contract_id: contractId,
    organization_id: contract.organization_id,
    from_status: currentStatus,
    to_status: newStatus,
    changed_by: user.id,
    note: "Workflow status transition",
  });

  await enqueueOutboundEvent({
    organizationId: contract.organization_id,
    eventType: "contract.status_changed",
    entityType: "contract",
    entityId: contractId,
    payload: { old_status: contract.status, new_status: newStatus },
  });

  if (newStatus === "active" && currentStatus === "pending_review") {
    await emitProductTelemetryIfFirstInOrganization(admin, {
      organizationId: contract.organization_id,
      userId: user.id,
      contractId,
      action: "product.v9.first_review_completed",
      details: { from: "pending_review", to: "active" },
    });
  }

  if (newStatus === "active") {
    await applyContractTemplatePack(contractId);
  }

  return { success: true };
}

export async function updateContractOperationalState(input: {
  contractId: string;
  intakeStatus:
    | "awaiting_review"
    | "in_clarification"
    | "active"
    | "at_risk"
    | "renewal_prep"
    | "notice_decision"
    | "archived";
  healthStatus: "healthy" | "watch" | "at_risk" | "unknown";
  requiredNextStep?: string | null;
  intakeOwnerId?: string | null;
  intakeSource?: string | null;
  intakeCompletenessScore?: number | null;
}) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(input.contractId)) return { error: "Invalid contract" };

  const requiredNextStep = input.requiredNextStep?.trim() || null;
  const intakeOwnerId = input.intakeOwnerId?.trim() || null;
  const intakeSource = input.intakeSource?.trim() || null;
  const intakeCompletenessScore =
    typeof input.intakeCompletenessScore === "number" && Number.isFinite(input.intakeCompletenessScore)
      ? Math.max(0, Math.min(100, Number(input.intakeCompletenessScore)))
      : null;
  if (requiredNextStep && requiredNextStep.length > MAX_REQUIRED_NEXT_STEP_LEN) {
    return { error: "Required next step is too long" };
  }
  if (intakeSource && intakeSource.length > MAX_SOURCE_SYSTEM_LEN) {
    return { error: "Intake source is too long" };
  }
  if (intakeOwnerId && !isUuid(intakeOwnerId)) return { error: "Invalid intake owner" };

  const { data: contract } = await admin
    .from("contracts")
    .select("id, organization_id, intake_status")
    .eq("id", input.contractId)
    .single();
  if (!contract) return { error: "Contract not found" };

  if (!(await verifyOrgMembership(admin, user.id, contract.organization_id))) {
    return { error: "Access denied" };
  }
  const writeErr = await requireWriteAccess(admin, user.id, contract.organization_id);
  if (writeErr) return writeErr;
  if (
    intakeOwnerId &&
    !(await verifyOrgMembership(admin, intakeOwnerId, contract.organization_id))
  ) {
    return { error: "Intake owner must be a member of this organization." };
  }

  const { error } = await admin
    .from("contracts")
    .update({
      intake_status: input.intakeStatus,
      health_status: input.healthStatus,
      required_next_step: requiredNextStep,
      intake_owner_id: intakeOwnerId,
      intake_source: intakeSource,
      intake_completeness_score: intakeCompletenessScore,
      intake_last_scored_at: new Date().toISOString(),
      reviewed_at:
        input.intakeStatus === "active" || input.intakeStatus === "in_clarification"
          ? new Date().toISOString()
          : null,
    })
    .eq("id", input.contractId);
  if (error) return { error: mapDataSourceError(error.message) };

  await admin.from("contract_intake_history").insert({
    contract_id: input.contractId,
    organization_id: contract.organization_id,
    from_status: contract.intake_status,
    to_status: input.intakeStatus,
    changed_by: user.id,
    note: requiredNextStep,
  });

  await admin.from("audit_events").insert({
    organization_id: contract.organization_id,
    contract_id: input.contractId,
    user_id: user.id,
    action: "contract.operational_state_updated",
    details: {
      intake_status: input.intakeStatus,
      health_status: input.healthStatus,
      required_next_step: requiredNextStep,
      intake_owner_id: intakeOwnerId,
      intake_source: intakeSource,
      intake_completeness_score: intakeCompletenessScore,
    },
  });

  await enqueueOutboundEvent({
    organizationId: contract.organization_id,
    eventType: "contract.operational_state_updated",
    entityType: "contract",
    entityId: input.contractId,
    payload: {
      intake_status: input.intakeStatus,
      health_status: input.healthStatus,
      required_next_step: requiredNextStep,
      intake_owner_id: intakeOwnerId,
      intake_source: intakeSource,
      intake_completeness_score: intakeCompletenessScore,
    },
  });

  return { success: true as const };
}

export async function upsertContractIntakeRequest(input: {
  contractId?: string | null;
  source?: string | null;
  sourceLabel?: string | null;
  status?: "new" | "triage" | "review" | "ready" | "rejected";
  assignedTo?: string | null;
  completenessScore?: number | null;
  payload?: Record<string, unknown>;
  rejectionReason?: string | null;
}) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const source = input.source?.trim() || "manual";
  const sourceLabel = input.sourceLabel?.trim() || null;
  const requestedStatus = input.status ?? "new";
  if (!["new", "triage", "review", "ready", "rejected"].includes(requestedStatus)) {
    return { error: "Invalid intake status" };
  }
  const assignedTo = input.assignedTo?.trim() || null;
  if (assignedTo && !isUuid(assignedTo)) return { error: "Invalid assignee" };
  const contractId = input.contractId?.trim() || null;
  if (contractId && !isUuid(contractId)) return { error: "Invalid contract" };
  const completenessScore =
    typeof input.completenessScore === "number" && Number.isFinite(input.completenessScore)
      ? Math.max(0, Math.min(100, Number(input.completenessScore)))
      : null;
  const hasAssignee = Boolean(assignedTo);
  const hasPayload = Boolean(input.payload && Object.keys(input.payload).length > 0);
  const status =
    requestedStatus === "rejected"
      ? "rejected"
      : completenessScore == null
        ? hasPayload
          ? "triage"
          : "new"
        : completenessScore >= 85 && hasAssignee
          ? "ready"
          : completenessScore >= 60
            ? "review"
            : "triage";

  const membership = await getOrEnsureDeterministicMembership(admin, user);
  if (!membership || !canEditContracts(membership.role as OrgRole)) {
    return { error: "Access denied" };
  }
  if (
    assignedTo &&
    !(await verifyOrgMembership(admin, assignedTo, membership.organization_id))
  ) {
    return { error: "Assigned intake owner must be in the organization." };
  }

  const { data: row, error } = await admin
    .from("contract_intake_requests")
    .insert({
      organization_id: membership.organization_id,
      contract_id: contractId,
      submitted_by: user.id,
      assigned_to: assignedTo,
      source,
      source_label: sourceLabel,
      status,
      payload_json: input.payload ?? {},
      completeness_score: completenessScore,
      rejection_reason: input.rejectionReason?.trim() || null,
    })
    .select("id")
    .single();
  if (error) return { error: mapDataSourceError(error.message) };

  if (contractId) {
    await admin
      .from("contracts")
      .update({
        intake_owner_id: assignedTo,
        intake_source: source,
        intake_completeness_score: completenessScore,
        intake_last_scored_at: new Date().toISOString(),
        intake_status:
          status === "ready"
            ? "active"
            : status === "review"
              ? "in_clarification"
              : status === "rejected"
                ? "at_risk"
                : "awaiting_review",
      })
      .eq("id", contractId)
      .eq("organization_id", membership.organization_id);
  }

  await admin.from("audit_events").insert({
    organization_id: membership.organization_id,
    contract_id: contractId,
    user_id: user.id,
    action: "intake.request_upserted",
    details: { intake_request_id: row.id, status, source, completeness_score: completenessScore },
  });
  await enqueueOutboundEvent({
    organizationId: membership.organization_id,
    eventType: "intake.request_upserted",
    entityType: "contract_intake_request",
    entityId: row.id,
    payload: {
      contract_id: contractId,
      status,
      source,
      completeness_score: completenessScore,
    },
    schemaVersion: "v1",
  });

  return { success: true as const, intakeRequestId: row.id };
}

export async function updateContractExternalLink(input: {
  contractId: string;
  sourceSystem?: string | null;
  region?: string | null;
  annualValue?: string | number | null;
  externalReferenceId?: string | null;
}) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(input.contractId)) return { error: "Invalid contract" };

  const sourceSystem = input.sourceSystem?.trim() || null;
  const region = input.region?.trim() || null;
  const externalReferenceId = input.externalReferenceId?.trim() || null;
  const annualValueRaw =
    typeof input.annualValue === "number"
      ? String(input.annualValue)
      : (input.annualValue?.trim() ?? "");
  const annualValue = annualValueRaw ? Number(annualValueRaw) : null;
  if (sourceSystem && sourceSystem.length > MAX_SOURCE_SYSTEM_LEN) {
    return { error: "Source system is too long" };
  }
  if (externalReferenceId && externalReferenceId.length > MAX_EXTERNAL_REF_LEN) {
    return { error: "External reference is too long" };
  }
  if (region && region.length > MAX_REGION_LEN) {
    return { error: "Region is too long" };
  }
  if (
    annualValueRaw &&
    (!Number.isFinite(annualValue) || annualValue == null || annualValue < 0 || annualValue > MAX_ANNUAL_VALUE)
  ) {
    return { error: "Annual value must be a valid positive number." };
  }

  const { data: contract } = await admin
    .from("contracts")
    .select("id, organization_id")
    .eq("id", input.contractId)
    .single();
  if (!contract) return { error: "Contract not found" };

  if (!(await verifyOrgMembership(admin, user.id, contract.organization_id))) {
    return { error: "Access denied" };
  }
  const writeErr = await requireWriteAccess(admin, user.id, contract.organization_id);
  if (writeErr) return writeErr;

  const { error } = await admin
    .from("contracts")
    .update({
      source_system: sourceSystem,
      region,
      annual_value: annualValue,
      external_reference_id: externalReferenceId,
    })
    .eq("id", input.contractId);
  if (error) return { error: mapDataSourceError(error.message) };

  await admin.from("audit_events").insert({
    organization_id: contract.organization_id,
    contract_id: input.contractId,
    user_id: user.id,
    action: "contract.external_link_updated",
    details: {
      source_system: sourceSystem,
      region,
      annual_value: annualValue,
      external_reference_id: externalReferenceId,
    },
  });

  return { success: true as const };
}

export async function deleteContract(contractId: string) {
  const supabase = await createClient();
  const admin = await createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(contractId)) return { error: "Invalid contract" };

  const { data: contract } = await admin
    .from("contracts")
    .select("organization_id, title")
    .eq("id", contractId)
    .single();

  if (!contract) return { error: "Contract not found" };

  if (!(await verifyOrgMembership(admin, user.id, contract.organization_id))) {
    return { error: "Access denied" };
  }

  const writeErr = await requireWriteAccess(admin, user.id, contract.organization_id);
  if (writeErr) return writeErr;

  const { data: files } = await admin
    .from("contract_files")
    .select("storage_path")
    .eq("contract_id", contractId);

  const { error } = await admin
    .from("contracts")
    .delete()
    .eq("id", contractId);

  if (error) return { error: mapDataSourceError(error.message) };

  await admin.from("audit_events").insert({
    organization_id: contract.organization_id,
    contract_id: contractId,
    user_id: user.id,
    action: "contract.deleted",
    details: { title: contract.title },
  });

  if (files?.length) {
    const paths = files.map((f) => f.storage_path);
    await admin.storage.from("contracts").remove(paths);
  }

  redirect("/contracts");
}

export async function applyContractTemplatePack(contractId: string) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(contractId)) return { error: "Invalid contract" };

  const { data: contract } = await admin
    .from("contracts")
    .select("id, organization_id, contract_type, owner_id")
    .eq("id", contractId)
    .single();
  if (!contract) return { error: "Contract not found" };
  if (!(await verifyOrgMembership(admin, user.id, contract.organization_id))) {
    return { error: "Access denied" };
  }
  const writeErr = await requireWriteAccess(admin, user.id, contract.organization_id);
  if (writeErr) return writeErr;

  const contractType = contract.contract_type ?? null;
  const fieldTplQuery = admin
    .from("field_templates")
    .select("field_name, default_value")
    .eq("organization_id", contract.organization_id)
    .eq("active", true);
  const reminderTplQuery = admin
    .from("reminder_templates")
    .select("field_name, offset_days, reminder_type")
    .eq("organization_id", contract.organization_id)
    .eq("active", true);
  const taskTplQuery = admin
    .from("task_templates")
    .select("title, details, due_offset_days, priority, team_key")
    .eq("organization_id", contract.organization_id)
    .eq("active", true);
  const [fieldTplRes, reminderTplRes, taskTplRes] = await Promise.all([
    (contractType
      ? fieldTplQuery.or(`contract_type.eq.${contractType},contract_type.is.null`)
      : fieldTplQuery.is("contract_type", null)),
    (contractType
      ? reminderTplQuery.or(`contract_type.eq.${contractType},contract_type.is.null`)
      : reminderTplQuery.is("contract_type", null)),
    (contractType
      ? taskTplQuery.or(`contract_type.eq.${contractType},contract_type.is.null`)
      : taskTplQuery.is("contract_type", null)),
  ]);

  const { data: existingFields } = await admin
    .from("extracted_fields")
    .select("id, field_name, field_value")
    .eq("contract_id", contractId);
  const fieldByName = new Map((existingFields ?? []).map((f) => [f.field_name, f.id]));
  const fieldValueByName = new Map(
    (existingFields ?? []).map((f) => [f.field_name, f.field_value as string | null])
  );
  let fieldsAdded = 0;
  let remindersAdded = 0;
  let tasksAdded = 0;

  for (const tpl of fieldTplRes.data ?? []) {
    if (fieldByName.has(tpl.field_name)) continue;
    const { data: inserted } = await admin
      .from("extracted_fields")
      .insert({
        contract_id: contractId,
        field_name: tpl.field_name,
        field_value: tpl.default_value,
        source: "human",
        status: "approved",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (inserted?.id) fieldByName.set(tpl.field_name, inserted.id);
    fieldValueByName.set(tpl.field_name, tpl.default_value ?? null);
    fieldsAdded += 1;
  }

  const { data: existingReminders } = await admin
    .from("reminders")
    .select("field_id, reminder_type")
    .eq("contract_id", contractId);
  const existingReminderKeys = new Set(
    (existingReminders ?? []).map((r) => `${r.field_id ?? ""}::${r.reminder_type}`)
  );
  const todayIso = new Date().toISOString().slice(0, 10);

  for (const tpl of reminderTplRes.data ?? []) {
    const fieldId = fieldByName.get(tpl.field_name);
    if (!fieldId) continue;
    const reminderKey = `${fieldId}::${tpl.reminder_type}`;
    if (existingReminderKeys.has(reminderKey)) continue;
    const rawDate = fieldValueByName.get(tpl.field_name);
    if (!rawDate) continue;
    const targetDate = new Date(`${rawDate}T12:00:00`);
    if (Number.isNaN(targetDate.getTime())) continue;
    const reminderDate = new Date(targetDate.getTime() - Math.max(0, tpl.offset_days) * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    if (reminderDate < todayIso) continue;
    await admin.from("reminders").insert({
      contract_id: contractId,
      field_id: fieldId,
      reminder_type: tpl.reminder_type,
      reminder_date: reminderDate,
      recipient_id: contract.owner_id,
    });
    existingReminderKeys.add(reminderKey);
    remindersAdded += 1;
  }

  const { data: existingTasks } = await admin
    .from("contract_tasks")
    .select("title, team_key")
    .eq("contract_id", contractId)
    .in("status", ["open", "in_progress", "blocked"]);
  const existingTaskKeys = new Set(
    (existingTasks ?? []).map((t) => `${t.title.trim().toLowerCase()}::${(t.team_key ?? "").trim().toLowerCase()}`)
  );

  for (const tpl of taskTplRes.data ?? []) {
    const taskKey = `${tpl.title.trim().toLowerCase()}::${(tpl.team_key ?? "ops").trim().toLowerCase()}`;
    if (existingTaskKeys.has(taskKey)) continue;
    await admin.from("contract_tasks").insert({
      contract_id: contractId,
      organization_id: contract.organization_id,
      created_by: user.id,
      assignee_id: contract.owner_id,
      title: tpl.title,
      details: tpl.details ?? null,
      status: "open",
      priority: tpl.priority,
      created_via: "rule",
      team_key: tpl.team_key ?? "ops",
      due_date: new Date(
        Date.now() + Math.max(0, tpl.due_offset_days) * 24 * 60 * 60 * 1000
      )
        .toISOString()
        .slice(0, 10),
    });
    existingTaskKeys.add(taskKey);
    tasksAdded += 1;
  }

  await admin.from("audit_events").insert({
    organization_id: contract.organization_id,
    contract_id: contractId,
    user_id: user.id,
    action: "contract.template_pack_applied",
    details: {
      fields_added: fieldsAdded,
      reminders_added: remindersAdded,
      tasks_added: tasksAdded,
    },
  });
  await admin.from("template_change_events").insert({
    organization_id: contract.organization_id,
    template_type: "task",
    template_id: contractId,
    action: "applied",
    created_by: user.id,
    details: {
      contract_id: contractId,
      fields_added: fieldsAdded,
      reminders_added: remindersAdded,
      tasks_added: tasksAdded,
    },
  });
  await recomputeContractSignals(admin, contractId);
  return { success: true as const };
}
