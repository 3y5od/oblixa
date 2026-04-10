import Link from "next/link";
import { ListOrdered, Users } from "lucide-react";
import { getAuthContext } from "@/lib/supabase/server";
import { OperationalQueueRow, OperationalSummaryCard } from "@/components/ui/operational-summary-card";

export default async function ApprovalWorkloadPage() {
  const ctx = await getAuthContext();
  if (!ctx) return null;

  const { data: pending } = await ctx.admin
    .from("contract_approvals")
    .select("id, approver_id, approval_type, due_at, created_at, contract_id, contracts!inner(id, title)")
    .eq("organization_id", ctx.orgId)
    .eq("status", "pending")
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(200);

  const byApprover = new Map<string, number>();
  for (const row of pending ?? []) {
    const key = row.approver_id ?? "unassigned";
    byApprover.set(key, (byApprover.get(key) ?? 0) + 1);
  }

  const sortedApprovers = [...byApprover.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-8">
      <header className="ui-page-header">
        <div>
          <p className="ui-eyebrow">Approvals</p>
          <h1 className="ui-display-title mt-2">Approval workload</h1>
          <p className="ui-muted mt-3">Pending approvals grouped by current approver.</p>
          <Link href="/contracts/approvals" className="ui-link mt-3 inline-block text-sm">
            ← Back to approvals
          </Link>
        </div>
      </header>

      <section className="space-y-3">
        <div>
          <p className="ui-eyebrow">Load</p>
          <h2 className="ui-section-title mt-2 text-xl">Workload signals</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <OperationalSummaryCard
            eyebrow="Queue"
            headline="Pending approvals"
            tone={(pending ?? []).length > 0 ? "attention" : "healthy"}
            icon={ListOrdered}
            primaryValue={(pending ?? []).length}
            primaryUnit="in sample"
            action={{ href: "/contracts/approvals", label: "Open approvals" }}
            variant="compact"
          />
          <OperationalSummaryCard
            eyebrow="Routing"
            headline="Active approver slots"
            tone="neutral"
            icon={Users}
            primaryValue={sortedApprovers.length}
            primaryUnit="with at least one item"
            action={{ href: "/contracts/approvals/workload", label: "Refresh" }}
            variant="compact"
          />
        </div>
      </section>

      <section className="ui-card overflow-hidden">
        <div className="border-b border-zinc-100 bg-zinc-50/60 px-5 py-3">
          <p className="ui-eyebrow">Owners</p>
          <h2 className="ui-section-title mt-1 text-base">By approver</h2>
        </div>
        <ul className="divide-y divide-zinc-100">
          {sortedApprovers.length === 0 ? (
            <li className="px-5 py-4 text-sm text-zinc-500">No pending approvals.</li>
          ) : (
            sortedApprovers.map(([approverId, count]) => (
              <li key={approverId} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="text-zinc-700">{approverId === "unassigned" ? "Unassigned" : approverId}</span>
                <span className="font-semibold text-zinc-900">{count}</span>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="ui-card overflow-hidden">
        <div className="border-b border-zinc-100 bg-zinc-50/60 px-5 py-3">
          <p className="ui-eyebrow">Queue</p>
          <h2 className="ui-section-title mt-1 text-base">Oldest due first</h2>
        </div>
        <ul className="divide-y divide-zinc-100 p-3">
          {(pending ?? []).length === 0 ? (
            <li className="px-2 py-4 text-sm text-zinc-500">No pending approvals.</li>
          ) : (
            (pending ?? []).map((row) => {
              const c = row.contracts as { id?: string; title?: string } | null;
              const href = c?.id ? `/contracts/${c.id}` : "/contracts/approvals";
              return (
                <li key={row.id} className="py-2">
                  <OperationalQueueRow
                    href={href}
                    eyebrow={String(row.approval_type)}
                    title={c?.title ?? "Contract"}
                    hint={row.due_at ? `Due ${new Date(row.due_at).toLocaleString()}` : "No due date"}
                    chips={[
                      {
                        label: "Approver",
                        value: row.approver_id ? String(row.approver_id) : "Unassigned",
                      },
                    ]}
                    actionLabel="Open contract"
                    tone="attention"
                  />
                </li>
              );
            })
          )}
        </ul>
      </section>
    </div>
  );
}
