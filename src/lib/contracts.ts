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
  draft: "Incomplete",
  pending_review: "Pending review",
  active: "Active",
  expired: "Expired",
  terminated: "Terminated",
};

/**
 * Token-backed utility fragments for contract header status chips. Each pairs a
 * soft semantic fill with its matching ink so a status reads as a crisp ledger
 * stamp on the warm chrome (not a generic palette swatch): warning amber for
 * pending review, confirmed green for active, oxblood for expired, and quiet
 * parchment/steel for the closed-out states. Values of STATUS_LABELS are
 * unchanged — this only deepens their visual treatment.
 */
export const STATUS_STYLES: Record<ContractStatus, string> = {
  draft:
    "bg-[color:color-mix(in_oklab,var(--surface-muted)_88%,var(--canvas))] text-[var(--text-secondary)]",
  pending_review:
    "bg-[color:color-mix(in_oklab,var(--warning-soft)_55%,var(--surface-raised))] text-[var(--warning-ink)]",
  active:
    "bg-[color:color-mix(in_oklab,var(--success-soft)_55%,var(--surface-raised))] text-[var(--success-ink)]",
  expired:
    "bg-[color:color-mix(in_oklab,var(--danger-soft)_50%,var(--surface-raised))] text-[var(--danger-ink)]",
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
