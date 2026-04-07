"use server";

import { subDays } from "date-fns";
import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { mapDataSourceError } from "@/lib/errors/user-facing";
import { canEditContracts, getOrgMemberRole } from "@/lib/permissions";
import { isUuid } from "@/lib/security/validation";
import type { RenewalCheckpointStatus } from "@/lib/types";

const CHECKPOINT_STATUSES: RenewalCheckpointStatus[] = [
  "pending",
  "completed",
  "skipped",
];

function isCheckpointStatus(v: string): v is RenewalCheckpointStatus {
  return CHECKPOINT_STATUSES.includes(v as RenewalCheckpointStatus);
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
    .maybeSingle();

  const raw = field?.field_value?.trim();
  if (!raw) return null;
  const date = new Date(`${raw}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function seedRenewalPlaybook(contractId: string) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;
  if (!isUuid(contractId)) return;

  const contract = await getContractAndRole(admin, user.id, contractId);
  if (!contract) return;

  const renewalDate = await getRenewalDate(admin, contractId);
  if (!renewalDate) return;

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
  if (templateRows.length === 0) return;

  const rows = templateRows.map((step) => ({
    contract_id: contract.id,
    organization_id: contract.organization_id,
    task_key: step.taskKey,
    label: step.label,
    offset_days: step.offsetDays,
    due_date: subDays(renewalDate, step.offsetDays).toISOString().slice(0, 10),
    status: "pending" as const,
  }));

  const { error } = await admin.from("contract_renewal_checkpoints").upsert(rows, {
    onConflict: "contract_id,task_key",
    ignoreDuplicates: false,
  });
  if (error) {
    console.error("[renewal-playbook] seed", mapDataSourceError(error.message));
    return;
  }

  await admin.from("audit_events").insert({
    organization_id: contract.organization_id,
    contract_id: contract.id,
    user_id: user.id,
    action: "renewal.playbook_seeded",
    details: { checkpoint_count: rows.length },
  });

  revalidatePath(`/contracts/${contractId}`);
  revalidatePath("/contracts/renewals");
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
    .select("id, contract_id, organization_id")
    .eq("id", input.checkpointId)
    .maybeSingle();
  if (!checkpoint) return { error: "Checkpoint not found" };

  const role = await getOrgMemberRole(admin, user.id, checkpoint.organization_id);
  if (!canEditContracts(role)) return { error: "Viewers cannot update checkpoints." };

  const completedAt =
    input.status === "completed" || input.status === "skipped"
      ? new Date().toISOString()
      : null;
  const { error } = await admin
    .from("contract_renewal_checkpoints")
    .update({ status: input.status, completed_at: completedAt })
    .eq("id", input.checkpointId);
  if (error) return { error: mapDataSourceError(error.message) };

  await admin.from("audit_events").insert({
    organization_id: checkpoint.organization_id,
    contract_id: checkpoint.contract_id,
    user_id: user.id,
    action: "renewal.checkpoint_updated",
    details: { checkpoint_id: input.checkpointId, status: input.status },
  });

  revalidatePath(`/contracts/${checkpoint.contract_id}`);
  revalidatePath("/contracts/renewals");
  return { success: true as const };
}
