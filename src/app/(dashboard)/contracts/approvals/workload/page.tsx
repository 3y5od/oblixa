import Link from "next/link";
import { getAuthContext } from "@/lib/supabase/server";

export default async function ApprovalWorkloadPage() {
  const ctx = await getAuthContext();
  if (!ctx) return null;

  const { data: pending } = await ctx.admin
    .from("contract_approvals")
    .select("id, approver_id, approval_type, due_at, created_at, contracts!inner(title)")
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

      <section className="ui-card overflow-hidden">
        <div className="border-b border-zinc-100 bg-zinc-50/60 px-5 py-3">
          <h2 className="text-sm font-semibold text-zinc-800">By approver</h2>
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
          <h2 className="text-sm font-semibold text-zinc-800">Queue (oldest due first)</h2>
        </div>
        <ul className="divide-y divide-zinc-100">
          {(pending ?? []).length === 0 ? (
            <li className="px-5 py-4 text-sm text-zinc-500">No pending approvals.</li>
          ) : (
            (pending ?? []).map((row) => {
              const c = row.contracts as { title?: string } | null;
              return (
                <li key={row.id} className="px-5 py-3 text-sm">
                  <p className="font-medium text-zinc-900">{c?.title ?? "Contract"}</p>
                  <p className="text-xs text-zinc-500">
                    {row.approval_type}
                    {row.due_at ? ` · due ${new Date(row.due_at).toLocaleString()}` : ""}
                  </p>
                </li>
              );
            })
          )}
        </ul>
      </section>
    </div>
  );
}
