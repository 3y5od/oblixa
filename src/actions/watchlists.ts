"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { canEditContracts, getOrgMemberRole } from "@/lib/permissions";
import { isUuid } from "@/lib/security/validation";

export async function upsertWatchlistEntryForm(formData: FormData) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const contractId = String(formData.get("contractId") ?? "").trim();
  const teamKey = String(formData.get("teamKey") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!isUuid(contractId)) return;

  const { data: contract } = await admin
    .from("contracts")
    .select("id, organization_id")
    .eq("id", contractId)
    .maybeSingle();
  if (!contract) return;
  const role = await getOrgMemberRole(admin, user.id, contract.organization_id);
  if (!role || !canEditContracts(role)) return;

  await admin.from("contract_watchlists").upsert(
    {
      contract_id: contractId,
      organization_id: contract.organization_id,
      user_id: user.id,
      team_key: teamKey,
      note,
    },
    { onConflict: "contract_id,user_id", ignoreDuplicates: false }
  );
}

export async function removeWatchlistEntry(contractId: string) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isUuid(contractId)) return;
  await admin
    .from("contract_watchlists")
    .delete()
    .eq("contract_id", contractId)
    .eq("user_id", user.id);
}
