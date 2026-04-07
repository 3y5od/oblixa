"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { canEditContracts, getOrgMemberRole } from "@/lib/permissions";
import { isUuid } from "@/lib/security/validation";
import { mapDataSourceError } from "@/lib/errors/user-facing";

export async function archiveContractAsDuplicateForm(formData: FormData) {
  const contractId = String(formData.get("contractId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "duplicate candidate").trim();
  if (!isUuid(contractId)) return;

  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: contract } = await admin
    .from("contracts")
    .select("id, organization_id")
    .eq("id", contractId)
    .maybeSingle();
  if (!contract) return;
  const role = await getOrgMemberRole(admin, user.id, contract.organization_id);
  if (!canEditContracts(role)) return;

  await admin
    .from("contracts")
    .update({
      status: "terminated",
      intake_status: "archived",
      required_next_step: null,
    })
    .eq("id", contractId);

  await admin.from("audit_events").insert({
    organization_id: contract.organization_id,
    contract_id: contractId,
    user_id: user.id,
    action: "maintenance.archived_duplicate",
    details: { reason },
  });
}

export async function reassignOwnerForm(formData: FormData) {
  const contractId = String(formData.get("contractId") ?? "").trim();
  const ownerId = String(formData.get("ownerId") ?? "").trim();
  if (!isUuid(contractId) || !isUuid(ownerId)) return;
  const { updateContractOwner } = await import("@/actions/contracts");
  const res = await updateContractOwner(contractId, ownerId);
  if (res && "error" in res && res.error) {
    console.error("[maintenance] reassignOwnerForm", res.error);
  }
}

export async function deleteOrphanFileRecordForm(formData: FormData) {
  const fileId = String(formData.get("fileId") ?? "").trim();
  if (!isUuid(fileId)) return;
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: member } = await admin
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!member || !canEditContracts(member.role as "admin" | "editor" | "viewer")) return;

  const { data: file } = await admin
    .from("contract_files")
    .select("id, contract_id, contracts(id, organization_id)")
    .eq("id", fileId)
    .maybeSingle();
  if (!file) return;
  const rel = file.contracts as unknown;
  const contract = (Array.isArray(rel) ? rel[0] : rel) as
    | { id?: string; organization_id?: string }
    | null;
  if (contract?.id && contract.organization_id === member.organization_id) return;

  const { error } = await admin.from("contract_files").delete().eq("id", fileId);
  if (error) {
    console.error("[maintenance] deleteOrphanFileRecordForm", mapDataSourceError(error.message));
  }
}
