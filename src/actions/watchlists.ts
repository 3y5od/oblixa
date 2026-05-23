"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { canEditContracts } from "@/lib/permissions";
import { getContractAccessContext } from "@/lib/actions/access";
import { isUuid, validateBoundedString } from "@/lib/security/validation";

const MAX_WATCHLIST_TEAM_KEY_LEN = 80;
const MAX_WATCHLIST_NOTE_LEN = 1000;

export async function upsertWatchlistEntryForm(formData: FormData) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const contractId = String(formData.get("contractId") ?? "").trim();
  if (!isUuid(contractId)) return;
  const teamKeyValidation = validateBoundedString(formData.get("teamKey") ?? "", {
    maxLength: MAX_WATCHLIST_TEAM_KEY_LEN,
    allowEmpty: true,
  });
  const noteValidation = validateBoundedString(formData.get("note") ?? "", {
    maxLength: MAX_WATCHLIST_NOTE_LEN,
    allowEmpty: true,
    allowTextWhitespaceControls: true,
  });
  if (!teamKeyValidation.ok || !noteValidation.ok) return;
  const teamKey = teamKeyValidation.value || null;
  const note = noteValidation.value || null;

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
