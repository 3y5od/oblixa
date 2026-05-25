import type { createAdminClient } from "@/lib/supabase/server";
import type { CampaignAssignment } from "@/lib/decision-intelligence/campaign-assignment";
import { computeRowAssignedTeamPatch } from "@/lib/decision-intelligence/campaign-assignment";

type Admin = Awaited<ReturnType<typeof createAdminClient>>;

const CAMPAIGN_TASK_MARKER = (campaignId: string) =>
  `[oblixa:v5:campaign_task campaign=${campaignId}]`;

export { CAMPAIGN_TASK_MARKER };

/**
 * Resolve contracts from eligibility_json (org-scoped).
 * Supported keys: status, accountKey, counterpartyKey, programId (active assignment), ownerId,
 * segmentSource (informational for sync — use account_key | counterparty_key when backfilling segments).
 */
export async function contractIdsMatchingEligibility(
  admin: Admin,
  organizationId: string,
  eligibility: Record<string, unknown>
): Promise<string[]> {
  const hasProgram =
    typeof eligibility.programId === "string" && Boolean(eligibility.programId);
  const hasOwner = typeof eligibility.ownerId === "string" && Boolean(eligibility.ownerId);
  const hasStatus = typeof eligibility.status === "string" && Boolean(eligibility.status);
  const hasAccount =
    typeof eligibility.accountKey === "string" && Boolean(eligibility.accountKey);
  const hasCp =
    typeof eligibility.counterpartyKey === "string" && Boolean(eligibility.counterpartyKey);

  if (!hasProgram && !hasOwner && !hasStatus && !hasAccount && !hasCp) return [];

  let programContractIds: string[] | null = null;
  if (hasProgram) {
    const pid = String(eligibility.programId);
    const { data: assigns, error } = await admin
      .from("contract_program_assignments")
      .select("contract_id")
      .eq("organization_id", organizationId)
      .eq("program_id", pid)
      .eq("status", "active");
    if (error) return [];
    programContractIds = [...new Set((assigns ?? []).map((r) => String(r.contract_id)))];
    if (programContractIds.length === 0) return [];
  }

  let q = admin.from("contracts").select("id").eq("organization_id", organizationId);
  if (programContractIds) q = q.in("id", programContractIds);
  if (hasOwner) q = q.eq("owner_id", String(eligibility.ownerId));
  if (hasStatus) q = q.eq("status", String(eligibility.status));
  if (hasAccount) q = q.eq("account_key", String(eligibility.accountKey));
  if (hasCp) q = q.eq("counterparty_key", String(eligibility.counterpartyKey));

  const { data, error } = await q.limit(2000);
  if (error) return [];
  return (data ?? []).map((r) => String(r.id));
}

/** Count contracts that match eligibility without mutating campaign rows (for preview summaries). */
export async function countContractsMatchingEligibility(
  admin: Admin,
  organizationId: string,
  eligibility: Record<string, unknown>
): Promise<number> {
  const ids = await contractIdsMatchingEligibility(admin, organizationId, eligibility);
  return ids.length;
}

/** Backfill portfolio_campaign_contracts.segment_key from contract account/counterparty keys. */
export async function backfillCampaignContractSegments(
  admin: Admin,
  organizationId: string,
  campaignId: string,
  eligibility: Record<string, unknown>
): Promise<void> {
  const src =
    typeof eligibility.segmentSource === "string" ? eligibility.segmentSource : "account_key";
  if (src !== "account_key" && src !== "counterparty_key") return;

  const { data: rows, error: rowsErr } = await admin
    .from("portfolio_campaign_contracts")
    .select("id, contract_id, segment_key")
    .eq("organization_id", organizationId)
    .eq("campaign_id", campaignId);
  if (rowsErr) {
    console.error("[campaign-eligibility] backfill segment rows query failed:", rowsErr.message);
    return;
  }
  if (!rows?.length) return;

  const contractIds = [...new Set(rows.map((r) => String(r.contract_id)))];
  const { data: contracts, error: contractsErr } = await admin
    .from("contracts")
    .select("id, account_key, counterparty_key")
    .eq("organization_id", organizationId)
    .in("id", contractIds);
  if (contractsErr) console.error("[campaign-eligibility] backfill contracts query failed:", contractsErr.message);
  const byId = new Map((contracts ?? []).map((c) => [String(c.id), c]));

  for (const row of rows) {
    if (row.segment_key) continue;
    const c = byId.get(String(row.contract_id));
    const seg =
      src === "counterparty_key"
        ? c?.counterparty_key ?? null
        : c?.account_key ?? null;
    if (!seg) continue;
    await admin
      .from("portfolio_campaign_contracts")
      .update({ segment_key: seg, updated_at: new Date().toISOString() })
      .eq("organization_id", organizationId)
      .eq("id", row.id);
  }
}

/** Insert missing portfolio_campaign_contracts rows for resolved eligibility. */
export async function syncCampaignContractsFromEligibility(
  admin: Admin,
  organizationId: string,
  campaignId: string,
  eligibility: Record<string, unknown>,
  assignment?: CampaignAssignment
): Promise<{ inserted: number }> {
  const ids = await contractIdsMatchingEligibility(admin, organizationId, eligibility);
  if (ids.length === 0) return { inserted: 0 };

  const { data: existing, error: existingErr } = await admin
    .from("portfolio_campaign_contracts")
    .select("contract_id")
    .eq("organization_id", organizationId)
    .eq("campaign_id", campaignId);
  if (existingErr) console.error("[campaign-eligibility] sync existing query failed:", existingErr.message);

  const have = new Set((existing ?? []).map((r) => String(r.contract_id)));
  const missing = ids.filter((cid) => !have.has(cid));
  if (missing.length === 0) {
    await backfillCampaignContractSegments(admin, organizationId, campaignId, eligibility);
    if (assignment) {
      await applyAssignmentDefaultsToPendingRows(admin, organizationId, campaignId, assignment);
    }
    return { inserted: 0 };
  }

  await admin.from("portfolio_campaign_contracts").insert(
    missing.map((contractId) => ({
      organization_id: organizationId,
      campaign_id: campaignId,
      contract_id: contractId,
      status: "pending",
    }))
  );

  await backfillCampaignContractSegments(admin, organizationId, campaignId, eligibility);
  if (assignment) {
    await applyAssignmentDefaultsToPendingRows(admin, organizationId, campaignId, assignment);
  }

  return { inserted: missing.length };
}

/** Fill empty assigned_team on pending rows from assignment_json defaults / bySegment. */
export async function applyAssignmentDefaultsToPendingRows(
  admin: Admin,
  organizationId: string,
  campaignId: string,
  assignment: CampaignAssignment
): Promise<{ updated: number }> {
  const { data: rows, error: rowsErr } = await admin
    .from("portfolio_campaign_contracts")
    .select("id, segment_key, assigned_team")
    .eq("organization_id", organizationId)
    .eq("campaign_id", campaignId)
    .eq("status", "pending");
  if (rowsErr) console.error("[campaign-eligibility] assignment rows query failed:", rowsErr.message);

  let updated = 0;
  for (const row of rows ?? []) {
    const team = computeRowAssignedTeamPatch(row, assignment);
    if (!team) continue;
    await admin
      .from("portfolio_campaign_contracts")
      .update({ assigned_team: team, updated_at: new Date().toISOString() })
      .eq("organization_id", organizationId)
      .eq("id", row.id);
    updated += 1;
  }
  return { updated };
}
