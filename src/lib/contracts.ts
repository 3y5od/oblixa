import type { ContractStatus, Profile } from "@/lib/types";
import type { createAdminClient } from "@/lib/supabase/server";

export const STATUS_STYLES: Record<ContractStatus, string> = {
  draft:
    "border border-zinc-200/80 bg-zinc-50/90 font-semibold text-zinc-600",
  pending_review:
    "border border-amber-200/70 bg-amber-50/80 font-semibold text-amber-900",
  active:
    "border border-emerald-200/70 bg-emerald-50/70 font-semibold text-emerald-900",
  expired:
    "border border-rose-200/70 bg-rose-50/80 font-semibold text-rose-900",
  terminated:
    "border border-zinc-200/70 bg-zinc-100/50 font-semibold text-zinc-600",
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
): Promise<(T & { owner?: Pick<Profile, "full_name" | "email"> })[]> {
  const ownerIds = [...new Set(contracts.map((c) => c.owner_id).filter(Boolean))] as string[];
  if (ownerIds.length === 0) {
    return contracts.map((c) => ({ ...c }));
  }

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .in("id", ownerIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  return contracts.map((c) => {
    const owner = c.owner_id
      ? (profileMap.get(c.owner_id) as Pick<Profile, "full_name" | "email"> | undefined)
      : undefined;
    return owner ? { ...c, owner } : { ...c };
  });
}
