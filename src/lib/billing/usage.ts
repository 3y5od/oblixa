import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * SPEC: docs/billing-page-maximal-pass.md §4.15 — usage-vs-limit
 * metric cells. Returns active contract count + team member count
 * for the org's "X of Y" stat rendering.
 *
 * Best-effort: returns `null` on failure rather than throwing so the
 * billing page can fall back to the limit-only display.
 */
export type BillingUsage = {
  contracts: number;
  teamMembers: number;
};

export async function getBillingUsage(
  admin: SupabaseClient,
  organizationId: string
): Promise<BillingUsage | null> {
  try {
    const [contractsResult, membersResult] = await Promise.allSettled([
      admin
        .from("contracts")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .is("deleted_at", null),
      admin
        .from("organization_members")
        .select("user_id", { count: "exact", head: true })
        .eq("organization_id", organizationId),
    ]);
    const contracts =
      contractsResult.status === "fulfilled"
        ? (contractsResult.value.count ?? 0)
        : 0;
    const teamMembers =
      membersResult.status === "fulfilled"
        ? (membersResult.value.count ?? 0)
        : 0;
    return { contracts, teamMembers };
  } catch {
    return null;
  }
}

/**
 * Derives the tone for usage-vs-limit display per §2.11 zero-state
 * pattern + warning thresholds.
 */
export function usageTone(
  used: number,
  limit: number
): "success" | "warning" | "danger" {
  if (used === 0) return "success";
  if (used >= limit) return "danger";
  if (used >= limit * 0.8) return "warning";
  return "success";
}
