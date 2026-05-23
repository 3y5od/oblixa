"use server";

import { subDays } from "date-fns";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { mapDataSourceError } from "@/lib/errors/user-facing";
import { canEditContracts, getOrgMemberRole } from "@/lib/permissions";
import { isUuid, validateBoundedString } from "@/lib/security/validation";
import type { RenewalCheckpointStatus } from "@/lib/types";
import { emitProductTelemetryEvent } from "@/lib/product-telemetry";
import { recordV10AuditEvent } from "@/lib/v10-server-contracts";
import { refreshV10ReadModelsForOrganization } from "@/lib/v10-read-model-refresh";

const MAX_WORKSPACE_NOTE_LEN = 4000;

const CHECKPOINT_STATUSES: RenewalCheckpointStatus[] = [
  "pending",
  "in_progress",
  "completed",
  "skipped",
];

const VALID_TRANSITIONS: Record<RenewalCheckpointStatus, RenewalCheckpointStatus[]> = {
  pending: ["in_progress", "completed", "skipped"],
  in_progress: ["pending", "completed", "skipped"],
  completed: ["pending"],
  skipped: ["pending"],
};

function isCheckpointStatus(v: string): v is RenewalCheckpointStatus {
  return CHECKPOINT_STATUSES.includes(v as RenewalCheckpointStatus);
}

async function revalidateRenewalPaths(contractId: string) {
  const { revalidatePath } = await import("next/cache");
  revalidatePath(`/contracts/${contractId}`);
  revalidatePath("/contracts/renewals");
}

async function getContractAndRole(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  userId: string,
  contractId: string
) {
  const { data: contract } = await admin
    .from("contracts")
    .select("id, organization_id, contract_type")
    .eq("id", contractId)
    .maybeSingle();
  if (!contract) return null;

  const role = await getOrgMemberRole(admin, userId, contract.organization_id);
  if (!canEditContracts(role)) return null;
  return contract;
}

async function getRenewalDate(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  contractId: string
): Promise<Date | null> {
  const { data: field } = await admin
    .from("extracted_fields")
    .select("field_value")
    .eq("contract_id", contractId)
    .eq("field_name", "renewal_date")
    .eq("status", "approved")
    .not("field_value", "is", null)
    .order("updated_at", { ascending: false })
    .maybeSingle();

  const raw = field?.field_value?.trim();
  if (!raw) return null;
  const date = new Date(`${raw}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function seedRenewalPlaybook(contractId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };
  if (!isUuid(contractId)) return { error: "Invalid contract" };
  const admin = await createAdminClient();

  const contract = await getContractAndRole(admin, user.id, contractId);
  if (!contract) return { error: "Access denied" };

  const renewalDate = await getRenewalDate(admin, contractId);
  if (!renewalDate) {
    await emitProductTelemetryEvent(admin, {
      organizationId: contract.organization_id,
      userId: user.id,
      contractId,
      action: "product.v9.renewal_blocker_encountered",
      details: { reason: "no_renewal_date" },
    });
    return { error: "No renewal date found" };
  }

  const { data: templates } = await admin
    .from("renewal_playbook_templates")
    .select("task_key, offset_days, label, contract_type")
    .eq("organization_id", contract.organization_id)
    .eq("active", true)
    .or(
      contract.contract_type
        ? `contract_type.is.null,contract_type.eq.${contract.contract_type}`
        : "contract_type.is.null"
    )
    .order("offset_days", { ascending: false });
  const templateRows = (templates ?? []).map((t) => ({
    taskKey: t.task_key,
    offsetDays: t.offset_days,
    label: t.label,
  }));
  if (templateRows.length === 0) {
    await emitProductTelemetryEvent(admin, {
      organizationId: contract.organization_id,
      userId: user.id,
      contractId,
      action: "product.v9.renewal_blocker_encountered",
      details: { reason: "no_playbook_templates" },
    });
    return { error: "No playbook templates found" };
  }
  const { data: scenarioRow } = await admin
    .from("contract_renewal_scenarios")
    .select("id")
    .eq("contract_id", contract.id)
    .maybeSingle();

  const rows = templateRows.map((step) => ({
    contract_id: contract.id,
    organization_id: contract.organization_id,
    task_key: step.taskKey,
    label: step.label,
    offset_days: step.offsetDays,
    due_date: subDays(renewalDate, step.offsetDays).toISOString().slice(0, 10),
    scenario_id: scenarioRow?.id ?? null,
    required: true,
    status: "pending" as const,
  }));

  const { error } = await admin.from("contract_renewal_checkpoints").upsert(rows, {
    onConflict: "contract_id,task_key",
    ignoreDuplicates: false,
  });
  if (error) return { error: mapDataSourceError(error.message) };

  await admin.from("audit_events").insert({
    organization_id: contract.organization_id,
    contract_id: contract.id,
    user_id: user.id,
    action: "renewal.playbook_seeded",
    details: { checkpoint_count: rows.length },
  });
  await recordV10AuditEvent(admin, {
    organizationId: contract.organization_id,
    actorUserId: user.id,
    action: "renewal.posture_changed",
    targetType: "contract",
    targetId: contract.id,
    contractId: contract.id,
    outcome: "success",
    safeMetadata: { posture: "playbook_seeded", checkpoint_count: rows.length },
  });

  await emitProductTelemetryEvent(admin, {
    organizationId: contract.organization_id,
    userId: user.id,
    contractId,
    action: "product.v9.renewal_action_taken",
    details: { action: "playbook_seeded", checkpoint_count: rows.length },
  });
  await refreshV10ReadModelsForOrganization(admin, contract.organization_id, {
    refreshScope: "one_contract",
    contractId: contract.id,
    reason: "renewal_playbook_seed_mutation",
    modelKeys: [
      "work_items",
      "contract_health_snapshots",
      "contract_activity_events",
      "renewal_posture_snapshots",
      "renewal_checkpoint_records",
      "audit_events",
      "command_search_index",
    ],
  });

  await revalidateRenewalPaths(contractId);
  return { success: true };
}

export async function updateRenewalCheckpointStatus(input: {
  checkpointId: string;
  status: RenewalCheckpointStatus;
}) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };
  if (!isUuid(input.checkpointId)) return { error: "Invalid checkpoint" };
  if (!isCheckpointStatus(input.status)) return { error: "Invalid status" };

  const { data: checkpoint } = await admin
    .from("contract_renewal_checkpoints")
    .select("id, contract_id, organization_id, status")
    .eq("id", input.checkpointId)
    .maybeSingle();
  if (!checkpoint) return { error: "Checkpoint not found" };

  const role = await getOrgMemberRole(admin, user.id, checkpoint.organization_id);
  if (!canEditContracts(role)) return { error: "Viewers cannot update checkpoints." };

  const currentStatus = checkpoint.status as RenewalCheckpointStatus;
  const allowed = VALID_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(input.status))
    return { error: `Cannot transition from ${currentStatus} to ${input.status}` };

  const completedAt =
    input.status === "completed" || input.status === "skipped"
      ? new Date().toISOString()
      : null;
  const { error } = await admin
    .from("contract_renewal_checkpoints")
    .update({
      status: input.status,
      completed_at: completedAt,
      completed_by:
        input.status === "completed" || input.status === "skipped" ? user.id : null,
    })
    .eq("id", input.checkpointId);
  if (error) return { error: mapDataSourceError(error.message) };

  await admin.from("audit_events").insert({
    organization_id: checkpoint.organization_id,
    contract_id: checkpoint.contract_id,
    user_id: user.id,
    action: "renewal.checkpoint_updated",
    details: { checkpoint_id: input.checkpointId, status: input.status },
  });
  await recordV10AuditEvent(admin, {
    organizationId: checkpoint.organization_id,
    actorUserId: user.id,
    action: "renewal.posture_changed",
    targetType: "contract",
    targetId: checkpoint.contract_id,
    contractId: checkpoint.contract_id,
    outcome: "success",
    beforeStateHash: currentStatus,
    afterStateHash: input.status,
    safeMetadata: { checkpoint_id: input.checkpointId },
  });

  await emitProductTelemetryEvent(admin, {
    organizationId: checkpoint.organization_id,
    userId: user.id,
    contractId: checkpoint.contract_id,
    action: "product.v9.renewal_action_taken",
    details: { action: "checkpoint_updated", checkpoint_id: input.checkpointId, status: input.status },
  });
  await refreshV10ReadModelsForOrganization(admin, checkpoint.organization_id, {
    refreshScope: "one_contract",
    contractId: checkpoint.contract_id,
    reason: "renewal_checkpoint_status_mutation",
    modelKeys: [
      "work_items",
      "contract_health_snapshots",
      "contract_activity_events",
      "renewal_posture_snapshots",
      "renewal_checkpoint_records",
      "audit_events",
      "command_search_index",
    ],
  });

  await revalidateRenewalPaths(checkpoint.contract_id);
  return { success: true as const };
}

export async function addRenewalWorkspaceNote(input: {
  contractId: string;
  body: string;
  pinned?: boolean;
}) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };
  if (!isUuid(input.contractId)) return { error: "Invalid contract" };
  const bodyValidation = validateBoundedString(input.body, {
    maxLength: MAX_WORKSPACE_NOTE_LEN,
    allowTextWhitespaceControls: true,
  });
  if (!bodyValidation.ok) {
    if (bodyValidation.error === "string_too_long") return { error: "Note is too long" };
    if (bodyValidation.error === "unsafe_characters") return { error: "Note contains unsupported characters" };
    return { error: "Note is required" };
  }
  const body = bodyValidation.value;

  const contract = await getContractAndRole(admin, user.id, input.contractId);
  if (!contract) return { error: "Access denied" };
  const { data: scenario } = await admin
    .from("contract_renewal_scenarios")
    .select("id")
    .eq("contract_id", contract.id)
    .maybeSingle();

  const { error } = await admin.from("contract_renewal_workspace_notes").insert({
    organization_id: contract.organization_id,
    contract_id: contract.id,
    scenario_id: scenario?.id ?? null,
    author_id: user.id,
    body,
    pinned: Boolean(input.pinned),
  });
  if (error) return { error: mapDataSourceError(error.message) };

  await admin.from("audit_events").insert({
    organization_id: contract.organization_id,
    contract_id: contract.id,
    user_id: user.id,
    action: "renewal.workspace_note_added",
    details: { pinned: Boolean(input.pinned) },
  });

  await revalidateRenewalPaths(contract.id);
  return { success: true as const };
}

export async function addRenewalWorkspaceNoteForm(formData: FormData) {
  const contractId = String(formData.get("contractId") ?? "").trim();
  const body = String(formData.get("body") ?? "");
  const pinned = String(formData.get("pinned") ?? "") === "1";
  return await addRenewalWorkspaceNote({ contractId, body, pinned });
}
