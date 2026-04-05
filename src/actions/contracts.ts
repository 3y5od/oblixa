"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const DATE_FIELDS = new Set([
  "end_date",
  "renewal_date",
  "notice_window",
  "effective_date",
  "start_date",
]);

const REMINDER_OFFSETS_DAYS = [30, 14, 7, 1];

export async function createContract(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const title = formData.get("title") as string;
  const counterparty = formData.get("counterparty") as string | null;
  const contractType = formData.get("contractType") as string | null;
  const organizationId = formData.get("organizationId") as string;

  const { data: contract, error } = await supabase
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

  if (error) return { error: error.message };

  const files = formData.getAll("files") as File[];
  for (const file of files) {
    if (!file.size) continue;

    const storagePath = `${organizationId}/${contract.id}/${crypto.randomUUID()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("contracts")
      .upload(storagePath, file);

    if (uploadError) {
      console.error("Upload error:", uploadError.message);
      continue;
    }

    await supabase.from("contract_files").insert({
      contract_id: contract.id,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      storage_path: storagePath,
      uploaded_by: user.id,
    });
  }

  await supabase.from("audit_events").insert({
    organization_id: organizationId,
    contract_id: contract.id,
    user_id: user.id,
    action: "contract.created",
    details: { title },
  });

  const hasFiles = files.some((f) => f.size > 0);
  if (hasFiles && process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes("placeholder")) {
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: field } = await supabase
    .from("extracted_fields")
    .select("*, contracts!inner(id, organization_id, owner_id)")
    .eq("id", fieldId)
    .single();

  if (!field) return { error: "Field not found" };

  const updateData: Record<string, unknown> = {
    status: action,
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString(),
  };

  if (action === "edited" && newValue !== undefined) {
    updateData.field_value = newValue;
    updateData.source = "human";
  }

  const { error } = await supabase
    .from("extracted_fields")
    .update(updateData)
    .eq("id", fieldId);

  if (error) return { error: error.message };

  const contract = field.contracts as { id: string; organization_id: string; owner_id: string | null };

  await supabase.from("audit_events").insert({
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
      supabase,
      contract.id,
      fieldId,
      field.field_name,
      resolvedValue,
      contract.owner_id
    );
  }

  if (action === "rejected" && DATE_FIELDS.has(field.field_name)) {
    await supabase
      .from("reminders")
      .delete()
      .eq("field_id", fieldId);
  }

  return { success: true };
}

async function scheduleReminders(
  supabase: Awaited<ReturnType<typeof createClient>>,
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: contract } = await supabase
    .from("contracts")
    .select("id, organization_id, owner_id")
    .eq("id", contractId)
    .single();

  if (!contract) return { error: "Contract not found" };

  const { data: inserted, error } = await supabase
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

  if (error) return { error: error.message };

  await supabase.from("audit_events").insert({
    organization_id: contract.organization_id,
    contract_id: contractId,
    user_id: user.id,
    action: "field.added",
    details: { field_name: fieldName, field_value: fieldValue },
  });

  if (DATE_FIELDS.has(fieldName) && fieldValue) {
    await scheduleReminders(
      supabase,
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: contract } = await supabase
    .from("contracts")
    .select("id, organization_id")
    .eq("id", contractId)
    .single();

  if (!contract) return { error: "Contract not found" };

  const files = formData.getAll("files") as File[];
  let uploaded = 0;
  const errors: string[] = [];

  for (const file of files) {
    if (!file.size) continue;

    const storagePath = `${contract.organization_id}/${contract.id}/${crypto.randomUUID()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("contracts")
      .upload(storagePath, file);

    if (uploadError) {
      errors.push(`${file.name}: ${uploadError.message}`);
      continue;
    }

    await supabase.from("contract_files").insert({
      contract_id: contract.id,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      storage_path: storagePath,
      uploaded_by: user.id,
    });

    uploaded++;
  }

  if (uploaded > 0) {
    await supabase.from("audit_events").insert({
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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const cookieStore = await (await import("next/headers")).cookies();
  const allCookies = cookieStore.getAll();
  const cookieHeader = allCookies.map((c) => `${c.name}=${c.value}`).join("; ");

  await fetch(`${appUrl}/api/extract`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
    },
    body: JSON.stringify({ contractId }),
  });
}

export async function runExtraction(contractId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const cookieStore = await (await import("next/headers")).cookies();
  const allCookies = cookieStore.getAll();
  const cookieHeader = allCookies.map((c) => `${c.name}=${c.value}`).join("; ");

  const res = await fetch(`${appUrl}/api/extract`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
    },
    body: JSON.stringify({ contractId }),
  });

  const data = await res.json();
  if (!res.ok) return { error: data.error || "Extraction failed" };
  return { success: true, extracted: data.extracted };
}

export async function getFileDownloadUrl(storagePath: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase.storage
    .from("contracts")
    .createSignedUrl(storagePath, 60 * 60);

  if (error) return { error: error.message };
  return { url: data.signedUrl };
}

export async function updateContractStatus(
  contractId: string,
  newStatus: string
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const validStatuses = ["draft", "pending_review", "active", "expired", "terminated"];
  if (!validStatuses.includes(newStatus)) {
    return { error: "Invalid status" };
  }

  const { data: contract } = await supabase
    .from("contracts")
    .select("organization_id, title, status")
    .eq("id", contractId)
    .single();

  if (!contract) return { error: "Contract not found" };

  const { error } = await supabase
    .from("contracts")
    .update({ status: newStatus })
    .eq("id", contractId);

  if (error) return { error: error.message };

  await supabase.from("audit_events").insert({
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: contract } = await supabase
    .from("contracts")
    .select("organization_id, title")
    .eq("id", contractId)
    .single();

  if (contract) {
    await supabase.from("audit_events").insert({
      organization_id: contract.organization_id,
      contract_id: contractId,
      user_id: user.id,
      action: "contract.deleted",
      details: { title: contract.title },
    });
  }

  const { error } = await supabase
    .from("contracts")
    .delete()
    .eq("id", contractId);

  if (error) return { error: error.message };

  redirect("/contracts");
}
