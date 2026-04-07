"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { mapDataSourceError } from "@/lib/errors/user-facing";
import { canEditContracts, getOrgMemberRole } from "@/lib/permissions";
import { isUuid } from "@/lib/security/validation";
import type { ContractObligationStatus } from "@/lib/types";
import { recomputeContractSignals } from "@/lib/workflow-signals";

const OBLIGATION_STATUSES: ContractObligationStatus[] = [
  "open",
  "in_progress",
  "done",
  "waived",
];

const MAX_TITLE_LEN = 240;
const MAX_DETAILS_LEN = 4000;
const MAX_EVIDENCE_LEN = 4000;
const MAX_TYPE_LEN = 80;
const MAX_CADENCE_LEN = 120;

function isObligationStatus(v: string): v is ContractObligationStatus {
  return OBLIGATION_STATUSES.includes(v as ContractObligationStatus);
}

async function ensureOwnerMember(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  orgId: string,
  ownerId: string | null
): Promise<boolean> {
  if (!ownerId) return true;
  const { data } = await admin
    .from("organization_members")
    .select("id")
    .eq("organization_id", orgId)
    .eq("user_id", ownerId)
    .maybeSingle();
  return !!data;
}

export async function createContractObligation(input: {
  contractId: string;
  title: string;
  details?: string | null;
  obligationType?: string | null;
  cadence?: string | null;
  dueDate?: string | null;
  ownerId?: string | null;
}) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(input.contractId)) return { error: "Invalid contract" };

  const title = input.title.trim();
  const details = input.details?.trim() ?? "";
  const obligationType = input.obligationType?.trim() || "general";
  const cadence = input.cadence?.trim() || null;
  const dueDate = input.dueDate?.trim() || null;
  const ownerId = input.ownerId?.trim() || null;

  if (!title) return { error: "Title is required" };
  if (title.length > MAX_TITLE_LEN) return { error: "Title is too long" };
  if (details.length > MAX_DETAILS_LEN) return { error: "Details are too long" };
  if (obligationType.length > MAX_TYPE_LEN) return { error: "Type is too long" };
  if (cadence && cadence.length > MAX_CADENCE_LEN) return { error: "Cadence is too long" };
  if (ownerId && !isUuid(ownerId)) return { error: "Invalid owner" };
  if (dueDate && Number.isNaN(new Date(`${dueDate}T12:00:00`).getTime())) {
    return { error: "Invalid due date" };
  }

  const { data: contract } = await admin
    .from("contracts")
    .select("id, organization_id")
    .eq("id", input.contractId)
    .maybeSingle();
  if (!contract) return { error: "Contract not found" };

  const role = await getOrgMemberRole(admin, user.id, contract.organization_id);
  if (!canEditContracts(role)) {
    return { error: "Viewers cannot create obligations." };
  }
  if (!(await ensureOwnerMember(admin, contract.organization_id, ownerId))) {
    return { error: "Owner must be a member of this organization." };
  }

  const { data: created, error } = await admin
    .from("contract_obligations")
    .insert({
      contract_id: contract.id,
      organization_id: contract.organization_id,
      created_by: user.id,
      owner_id: ownerId,
      title,
      details: details || null,
      obligation_type: obligationType,
      cadence,
      due_date: dueDate,
      status: "open",
    })
    .select("id")
    .single();
  if (error) return { error: mapDataSourceError(error.message) };

  await admin.from("audit_events").insert({
    organization_id: contract.organization_id,
    contract_id: contract.id,
    user_id: user.id,
    action: "obligation.created",
    details: {
      obligation_id: created.id,
      title,
      obligation_type: obligationType,
      due_date: dueDate,
    },
  });
  await recomputeContractSignals(admin, contract.id);

  return { success: true as const, obligationId: created.id };
}

export async function updateContractObligation(input: {
  obligationId: string;
  status?: ContractObligationStatus;
  ownerId?: string | null;
  dueDate?: string | null;
  evidenceNotes?: string | null;
}) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(input.obligationId)) return { error: "Invalid obligation" };

  const { data: obligation } = await admin
    .from("contract_obligations")
    .select("id, contract_id, organization_id")
    .eq("id", input.obligationId)
    .maybeSingle();
  if (!obligation) return { error: "Obligation not found" };

  const role = await getOrgMemberRole(admin, user.id, obligation.organization_id);
  if (!canEditContracts(role)) {
    return { error: "Viewers cannot update obligations." };
  }

  const patch: Record<string, unknown> = {};

  if (input.status !== undefined) {
    if (!isObligationStatus(input.status)) return { error: "Invalid status" };
    patch.status = input.status;
    patch.completed_at =
      input.status === "done" || input.status === "waived"
        ? new Date().toISOString()
        : null;
  }
  if (input.ownerId !== undefined) {
    const ownerId = input.ownerId?.trim() || null;
    if (ownerId && !isUuid(ownerId)) return { error: "Invalid owner" };
    if (!(await ensureOwnerMember(admin, obligation.organization_id, ownerId))) {
      return { error: "Owner must be a member of this organization." };
    }
    patch.owner_id = ownerId;
  }
  if (input.dueDate !== undefined) {
    const dueDate = input.dueDate?.trim() || null;
    if (dueDate && Number.isNaN(new Date(`${dueDate}T12:00:00`).getTime())) {
      return { error: "Invalid due date" };
    }
    patch.due_date = dueDate;
  }
  if (input.evidenceNotes !== undefined) {
    const evidence = input.evidenceNotes?.trim() || null;
    if (evidence && evidence.length > MAX_EVIDENCE_LEN) {
      return { error: "Evidence notes are too long" };
    }
    patch.evidence_notes = evidence;
  }

  if (Object.keys(patch).length === 0) return { success: true as const };

  const { error } = await admin
    .from("contract_obligations")
    .update(patch)
    .eq("id", input.obligationId);
  if (error) return { error: mapDataSourceError(error.message) };

  await admin.from("audit_events").insert({
    organization_id: obligation.organization_id,
    contract_id: obligation.contract_id,
    user_id: user.id,
    action: "obligation.updated",
    details: { obligation_id: input.obligationId, ...patch },
  });
  await recomputeContractSignals(admin, obligation.contract_id);

  return { success: true as const };
}

export async function deleteContractObligation(obligationId: string) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(obligationId)) return { error: "Invalid obligation" };

  const { data: obligation } = await admin
    .from("contract_obligations")
    .select("id, contract_id, organization_id")
    .eq("id", obligationId)
    .maybeSingle();
  if (!obligation) return { error: "Obligation not found" };

  const role = await getOrgMemberRole(admin, user.id, obligation.organization_id);
  if (!canEditContracts(role)) return { error: "Viewers cannot delete obligations." };

  const { error } = await admin
    .from("contract_obligations")
    .delete()
    .eq("id", obligationId);
  if (error) return { error: mapDataSourceError(error.message) };

  await admin.from("audit_events").insert({
    organization_id: obligation.organization_id,
    contract_id: obligation.contract_id,
    user_id: user.id,
    action: "obligation.deleted",
    details: { obligation_id: obligationId },
  });
  await recomputeContractSignals(admin, obligation.contract_id);

  return { success: true as const };
}

export async function createObligationTemplate(input: {
  contractType: string;
  title: string;
  details?: string | null;
  obligationType?: string | null;
  cadence?: string | null;
  dueOffsetDays?: number | null;
}) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const contractType = input.contractType.trim();
  const title = input.title.trim();
  if (!contractType) return { error: "Contract type is required" };
  if (!title) return { error: "Template title is required" };
  if (contractType.length > MAX_TYPE_LEN) return { error: "Contract type is too long" };
  if (title.length > MAX_TITLE_LEN) return { error: "Template title is too long" };

  const { data: membership } = await admin
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership || !canEditContracts(membership.role as "admin" | "editor" | "viewer")) {
    return { error: "Access denied" };
  }

  const { error } = await admin.from("obligation_templates").insert({
    organization_id: membership.organization_id,
    contract_type: contractType,
    title,
    details: input.details?.trim() || null,
    obligation_type: input.obligationType?.trim() || "general",
    cadence: input.cadence?.trim() || null,
    due_offset_days:
      typeof input.dueOffsetDays === "number" && Number.isFinite(input.dueOffsetDays)
        ? Math.max(0, Math.trunc(input.dueOffsetDays))
        : null,
    created_by: user.id,
  });
  if (error) return { error: mapDataSourceError(error.message) };

  return { success: true as const };
}

export async function createObligationTemplateForm(formData: FormData) {
  const contractType = String(formData.get("contractType") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const details = String(formData.get("details") ?? "").trim();
  const obligationType = String(formData.get("obligationType") ?? "").trim();
  const cadence = String(formData.get("cadence") ?? "").trim();
  const dueOffsetRaw = String(formData.get("dueOffsetDays") ?? "").trim();
  const dueOffsetDays = dueOffsetRaw ? Number(dueOffsetRaw) : null;
  const res = await createObligationTemplate({
    contractType,
    title,
    details: details || null,
    obligationType: obligationType || null,
    cadence: cadence || null,
    dueOffsetDays:
      dueOffsetDays != null && Number.isFinite(dueOffsetDays) ? dueOffsetDays : null,
  });
  if (res && "error" in res && res.error) {
    console.error("[obligations] createObligationTemplateForm", res.error);
  }
}

export async function applyObligationTemplatesToContract(contractId: string) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(contractId)) return { error: "Invalid contract" };

  const { data: contract } = await admin
    .from("contracts")
    .select("id, organization_id, contract_type")
    .eq("id", contractId)
    .maybeSingle();
  if (!contract) return { error: "Contract not found" };

  const role = await getOrgMemberRole(admin, user.id, contract.organization_id);
  if (!canEditContracts(role)) return { error: "Viewers cannot apply templates." };
  if (!contract.contract_type) return { error: "Contract type is required to apply templates." };

  const { data: templates } = await admin
    .from("obligation_templates")
    .select("title, details, obligation_type, cadence, due_offset_days")
    .eq("organization_id", contract.organization_id)
    .eq("contract_type", contract.contract_type)
    .eq("active", true);
  if (!templates || templates.length === 0) return { success: true as const, created: 0 };

  const baseDate = new Date();
  const rows = templates.map((t) => {
    const offset = typeof t.due_offset_days === "number" ? t.due_offset_days : null;
    const dueDate = offset == null ? null : new Date(baseDate.getTime() + offset * 24 * 60 * 60 * 1000);
    return {
      contract_id: contract.id,
      organization_id: contract.organization_id,
      created_by: user.id,
      owner_id: null,
      title: t.title,
      details: t.details,
      obligation_type: t.obligation_type,
      cadence: t.cadence,
      due_date: dueDate ? dueDate.toISOString().slice(0, 10) : null,
      status: "open" as const,
    };
  });

  const { error } = await admin.from("contract_obligations").insert(rows);
  if (error) return { error: mapDataSourceError(error.message) };

  await admin.from("audit_events").insert({
    organization_id: contract.organization_id,
    contract_id: contract.id,
    user_id: user.id,
    action: "obligation.templates_applied",
    details: { count: rows.length, contract_type: contract.contract_type },
  });

  return { success: true as const, created: rows.length };
}

export async function applyObligationTemplatesToContractForm(contractId: string) {
  const res = await applyObligationTemplatesToContract(contractId);
  if (res && "error" in res && res.error) {
    console.error("[obligations] applyObligationTemplatesToContractForm", res.error);
  }
}
