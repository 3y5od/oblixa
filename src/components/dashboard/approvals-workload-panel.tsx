import { Users } from "lucide-react";
import { getDashboardAdminClientCached } from "@/lib/dashboard-data";
import { TopNList } from "@/components/ui/top-n-list";

interface ApprovalsWorkloadPanelProps {
  orgId: string;
}

export async function ApprovalsWorkloadPanel({ orgId }: ApprovalsWorkloadPanelProps) {
  const admin = await getDashboardAdminClientCached();
  const { data: rows } = await admin
    .from("contract_approvals")
    .select("id, assigned_to_user_id, due_at, status")
    .eq("organization_id", orgId)
    .eq("status", "pending")
    .limit(500);

  const pendingList = (rows ?? []) as Array<{
    id: string;
    assigned_to_user_id: string | null;
    due_at: string | null;
    status: string;
  }>;
  if (pendingList.length === 0) return null;

  // Group by assignee
  const buckets = new Map<string, { count: number; overdue: number }>();
  const now = new Date().getTime();
  for (const r of pendingList) {
    const owner = r.assigned_to_user_id ?? "unassigned";
    const cur = buckets.get(owner) ?? { count: 0, overdue: 0 };
    cur.count += 1;
    if (r.due_at && new Date(r.due_at).getTime() < now) cur.overdue += 1;
    buckets.set(owner, cur);
  }

  // Resolve owner labels — best-effort from profiles table.
  const ownerIds = Array.from(buckets.keys()).filter((k) => k !== "unassigned");
  const { data: profiles } = ownerIds.length > 0
    ? await admin
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ownerIds)
    : { data: [] as Array<{ id: string; full_name: string | null; email: string | null }> };
  const profileMap = new Map<string, { name: string }>();
  for (const p of (profiles ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) {
    const display =
      (p.full_name && p.full_name.trim() !== "name" ? p.full_name : null) ??
      p.email ??
      "Member";
    profileMap.set(p.id, { name: display });
  }

  const items = Array.from(buckets.entries())
    .map(([ownerId, v]) => ({
      label:
        ownerId === "unassigned"
          ? "Unassigned"
          : profileMap.get(ownerId)?.name ?? "Member",
      value: v.count,
      tone: (v.overdue > 0 ? "danger" : v.count > 5 ? "warning" : "neutral") as
        | "danger"
        | "warning"
        | "neutral",
      meta: v.overdue > 0 ? `${v.overdue} OVERDUE` : undefined,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  return (
    <section className="space-y-3" aria-label="Approvals workload">
      <h2 className="inline-flex items-center gap-2 text-[1.375rem] font-semibold tracking-tight text-[var(--text-primary)]">
        <Users className="h-4 w-4 text-[var(--accent-strong)]" strokeWidth={1.85} aria-hidden />
        Approvals workload
      </h2>
      <div className="rounded-2xl border border-[var(--border-card)] bg-[var(--surface-raised)] p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-[color:color-mix(in_oklab,var(--warning-ink)_28%,var(--border-card))] bg-[color:color-mix(in_oklab,var(--warning-soft)_18%,var(--surface-raised))] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] leading-none text-[var(--warning-ink)]">
            <span className="tabular-nums">{pendingList.length}</span>
            <span>PENDING</span>
          </span>
        </div>
        <TopNList items={items} unit="" />
      </div>
    </section>
  );
}
