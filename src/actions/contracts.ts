"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  // Handle file uploads
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

  // Log audit event
  await supabase.from("audit_events").insert({
    organization_id: organizationId,
    contract_id: contract.id,
    user_id: user.id,
    action: "contract.created",
    details: { title },
  });

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

  return { success: true };
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

  const { error } = await supabase.from("extracted_fields").insert({
    contract_id: contractId,
    field_name: fieldName,
    field_value: fieldValue,
    source: "human",
    status: "approved",
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString(),
  });

  if (error) return { error: error.message };

  return { success: true };
}

export async function deleteContract(contractId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("contracts")
    .delete()
    .eq("id", contractId);

  if (error) return { error: error.message };

  redirect("/contracts");
}
