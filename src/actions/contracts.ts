"use server";

import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { FIELD_NAMES, type ContractStatus, type OrgRole } from "@/lib/types";
import { isPlanEnforcementEnabled, orgHasActivePlan } from "@/lib/plan";
import { resolveAppBaseUrl } from "@/lib/app-url";
import { mapDataSourceError } from "@/lib/errors/user-facing";
import { readApiJson } from "@/lib/parse-api-response";
import { canEditContracts, getOrgMemberRole } from "@/lib/permissions";
import { isContractStoragePathSafe, isUuid } from "@/lib/security/validation";
import { sanitizeUploadedFileName } from "@/lib/security/upload-filename";
import { enqueueOutboundEvent } from "@/lib/integrations/events";
import { recomputeContractSignals } from "@/lib/workflow-signals";
import { autoTransitionTasksForField } from "@/actions/tasks";

const DATE_FIELDS = new Set([
  "end_date",
  "renewal_date",
  "notice_window",
  "effective_date",
  "start_date",
]);

const REMINDER_OFFSETS_DAYS = [30, 14, 7, 1];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const ALLOWED_MANUAL_FIELD_NAMES = new Set<string>(FIELD_NAMES);

const MAX_CONTRACT_TITLE = 500;
const MAX_COUNTERPARTY_LEN = 500;
const MAX_CONTRACT_TYPE_LEN = 120;
const MAX_MANUAL_FIELD_VALUE_LEN = 4000;
const MAX_REQUIRED_NEXT_STEP_LEN = 240;
const MAX_SOURCE_SYSTEM_LEN = 80;
const MAX_EXTERNAL_REF_LEN = 160;
const MAX_REGION_LEN = 40;
const MAX_ANNUAL_VALUE = 999999999999.99;

const VALID_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  draft: ["pending_review"],
  pending_review: ["active"],
  active: ["expired", "terminated"],
  expired: ["active"],
  terminated: ["active"],
};

async function verifyOrgMembership(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  userId: string,
  orgId: string
) {
  const { data } = await admin
    .from("organization_members")
    .select("id")
    .eq("user_id", userId)
    .eq("organization_id", orgId)
    .limit(1)
    .single();
  return !!data;
}

async function requireWriteAccess(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  userId: string,
  orgId: string
): Promise<{ error: string } | null> {
  const role = await getOrgMemberRole(admin, userId, orgId);
  if (!canEditContracts(role)) {
    return { error: "Viewers cannot make changes." };
  }
  if (isPlanEnforcementEnabled() && !(await orgHasActivePlan(admin, orgId))) {
    return {
      error: "An active subscription is required. Open Billing to subscribe.",
    };
  }
  return null;
}

export async function createContract(formData: FormData) {
  const supabase = await createClient();
  const admin = await createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const title = (formData.get("title") as string)?.trim();
  const counterparty = (formData.get("counterparty") as string | null)?.trim() ?? null;
  const contractType = (formData.get("contractType") as string | null)?.trim() ?? null;
  const sourceSystem = (formData.get("sourceSystem") as string | null)?.trim() ?? null;
  const region = (formData.get("region") as string | null)?.trim() ?? null;
  const annualValueRaw = (formData.get("annualValue") as string | null)?.trim() ?? "";
  const externalReferenceId =
    (formData.get("externalReferenceId") as string | null)?.trim() ?? null;
  const organizationId = (formData.get("organizationId") as string)?.trim() ?? "";

  if (!title) return { error: "Title is required" };
  if (!organizationId) return { error: "Organization is required" };
  if (!isUuid(organizationId)) return { error: "Invalid organization" };
  if (title.length > MAX_CONTRACT_TITLE) return { error: "Title is too long" };
  if (counterparty && counterparty.length > MAX_COUNTERPARTY_LEN) {
    return { error: "Counterparty is too long" };
  }
  if (contractType && contractType.length > MAX_CONTRACT_TYPE_LEN) {
    return { error: "Contract type is too long" };
  }
  if (sourceSystem && sourceSystem.length > MAX_SOURCE_SYSTEM_LEN) {
    return { error: "Source system is too long" };
  }
  if (region && region.length > MAX_REGION_LEN) {
    return { error: "Region is too long" };
  }
  if (externalReferenceId && externalReferenceId.length > MAX_EXTERNAL_REF_LEN) {
    return { error: "External reference is too long" };
  }
  const annualValue = annualValueRaw ? Number(annualValueRaw) : null;
  if (
    annualValueRaw &&
    (!Number.isFinite(annualValue) || annualValue == null || annualValue < 0 || annualValue > MAX_ANNUAL_VALUE)
  ) {
    return { error: "Annual value must be a valid positive number." };
  }

  if (!(await verifyOrgMembership(admin, user.id, organizationId))) {
    return { error: "Access denied" };
  }

  const writeErr = await requireWriteAccess(admin, user.id, organizationId);
  if (writeErr) return writeErr;

  const { data: contract, error } = await admin
    .from("contracts")
    .insert({
      title,
      counterparty: counterparty || null,
      contract_type: contractType || null,
      organization_id: organizationId,
      owner_id: user.id,
      owner_assigned_at: new Date().toISOString(),
      created_by: user.id,
      status: "pending_review",
      intake_status: "awaiting_review",
      intake_owner_id: user.id,
      intake_source: sourceSystem || "manual",
      intake_completeness_score: 35,
      intake_last_scored_at: new Date().toISOString(),
      health_status: "unknown",
      required_next_step: "Complete extraction review",
      source_system: sourceSystem || null,
      region: region || null,
      annual_value: annualValue,
      external_reference_id: externalReferenceId || null,
    })
    .select()
    .single();

  if (error) return { error: mapDataSourceError(error.message) };

  const files = formData.getAll("files") as File[];
  const validFiles = files.filter((f) => {
    if (!f.size) return false;
    if (f.size > MAX_FILE_SIZE) {
      console.error(`File too large: ${f.name} (${f.size} bytes)`);
      return false;
    }
    if (!ALLOWED_TYPES.has(f.type)) {
      console.error(`Unsupported file type: ${f.name} (${f.type})`);
      return false;
    }
    return true;
  });

  await Promise.all(
    validFiles.map(async (file) => {
      const safeName = sanitizeUploadedFileName(file.name);
      const storagePath = `${organizationId}/${contract.id}/${crypto.randomUUID()}-${safeName}`;

      const { error: uploadError } = await admin.storage
        .from("contracts")
        .upload(storagePath, file);

      if (uploadError) {
        console.error("Upload error:", uploadError.message);
        return;
      }

      await admin.from("contract_files").insert({
        contract_id: contract.id,
        file_name: safeName,
        file_type: file.type,
        file_size: file.size,
        storage_path: storagePath,
        uploaded_by: user.id,
      });
    })
  );

  await admin.from("audit_events").insert({
    organization_id: organizationId,
    contract_id: contract.id,
    user_id: user.id,
    action: "contract.created",
    details: { title },
  });
  await admin.from("contract_notes").insert({
    contract_id: contract.id,
    organization_id: organizationId,
    author_id: user.id,
    note: "[Timeline] Contract created",
    pinned: false,
  });

  await enqueueOutboundEvent({
    organizationId: organizationId,
    eventType: "contract.created",
    entityType: "contract",
    entityId: contract.id,
    payload: { title, counterparty, contract_type: contractType },
  });
  await recomputeContractSignals(admin, contract.id);
  await applyContractTemplatePack(contract.id);

  if (validFiles.length > 0 && process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes("placeholder")) {
    triggerExtraction(contract.id).catch(console.error);
  }

  redirect(`/contracts/${contract.id}`);
}

export async function updateContractField(
  fieldId: string,
  action: "approved" | "rejected" | "edited",
  newValue?: string
) {
  const supabase = await createClient();
  const admin = await createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(fieldId)) return { error: "Invalid field" };

  const { data: field } = await admin
    .from("extracted_fields")
    .select(
      "field_name, field_value, source_snippet, source, contracts!inner(id, organization_id, owner_id)"
    )
    .eq("id", fieldId)
    .single();

  if (!field) return { error: "Field not found" };

  const contractRel = field.contracts as unknown;
  const contract = (
    Array.isArray(contractRel) ? contractRel[0] : contractRel
  ) as { id: string; organization_id: string; owner_id: string | null };

  if (!(await verifyOrgMembership(admin, user.id, contract.organization_id))) {
    return { error: "Access denied" };
  }

  const writeErr = await requireWriteAccess(admin, user.id, contract.organization_id);
  if (writeErr) return writeErr;

  if (action === "approved") {
    const hasValue =
      field.field_value != null && String(field.field_value).trim().length > 0;
    const hasSnippet =
      field.source_snippet != null &&
      String(field.source_snippet).trim().length > 0;
    if (field.source === "ai" && hasValue && !hasSnippet) {
      return {
        error:
          "AI-extracted values need a source citation before approval. Edit the field to add the clause text, or reject.",
      };
    }
  }

  const updateData: Record<string, unknown> = {
    status: action,
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString(),
  };

  if (action === "edited" && newValue !== undefined) {
    if (newValue.length > MAX_MANUAL_FIELD_VALUE_LEN) {
      return { error: "Value is too long" };
    }
    updateData.field_value = newValue;
    updateData.source = "human";
  }

  const { error } = await admin
    .from("extracted_fields")
    .update(updateData)
    .eq("id", fieldId);

  if (error) return { error: mapDataSourceError(error.message) };

  await admin.from("audit_events").insert({
    organization_id: contract.organization_id,
    contract_id: contract.id,
    user_id: user.id,
    action: `field.${action}`,
    details: {
      field_name: field.field_name,
      ...(action === "edited" ? { old_value: field.field_value, new_value: newValue } : {}),
    },
  });

  const resolvedValue = action === "edited" ? newValue : field.field_value;
  await autoTransitionTasksForField({
    admin,
    organizationId: contract.organization_id,
    contractId: contract.id,
    actorId: user.id,
    fieldId,
    fieldStatus: action,
    fieldDateValue: resolvedValue,
  });
  await recomputeContractSignals(admin, contract.id);
  if (
    (action === "approved" || action === "edited") &&
    DATE_FIELDS.has(field.field_name) &&
    resolvedValue
  ) {
    await scheduleReminders(
      admin,
      contract.id,
      fieldId,
      field.field_name,
      resolvedValue,
      contract.owner_id
    );
  }

  if (action === "rejected" && DATE_FIELDS.has(field.field_name)) {
    await admin
      .from("reminders")
      .delete()
      .eq("field_id", fieldId);
  }

  return { success: true };
}

export async function updateContractSecondaryOwner(contractId: string, secondaryOwnerId: string | null) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(contractId)) return { error: "Invalid contract" };
  if (secondaryOwnerId && !isUuid(secondaryOwnerId)) return { error: "Invalid secondary owner" };

  const { data: contract } = await admin
    .from("contracts")
    .select("id, organization_id")
    .eq("id", contractId)
    .single();
  if (!contract) return { error: "Contract not found" };

  if (!(await verifyOrgMembership(admin, user.id, contract.organization_id))) {
    return { error: "Access denied" };
  }
  const writeErr = await requireWriteAccess(admin, user.id, contract.organization_id);
  if (writeErr) return writeErr;

  if (
    secondaryOwnerId &&
    !(await verifyOrgMembership(admin, secondaryOwnerId, contract.organization_id))
  ) {
    return { error: "Secondary owner must be a member of this organization." };
  }

  const { error } = await admin
    .from("contracts")
    .update({ secondary_owner_id: secondaryOwnerId })
    .eq("id", contractId);
  if (error) return { error: mapDataSourceError(error.message) };

  await admin.from("audit_events").insert({
    organization_id: contract.organization_id,
    contract_id: contractId,
    user_id: user.id,
    action: "contract.secondary_owner_changed",
    details: { secondary_owner_id: secondaryOwnerId },
  });
  await recomputeContractSignals(admin, contractId);

  return { success: true as const };
}

export async function upsertContractHandoffChecklist(input: {
  contractId: string;
  toOwnerId: string;
  checklistNote: string;
}) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(input.contractId) || !isUuid(input.toOwnerId)) {
    return { error: "Invalid request" };
  }
  const checklistNote = input.checklistNote.trim();
  if (!checklistNote) return { error: "Checklist note is required" };
  if (checklistNote.length > 4000) return { error: "Checklist note is too long" };

  const { data: contract } = await admin
    .from("contracts")
    .select("id, organization_id, owner_id")
    .eq("id", input.contractId)
    .single();
  if (!contract) return { error: "Contract not found" };

  if (!(await verifyOrgMembership(admin, user.id, contract.organization_id))) {
    return { error: "Access denied" };
  }
  const writeErr = await requireWriteAccess(admin, user.id, contract.organization_id);
  if (writeErr) return writeErr;

  const { error } = await admin.from("contract_handoff_checklists").insert({
    contract_id: input.contractId,
    organization_id: contract.organization_id,
    from_owner_id: contract.owner_id,
    to_owner_id: input.toOwnerId,
    checklist_note: checklistNote,
    status: "pending",
    created_by: user.id,
  });
  if (error) return { error: mapDataSourceError(error.message) };

  await admin.from("contract_notes").insert({
    contract_id: input.contractId,
    organization_id: contract.organization_id,
    author_id: user.id,
    note: `[Timeline] Ownership handoff checklist created`,
    pinned: true,
  });

  return { success: true as const };
}

export async function updateContractHandoffChecklistStatus(
  checklistId: string,
  status: "pending" | "completed"
) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isUuid(checklistId)) return { error: "Invalid request" };

  const { data: checklist } = await admin
    .from("contract_handoff_checklists")
    .select("id, contract_id, organization_id")
    .eq("id", checklistId)
    .maybeSingle();
  if (!checklist) return { error: "Checklist not found" };

  if (!(await verifyOrgMembership(admin, user.id, checklist.organization_id))) {
    return { error: "Access denied" };
  }
  const writeErr = await requireWriteAccess(admin, user.id, checklist.organization_id);
  if (writeErr) return writeErr;

  const { error } = await admin
    .from("contract_handoff_checklists")
    .update({
      status,
      completed_at: status === "completed" ? new Date().toISOString() : null,
    })
    .eq("id", checklistId);
  if (error) return { error: mapDataSourceError(error.message) };

  return { success: true as const };
}

export async function updateContractHandoffChecklistStatusForm(
  checklistId: string,
  status: "pending" | "completed"
) {
  const res = await updateContractHandoffChecklistStatus(checklistId, status);
  if (res && "error" in res && res.error) {
    console.error("[contracts] updateContractHandoffChecklistStatusForm", res.error);
  }
}

export async function upsertContractHandoffChecklistForm(formData: FormData) {
  const contractId = String(formData.get("contractId") ?? "").trim();
  const toOwnerId = String(formData.get("toOwnerId") ?? "").trim();
  const checklistNote = String(formData.get("checklistNote") ?? "");
  const res = await upsertContractHandoffChecklist({ contractId, toOwnerId, checklistNote });
  if (res && "error" in res && res.error) {
    console.error("[contracts] upsertContractHandoffChecklistForm", res.error);
  }
}

async function scheduleReminders(
  supabase: Awaited<ReturnType<typeof createAdminClient>>,
  contractId: string,
  fieldId: string,
  fieldName: string,
  dateValue: string,
  ownerId: string | null
) {
  await supabase.from("reminders").delete().eq("field_id", fieldId);

  const targetDate = new Date(dateValue);
  if (isNaN(targetDate.getTime())) return;

  const now = new Date();
  const reminders = REMINDER_OFFSETS_DAYS
    .map((offset) => {
      const reminderDate = new Date(targetDate);
      reminderDate.setDate(reminderDate.getDate() - offset);
      return {
        contract_id: contractId,
        field_id: fieldId,
        reminder_type: `${fieldName}_${offset}d`,
        reminder_date: reminderDate.toISOString().split("T")[0],
        recipient_id: ownerId,
      };
    })
    .filter((r) => new Date(r.reminder_date) > now);

  if (reminders.length > 0) {
    await supabase.from("reminders").insert(reminders);
  }
}

export async function addManualField(
  contractId: string,
  fieldName: string,
  fieldValue: string
) {
  const supabase = await createClient();
  const admin = await createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(contractId)) return { error: "Invalid contract" };
  if (!ALLOWED_MANUAL_FIELD_NAMES.has(fieldName)) {
    return { error: "Invalid field name" };
  }
  if (fieldValue.length > MAX_MANUAL_FIELD_VALUE_LEN) {
    return { error: "Value is too long" };
  }

  const { data: contract } = await admin
    .from("contracts")
    .select("id, organization_id, owner_id")
    .eq("id", contractId)
    .single();

  if (!contract) return { error: "Contract not found" };

  if (!(await verifyOrgMembership(admin, user.id, contract.organization_id))) {
    return { error: "Access denied" };
  }

  const writeErr = await requireWriteAccess(admin, user.id, contract.organization_id);
  if (writeErr) return writeErr;

  const { data: inserted, error } = await admin
    .from("extracted_fields")
    .insert({
      contract_id: contractId,
      field_name: fieldName,
      field_value: fieldValue,
      source: "human",
      status: "approved",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return { error: mapDataSourceError(error.message) };

  await admin.from("audit_events").insert({
    organization_id: contract.organization_id,
    contract_id: contractId,
    user_id: user.id,
    action: "field.added",
    details: { field_name: fieldName, field_value: fieldValue },
  });
  await recomputeContractSignals(admin, contractId);

  if (DATE_FIELDS.has(fieldName) && fieldValue) {
    await scheduleReminders(
      admin,
      contractId,
      inserted.id,
      fieldName,
      fieldValue,
      contract.owner_id
    );
  }

  return { success: true };
}

export async function uploadAdditionalFiles(contractId: string, formData: FormData) {
  const supabase = await createClient();
  const admin = await createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(contractId)) return { error: "Invalid contract" };

  const { data: contract } = await admin
    .from("contracts")
    .select("id, organization_id")
    .eq("id", contractId)
    .single();

  if (!contract) return { error: "Contract not found" };

  if (!(await verifyOrgMembership(admin, user.id, contract.organization_id))) {
    return { error: "Access denied" };
  }

  const writeErr = await requireWriteAccess(admin, user.id, contract.organization_id);
  if (writeErr) return writeErr;

  const files = formData.getAll("files") as File[];
  const results = await Promise.allSettled(
    files
      .filter((f) => f.size > 0)
      .map(async (file) => {
        if (file.size > MAX_FILE_SIZE) {
          throw new Error(`${file.name}: exceeds 20 MB limit`);
        }
        if (!ALLOWED_TYPES.has(file.type)) {
          throw new Error(`${file.name}: unsupported file type`);
        }

        const safeName = sanitizeUploadedFileName(file.name);
        const storagePath = `${contract.organization_id}/${contract.id}/${crypto.randomUUID()}-${safeName}`;

        const { error: uploadError } = await admin.storage
          .from("contracts")
          .upload(storagePath, file);

        if (uploadError) {
          throw new Error(`${file.name}: ${uploadError.message}`);
        }

        await admin.from("contract_files").insert({
          contract_id: contract.id,
          file_name: safeName,
          file_type: file.type,
          file_size: file.size,
          storage_path: storagePath,
          uploaded_by: user.id,
        });
      })
  );

  const uploaded = results.filter((r) => r.status === "fulfilled").length;
  const errors = results
    .filter((r): r is PromiseRejectedResult => r.status === "rejected")
    .map((r) => r.reason?.message ?? "Unknown error");

  if (uploaded > 0) {
    await admin.from("audit_events").insert({
      organization_id: contract.organization_id,
      contract_id: contract.id,
      user_id: user.id,
      action: "files.uploaded",
      details: { count: uploaded },
    });
  }

  if (errors.length > 0) {
    return { error: errors.join("; "), uploaded };
  }

  return { success: true, uploaded };
}

export async function supersedeContractFile(input: {
  contractId: string;
  fileId: string;
  reason?: string | null;
  replacementFileId?: string | null;
}) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(input.contractId) || !isUuid(input.fileId)) return { error: "Invalid request" };
  if (input.replacementFileId && !isUuid(input.replacementFileId)) {
    return { error: "Invalid replacement file" };
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
    .from("contract_files")
    .update({
      superseded_at: new Date().toISOString(),
      superseded_by_id: input.replacementFileId ?? null,
      supersede_reason: input.reason?.trim() || null,
    })
    .eq("id", input.fileId)
    .eq("contract_id", input.contractId);
  if (error) return { error: mapDataSourceError(error.message) };

  await admin.from("audit_events").insert({
    organization_id: contract.organization_id,
    contract_id: input.contractId,
    user_id: user.id,
    action: "contract.file_superseded",
    details: {
      file_id: input.fileId,
      replacement_file_id: input.replacementFileId ?? null,
      reason: input.reason?.trim() || null,
    },
  });
  await recomputeContractSignals(admin, input.contractId);

  await enqueueOutboundEvent({
    organizationId: contract.organization_id,
    eventType: "contract.file_superseded",
    entityType: "contract_file",
    entityId: input.fileId,
    payload: {
      contract_id: input.contractId,
      replacement_file_id: input.replacementFileId ?? null,
    },
  });

  // Trigger re-extraction after superseding to refresh approved fields.
  await triggerExtraction(input.contractId);
  return { success: true as const };
}

export async function supersedeContractFileForm(formData: FormData) {
  const contractId = String(formData.get("contractId") ?? "").trim();
  const fileId = String(formData.get("fileId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const replacementFileId = String(formData.get("replacementFileId") ?? "").trim();
  const res = await supersedeContractFile({
    contractId,
    fileId,
    reason: reason || null,
    replacementFileId: replacementFileId || null,
  });
  if (res && "error" in res && res.error) {
    console.error("[contracts] supersedeContractFileForm", res.error);
  }
}

async function triggerExtraction(contractId: string) {
  const appUrl = await resolveAppBaseUrl();
  const cookieStore = await (await import("next/headers")).cookies();
  const allCookies = cookieStore.getAll();
  const cookieHeader = allCookies.map((c) => `${c.name}=${c.value}`).join("; ");

  let res: Response;
  try {
    res = await fetch(`${appUrl}/api/extract`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({ contractId }),
    });
  } catch (err) {
    console.error("[triggerExtraction] network error:", err);
    return;
  }

  const { data, isJson } = await readApiJson<{ error?: string }>(res);
  if (!isJson) {
    console.error(
      "[triggerExtraction] non-JSON response",
      res.status,
      "— check NEXT_PUBLIC_APP_URL matches this deployment."
    );
    return;
  }
  if (!res.ok) {
    if (res.status === 409) {
      return;
    }
    console.error(
      "[triggerExtraction] failed:",
      res.status,
      data.error ?? "(no error message)"
    );
  }
}

export async function runExtraction(contractId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(contractId)) return { error: "Invalid contract" };

  const admin = await createAdminClient();
  const { data: contract } = await admin
    .from("contracts")
    .select("organization_id")
    .eq("id", contractId)
    .single();

  if (!contract) return { error: "Contract not found" };

  if (!(await verifyOrgMembership(admin, user.id, contract.organization_id))) {
    return { error: "Access denied" };
  }

  const writeErr = await requireWriteAccess(admin, user.id, contract.organization_id);
  if (writeErr) return writeErr;

  const appUrl = await resolveAppBaseUrl();

  const cookieStore = await (await import("next/headers")).cookies();
  const allCookies = cookieStore.getAll();
  const cookieHeader = allCookies.map((c) => `${c.name}=${c.value}`).join("; ");

  let res: Response;
  try {
    res = await fetch(`${appUrl}/api/extract`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({ contractId }),
    });
  } catch {
    return {
      error:
        "Could not reach the extraction service. Check your connection and NEXT_PUBLIC_APP_URL.",
    };
  }

  const { data, isJson, rawPreview } = await readApiJson<{
    error?: string;
    extracted?: number;
    inserted?: number;
    textChars?: number;
    accepted?: boolean;
    async?: boolean;
  }>(res);

  if (!isJson) {
    return {
      error: `Unexpected response from server (${res.status}). If this persists, verify NEXT_PUBLIC_APP_URL points to this app. ${rawPreview.slice(0, 120)}`,
    };
  }

  if (res.status === 202 && data.accepted && data.async) {
    return {
      success: true,
      async: true as const,
      extracted: 0,
      inserted: 0,
    };
  }

  if (!res.ok) {
    // Legacy: duplicate requests used to get 409; API now returns 202 — keep fallback for older deploys.
    if (res.status === 409) {
      return {
        success: true,
        async: true as const,
        extracted: 0,
        inserted: 0,
      };
    }
    return { error: data.error || `Extraction failed (${res.status})` };
  }

  return {
    success: true,
    async: false as const,
    extracted: data.extracted ?? 0,
    inserted: data.inserted ?? 0,
    textChars: data.textChars,
  };
}

export async function batchApproveReadyFields(contractId: string) {
  const supabase = await createClient();
  const admin = await createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(contractId)) return { error: "Invalid contract" };

  const { data: contract } = await admin
    .from("contracts")
    .select("organization_id")
    .eq("id", contractId)
    .single();

  if (!contract) return { error: "Contract not found" };

  if (!(await verifyOrgMembership(admin, user.id, contract.organization_id))) {
    return { error: "Access denied" };
  }

  const writeErr = await requireWriteAccess(admin, user.id, contract.organization_id);
  if (writeErr) return writeErr;

  const { data: pending } = await admin
    .from("extracted_fields")
    .select("id")
    .eq("contract_id", contractId)
    .eq("status", "pending");

  let approved = 0;
  for (const row of pending ?? []) {
    const res = await updateContractField(row.id, "approved");
    if (res && "error" in res && res.error) continue;
    approved++;
  }

  return {
    success: true,
    approved,
    pending_total: pending?.length ?? 0,
  };
}

function titleFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^/.]+$/, "").trim();
  return base || fileName;
}

export async function bulkCreateContractsFromFiles(formData: FormData) {
  const supabase = await createClient();
  const admin = await createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const organizationId = (formData.get("organizationId") as string)?.trim() ?? "";
  if (!organizationId) return { error: "Organization is required" };
  if (!isUuid(organizationId)) return { error: "Invalid organization" };

  if (!(await verifyOrgMembership(admin, user.id, organizationId))) {
    return { error: "Access denied" };
  }

  const writeErr = await requireWriteAccess(admin, user.id, organizationId);
  if (writeErr) return writeErr;

  const files = formData.getAll("files") as File[];
  const validFiles = files.filter((f) => {
    if (!f.size) return false;
    if (f.size > MAX_FILE_SIZE) return false;
    return ALLOWED_TYPES.has(f.type);
  });

  if (validFiles.length === 0) {
    return { error: "Add at least one PDF or DOCX under 20 MB." };
  }

  const { data: job } = await admin
    .from("contract_import_jobs")
    .insert({
      organization_id: organizationId,
      created_by: user.id,
      source: "files",
      status: "processing",
      total_rows: validFiles.length,
    })
    .select("id")
    .single();

  const createdIds: string[] = [];
  const rowErrors: string[] = [];
  const rowResults: Array<{
    row_index: number;
    title: string;
    owner_email: string | null;
    status: "valid" | "inserted" | "error";
    error_message: string | null;
    contract_id: string | null;
  }> = [];

  for (let i = 0; i < validFiles.length; i++) {
    const file = validFiles[i];
    const safeName = sanitizeUploadedFileName(file.name);
    const title = titleFromFileName(safeName).slice(0, MAX_CONTRACT_TITLE);
    const { data: contract, error: insertErr } = await admin
      .from("contracts")
      .insert({
        title,
        counterparty: null,
        contract_type: null,
        organization_id: organizationId,
        owner_id: user.id,
        created_by: user.id,
        status: "pending_review",
      })
      .select("id")
      .single();

    if (insertErr || !contract) {
      rowErrors.push(`${safeName}: ${insertErr?.message ?? "insert failed"}`);
      rowResults.push({
        row_index: i + 1,
        title: safeName,
        owner_email: null,
        status: "error",
        error_message: insertErr?.message ?? "insert failed",
        contract_id: null,
      });
      continue;
    }

    const storagePath = `${organizationId}/${contract.id}/${crypto.randomUUID()}-${safeName}`;

    const { error: uploadError } = await admin.storage
      .from("contracts")
      .upload(storagePath, file);

    if (uploadError) {
      await admin.from("contracts").delete().eq("id", contract.id);
      rowErrors.push(`${safeName}: ${uploadError.message}`);
      rowResults.push({
        row_index: i + 1,
        title: safeName,
        owner_email: null,
        status: "error",
        error_message: uploadError.message,
        contract_id: null,
      });
      continue;
    }

    await admin.from("contract_files").insert({
      contract_id: contract.id,
      file_name: safeName,
      file_type: file.type,
      file_size: file.size,
      storage_path: storagePath,
      uploaded_by: user.id,
    });

    await admin.from("audit_events").insert({
      organization_id: organizationId,
      contract_id: contract.id,
      user_id: user.id,
      action: "contract.created",
      details: { title, bulk: true },
    });

    createdIds.push(contract.id);
    rowResults.push({
      row_index: i + 1,
      title: safeName,
      owner_email: null,
      status: "inserted",
      error_message: null,
      contract_id: contract.id,
    });

    if (
      process.env.OPENAI_API_KEY &&
      !process.env.OPENAI_API_KEY.includes("placeholder")
    ) {
      triggerExtraction(contract.id).catch(console.error);
    }
  }

  if (job) {
    if (rowResults.length > 0) {
      await admin.from("contract_import_job_rows").insert(
        rowResults.map((row) => ({
          job_id: job.id,
          organization_id: organizationId,
          ...row,
        }))
      );
    }
    await admin
      .from("contract_import_jobs")
      .update({
        status: rowErrors.length === validFiles.length ? "failed" : "completed",
        valid_rows: validFiles.length - rowErrors.length,
        inserted_rows: createdIds.length,
        error_rows: rowErrors.length,
      })
      .eq("id", job.id);
  }

  return {
    success: createdIds.length > 0,
    created: createdIds.length,
    contract_ids: createdIds,
    job_id: job?.id ?? null,
    errors: rowErrors.length ? rowErrors : undefined,
  };
}

export async function updateContractOwner(contractId: string, newOwnerId: string) {
  const supabase = await createClient();
  const admin = await createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(contractId) || !isUuid(newOwnerId)) {
    return { error: "Invalid request" };
  }

  const { data: contract } = await admin
    .from("contracts")
    .select("id, organization_id, owner_id")
    .eq("id", contractId)
    .single();

  if (!contract) return { error: "Contract not found" };

  if (!(await verifyOrgMembership(admin, user.id, contract.organization_id))) {
    return { error: "Access denied" };
  }

  const writeErr = await requireWriteAccess(admin, user.id, contract.organization_id);
  if (writeErr) return writeErr;

  if (!(await verifyOrgMembership(admin, newOwnerId, contract.organization_id))) {
    return { error: "New owner must be a member of this organization." };
  }

  const { error } = await admin
    .from("contracts")
    .update({ owner_id: newOwnerId, owner_assigned_at: new Date().toISOString() })
    .eq("id", contractId);

  if (error) return { error: mapDataSourceError(error.message) };

  await admin
    .from("reminders")
    .update({ recipient_id: newOwnerId })
    .eq("contract_id", contractId)
    .is("sent_at", null);

  const { data: reassignedTasks } = await admin
    .from("contract_tasks")
    .select("id")
    .eq("contract_id", contractId)
    .in("status", ["open", "in_progress", "blocked"]);

  await admin
    .from("contract_tasks")
    .update({ assignee_id: newOwnerId })
    .eq("contract_id", contractId)
    .in("status", ["open", "in_progress", "blocked"]);

  if ((reassignedTasks?.length ?? 0) > 0) {
    await admin.from("contract_task_events").insert(
      reassignedTasks!.map((task) => ({
        organization_id: contract.organization_id,
        contract_id: contractId,
        task_id: task.id,
        actor_id: user.id,
        event_type: "reassigned",
        details: { assignee_id: newOwnerId, reason: "contract_owner_changed" },
      }))
    );
  }

  await admin
    .from("contract_approvals")
    .update({ approver_id: newOwnerId })
    .eq("contract_id", contractId)
    .eq("status", "pending");

  if (contract.owner_id && contract.owner_id !== newOwnerId) {
    const { data: oldWatch } = await admin
      .from("contract_watchlists")
      .select("team_key, note")
      .eq("contract_id", contractId)
      .eq("user_id", contract.owner_id)
      .maybeSingle();
    if (oldWatch) {
      await admin.from("contract_watchlists").upsert(
        {
          contract_id: contractId,
          organization_id: contract.organization_id,
          user_id: newOwnerId,
          team_key: oldWatch.team_key ?? "ops",
          note: oldWatch.note ?? "Auto-transferred due to ownership change",
        },
        { onConflict: "contract_id,user_id", ignoreDuplicates: false }
      );
      await admin
        .from("contract_watchlists")
        .delete()
        .eq("contract_id", contractId)
        .eq("user_id", contract.owner_id);
    }
  }

  await admin.from("audit_events").insert({
    organization_id: contract.organization_id,
    contract_id: contractId,
    user_id: user.id,
    action: "contract.owner_changed",
    details: { new_owner_id: newOwnerId },
  });

  await enqueueOutboundEvent({
    organizationId: contract.organization_id,
    eventType: "contract.owner_changed",
    entityType: "contract",
    entityId: contractId,
    payload: { new_owner_id: newOwnerId },
  });

  return { success: true };
}

export async function getFileDownloadUrl(storagePath: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isContractStoragePathSafe(storagePath)) {
    return { error: "Invalid file path" };
  }

  const admin = await createAdminClient();

  const { data: file } = await admin
    .from("contract_files")
    .select("contract_id, contracts!inner(organization_id)")
    .eq("storage_path", storagePath)
    .single();

  if (!file) return { error: "File not found" };

  const orgId = (file.contracts as unknown as { organization_id: string }).organization_id;

  if (!(await verifyOrgMembership(admin, user.id, orgId))) {
    return { error: "Access denied" };
  }

  const { data, error } = await admin.storage
    .from("contracts")
    .createSignedUrl(storagePath, 60 * 60);

  if (error) return { error: mapDataSourceError(error.message) };
  return { url: data.signedUrl };
}

export async function updateContractStatus(
  contractId: string,
  newStatus: string
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

export async function updateContractOperationalStateForm(formData: FormData) {
  const contractId = String(formData.get("contractId") ?? "").trim();
  const intakeStatus = String(formData.get("intakeStatus") ?? "").trim();
  const healthStatus = String(formData.get("healthStatus") ?? "").trim();
  const requiredNextStep = String(formData.get("requiredNextStep") ?? "").trim();
  const res = await updateContractOperationalState({
    contractId,
    intakeStatus: intakeStatus as
      | "awaiting_review"
      | "in_clarification"
      | "active"
      | "at_risk"
      | "renewal_prep"
      | "notice_decision"
      | "archived",
    healthStatus: healthStatus as "healthy" | "watch" | "at_risk" | "unknown",
    requiredNextStep: requiredNextStep || null,
    intakeOwnerId: String(formData.get("intakeOwnerId") ?? "").trim() || null,
    intakeSource: String(formData.get("intakeSource") ?? "").trim() || null,
    intakeCompletenessScore: (() => {
      const raw = String(formData.get("intakeCompletenessScore") ?? "").trim();
      if (!raw) return null;
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : null;
    })(),
  });
  if (res && "error" in res && res.error) {
    console.error("[contracts] updateContractOperationalStateForm", res.error);
  }
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

  const { data: membership } = await admin
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
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

export async function upsertContractIntakeRequestForm(formData: FormData) {
  const res = await upsertContractIntakeRequest({
    contractId: String(formData.get("contractId") ?? "").trim() || null,
    source: String(formData.get("source") ?? "").trim() || null,
    sourceLabel: String(formData.get("sourceLabel") ?? "").trim() || null,
    status:
      (String(formData.get("status") ?? "").trim() as
        | "new"
        | "triage"
        | "review"
        | "ready"
        | "rejected") || "new",
    assignedTo: String(formData.get("assignedTo") ?? "").trim() || null,
    completenessScore: (() => {
      const raw = String(formData.get("completenessScore") ?? "").trim();
      if (!raw) return null;
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : null;
    })(),
    rejectionReason: String(formData.get("rejectionReason") ?? "").trim() || null,
  });
  if (res && "error" in res && res.error) {
    console.error("[contracts] upsertContractIntakeRequestForm", res.error);
  }
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

export async function updateContractExternalLinkForm(formData: FormData) {
  const contractId = String(formData.get("contractId") ?? "").trim();
  const sourceSystem = String(formData.get("sourceSystem") ?? "").trim();
  const region = String(formData.get("region") ?? "").trim();
  const annualValue = String(formData.get("annualValue") ?? "").trim();
  const externalReferenceId = String(formData.get("externalReferenceId") ?? "").trim();
  const res = await updateContractExternalLink({
    contractId,
    sourceSystem: sourceSystem || null,
    region: region || null,
    annualValue: annualValue || null,
    externalReferenceId: externalReferenceId || null,
  });
  if (res && "error" in res && res.error) {
    console.error("[contracts] updateContractExternalLinkForm", res.error);
  }
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

export async function applyContractTemplatePackForm(formData: FormData) {
  const contractId = String(formData.get("contractId") ?? "").trim();
  const res = await applyContractTemplatePack(contractId);
  if (res && "error" in res && res.error) {
    console.error("[contracts] applyContractTemplatePackForm", res.error);
  }
}
