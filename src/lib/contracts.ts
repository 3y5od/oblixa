import type { ContractStatus, Profile } from "@/lib/types";
import type { createAdminClient } from "@/lib/supabase/server";
import type { SemanticStatus } from "@/components/ui/status-badge";

export const STATUS_SEMANTICS: Record<ContractStatus, SemanticStatus> = {
  draft: "empty",
  pending_review: "warning",
  active: "healthy",
  expired: "overdue",
  terminated: "disabled",
};

export const STATUS_LABELS: Record<ContractStatus, string> = {
  draft: "Draft",
  pending_review: "Pending Review",
  active: "Active",
  expired: "Expired",
  terminated: "Terminated",
};

/** Tailwind utility fragments for contract header `ui-badge` chips */
export const STATUS_STYLES: Record<ContractStatus, string> = {
  draft: "bg-zinc-100 text-zinc-700",
  pending_review: "bg-amber-100 text-amber-900",
  active: "bg-emerald-100 text-emerald-900",
  expired: "bg-rose-100 text-rose-900",
  terminated: "bg-zinc-200/90 text-zinc-600",
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
