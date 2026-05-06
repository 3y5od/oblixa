import type { ContractStatus, Profile } from "@/lib/types";
import type { createAdminClient } from "@/lib/supabase/server";
import type { SemanticStatus } from "@/components/ui/status-badge";
import { loadOrgMemberProfileRows } from "@/lib/org-member-profiles";

type OwnerProfileSummary = Pick<Profile, "full_name" | "email">;

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

/** Tailwind utility fragments for contract header ui-badge chips */
export const STATUS_STYLES: Record<ContractStatus, string> = {
  draft: "bg-[color:color-mix(in_oklab,var(--surface-muted)_88%,var(--canvas))] text-[var(--text-secondary)]",
  pending_review: "bg-amber-100 text-amber-900",
  active: "bg-emerald-100 text-emerald-900",
  expired: "bg-rose-100 text-rose-900",
  terminated:
    "bg-[color:color-mix(in_oklab,var(--surface-inset)_88%,var(--canvas))] text-[var(--text-tertiary)]",
};

/**
 * Fetch owner profiles for a list of contracts and attach them using org-scoped
 * membership rows. This replaces the broken profile join path without widening
 * the admin query across arbitrary profile ids.
 */
export async function attachOwnerProfiles<T extends { owner_id: string | null }>(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  orgId: string,
  contracts: T[]
): Promise<(T & { owner?: OwnerProfileSummary })[]> {
  const ownerIds = [...new Set(contracts.map((c) => c.owner_id).filter(Boolean))] as string[];
  if (ownerIds.length === 0) {
    return contracts.map((c) => ({ ...c }));
  }

  const members = await loadOrgMemberProfileRows(admin, orgId, { userIds: ownerIds });

  const profileMap = new Map(
    members.flatMap((member) =>
      member.profiles ? [[member.user_id, member.profiles as OwnerProfileSummary] as const] : []
    )
  );

  return contracts.map((c) => {
    const owner = c.owner_id ? profileMap.get(c.owner_id) : undefined;
    return owner ? { ...c, owner } : { ...c };
  });
}
