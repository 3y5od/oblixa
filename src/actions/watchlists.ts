"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { canEditContracts } from "@/lib/permissions";
import { getContractAccessContext } from "@/lib/actions/access";
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

  const access = await getContractAccessContext(admin, user.id, contractId);
  if (!access.ok || !canEditContracts(access.ctx.role)) return;

  await admin.from("contract_watchlists").upsert(
    {
      contract_id: contractId,
      organization_id: access.ctx.orgId,
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

  const access = await getContractAccessContext(admin, user.id, contractId);
  if (!access.ok) return;

  await admin
    .from("contract_watchlists")
    .delete()
    .eq("contract_id", contractId)
    .eq("user_id", user.id);
}
