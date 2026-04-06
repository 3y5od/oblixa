import type { ContractStatus, Profile } from "@/lib/types";
import type { createAdminClient } from "@/lib/supabase/server";

export const STATUS_STYLES: Record<ContractStatus, string> = {
  draft: "bg-gray-100 text-gray-700",
  pending_review: "bg-amber-100 text-amber-700",
  active: "bg-green-100 text-green-700",
  expired: "bg-red-100 text-red-700",
  terminated: "bg-gray-100 text-gray-700",
};

export const STATUS_LABELS: Record<ContractStatus, string> = {
  draft: "Draft",
  pending_review: "Pending Review",
  active: "Active",
  expired: "Expired",
  terminated: "Terminated",
};

/**
 * Fetch owner profiles for a list of contracts and attach them.
 * This replaces the broken `profiles!contracts_owner_id_fkey` join
 * (the FK targets `auth.users`, not `profiles`, so PostgREST can't resolve it).
 */
export async function attachOwnerProfiles<T extends { owner_id: string | null }>(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  contracts: T[]
): Promise<(T & { owner: Pick<Profile, "full_name" | "email"> | null })[]> {
  const ownerIds = [...new Set(contracts.map((c) => c.owner_id).filter(Boolean))] as string[];
  if (ownerIds.length === 0) {
    return contracts.map((c) => ({ ...c, owner: null }));
  }

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .in("id", ownerIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  return contracts.map((c) => ({
    ...c,
    owner: c.owner_id ? (profileMap.get(c.owner_id) as Pick<Profile, "full_name" | "email"> | undefined) ?? null : null,
  }));
}
