"use server";

import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { FIELD_NAMES, type ContractStatus } from "@/lib/types";
import { isPlanEnforcementEnabled, orgHasActivePlan } from "@/lib/plan";
import { resolveAppBaseUrl } from "@/lib/app-url";
import { mapDataSourceError } from "@/lib/errors/user-facing";
import { readApiJson } from "@/lib/parse-api-response";
import { canEditContracts, getOrgMemberRole } from "@/lib/permissions";
import { isContractStoragePathSafe, isUuid } from "@/lib/security/validation";
import { sanitizeUploadedFileName } from "@/lib/security/upload-filename";

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
      created_by: user.id,
      status: "pending_review",
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
    if (res.status === 409) {
      return {
        error:
          data.error ||
          "An extraction is already running. Wait for it to finish or refresh the page.",
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

  const createdIds: string[] = [];
  const rowErrors: string[] = [];

  for (const file of validFiles) {
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
      continue;
    }

    const storagePath = `${organizationId}/${contract.id}/${crypto.randomUUID()}-${safeName}`;

    const { error: uploadError } = await admin.storage
      .from("contracts")
      .upload(storagePath, file);

    if (uploadError) {
      await admin.from("contracts").delete().eq("id", contract.id);
      rowErrors.push(`${safeName}: ${uploadError.message}`);
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

    if (
      process.env.OPENAI_API_KEY &&
      !process.env.OPENAI_API_KEY.includes("placeholder")
    ) {
      triggerExtraction(contract.id).catch(console.error);
    }
  }

  return {
    success: createdIds.length > 0,
    created: createdIds.length,
    contract_ids: createdIds,
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
    .select("id, organization_id")
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
    .update({ owner_id: newOwnerId })
    .eq("id", contractId);

  if (error) return { error: mapDataSourceError(error.message) };

  await admin
    .from("reminders")
    .update({ recipient_id: newOwnerId })
    .eq("contract_id", contractId)
    .is("sent_at", null);

  await admin.from("audit_events").insert({
    organization_id: contract.organization_id,
    contract_id: contractId,
    user_id: user.id,
    action: "contract.owner_changed",
    details: { new_owner_id: newOwnerId },
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
    .select("organization_id, title, status")
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

  const { error } = await admin
    .from("contracts")
    .update({ status: newStatus })
    .eq("id", contractId);

  if (error) return { error: mapDataSourceError(error.message) };

  await admin.from("audit_events").insert({
    organization_id: contract.organization_id,
    contract_id: contractId,
    user_id: user.id,
    action: "contract.status_changed",
    details: { old_status: contract.status, new_status: newStatus },
  });

  return { success: true };
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
