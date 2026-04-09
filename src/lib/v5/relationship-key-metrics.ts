import type { SupabaseClient } from "@supabase/supabase-js";

type Admin = SupabaseClient;

const MAX_CONTRACTS = 200;

/** Grounded counts for relationship keys (account_key or counterparty_key), capped for safety. */
export type RelationshipKeyMetrics = {
  contract_sample_size: number;
  pending_approvals: number;
  open_tasks: number;
  unsatisfied_evidence: number;
  open_attestations: number;
  active_campaign_contract_links: number;
  active_program_assignments: number;
  open_exceptions: number;
  open_obligations: number;
  renewal_checkpoints_open: number;
  computed_at: string;
};

export async function buildRelationshipKeyMetrics(
  admin: Admin,
  organizationId: string,
  contractIds: string[]
): Promise<RelationshipKeyMetrics> {
  const ids = contractIds.filter(Boolean).slice(0, MAX_CONTRACTS);
  const now = new Date().toISOString();
  const base: RelationshipKeyMetrics = {
    contract_sample_size: ids.length,
    pending_approvals: 0,
    open_tasks: 0,
    unsatisfied_evidence: 0,
    open_attestations: 0,
    active_campaign_contract_links: 0,
    active_program_assignments: 0,
    open_exceptions: 0,
    open_obligations: 0,
    renewal_checkpoints_open: 0,
    computed_at: now,
  };
  if (ids.length === 0) return base;

  const [
    { count: pendingApprovals },
    { count: openTasks },
    { count: unsatisfiedEvidence },
    { count: openAttestations },
    { count: openExceptions },
    { count: openObligations },
    { count: activePrograms },
    { data: activeCampaigns },
    { count: renewalOpen },
  ] = await Promise.all([
    admin
      .from("contract_approvals")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("contract_id", ids)
      .eq("status", "pending"),
    admin
      .from("contract_tasks")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("contract_id", ids)
      .in("status", ["open", "in_progress", "blocked"]),
    admin
      .from("evidence_requirements")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("contract_id", ids)
      .eq("status", "required"),
    admin
      .from("attestation_requests")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("contract_id", ids)
      .in("status", ["open", "overdue"]),
    admin
      .from("exceptions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("contract_id", ids)
      .in("status", ["open", "in_progress"]),
    admin
      .from("contract_obligations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("contract_id", ids)
      .in("status", ["open", "in_progress"]),
    admin
      .from("contract_program_assignments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("contract_id", ids)
      .eq("status", "active"),
    admin
      .from("portfolio_campaigns")
      .select("id")
      .eq("organization_id", organizationId)
      .in("status", ["active", "paused"])
      .limit(500),
    admin
      .from("contract_renewal_checkpoints")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("contract_id", ids)
      .eq("status", "pending"),
  ]);

  const campaignIds = (activeCampaigns ?? []).map((r) => String(r.id));
  let campaignLinks = 0;
  if (campaignIds.length > 0) {
    const { count } = await admin
      .from("portfolio_campaign_contracts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("contract_id", ids)
      .in("campaign_id", campaignIds);
    campaignLinks = count ?? 0;
  }

  return {
    contract_sample_size: ids.length,
    pending_approvals: pendingApprovals ?? 0,
    open_tasks: openTasks ?? 0,
    unsatisfied_evidence: unsatisfiedEvidence ?? 0,
    open_attestations: openAttestations ?? 0,
    active_campaign_contract_links: campaignLinks,
    active_program_assignments: activePrograms ?? 0,
    open_exceptions: openExceptions ?? 0,
    open_obligations: openObligations ?? 0,
    renewal_checkpoints_open: renewalOpen ?? 0,
    computed_at: now,
  };
}
