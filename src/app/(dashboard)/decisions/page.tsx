import Link from "next/link";
import { CreateDecisionForm } from "@/components/decisions/create-decision-form";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { getAuthContext } from "@/lib/supabase/server";
import { assertV5PageFeature } from "@/lib/v5/feature-guards";

export default async function DecisionsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; queue?: string }>;
}) {
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;
  assertV5PageFeature("v5DecisionFoundation");

  const sp = await searchParams;
  const typeFilter = typeof sp.type === "string" ? sp.type.trim() : "";
  const queueRaw = typeof sp.queue === "string" ? sp.queue.trim().toLowerCase() : "";
  const queueActiveOnly = queueRaw === "active" || queueRaw === "1" || queueRaw === "open";

  const { admin, orgId } = ctx;
  const { data } = await admin
    .from("decision_workspaces")
    .select("id, title, decision_type, status, due_at, linked_contract_ids, updated_at")
    .eq("organization_id", orgId)
    .order("updated_at", { ascending: false })
    .limit(200);

  const allRows = data ?? [];
  let rows = typeFilter
    ? allRows.filter((r) => String(r.decision_type) === typeFilter)
    : allRows;
  if (queueActiveOnly) {
    rows = rows.filter((r) => r.status === "open" || r.status === "in_review");
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 border-b border-zinc-200/60 pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="ui-eyebrow">Decision orchestration</p>
          <h1 className="ui-display-title mt-2">Decision workspaces</h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-zinc-500">
            Coordinate high-stakes renewals, amendments, and policy exceptions with one shared workspace.
            {typeFilter || queueActiveOnly ? (
              <span className="mt-2 block text-sm text-zinc-600">
                {queueActiveOnly ? <>Showing open and in-review decisions only. </> : null}
                {typeFilter ? (
                  <>
                    Filtered by type <code className="rounded bg-zinc-100 px-1">{typeFilter}</code>.{" "}
                  </>
                ) : null}
                <Link href="/decisions" className="ui-link">
                  Clear filters
                </Link>
              </span>
            ) : null}
          </p>
        </div>
        <Link href="/api/decisions" className="ui-btn-secondary px-4 py-2.5 text-[13px]" target="_blank">
          Open decisions API
        </Link>
      </header>

      <section className="ui-card p-5">
        <p className="ui-label-caps">Decision queue</p>
        <p className="mt-2 text-sm text-zinc-600">
          Focus on decisions with the nearest due date and unresolved stakeholder dependencies.
        </p>
        <div className="mt-4 border-t border-zinc-100 pt-4">
          <p className="ui-label-caps">New workspace</p>
          <p className="mt-1 text-xs text-zinc-500">
            Choose a decision type and optional required-input fields (JSON). You can edit them later on the
            workspace page.
          </p>
          <CreateDecisionForm />
        </div>
      </section>

      <div className="overflow-hidden rounded-2xl border border-zinc-200/70 bg-white">
        <table className="min-w-full divide-y divide-zinc-100 text-sm">
          <thead className="bg-zinc-50/70 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            <tr>
              <th className="px-5 py-3">Title</th>
              <th className="px-5 py-3">Type</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Due</th>
              <th className="px-5 py-3">Linked contracts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-zinc-500">
                  No decision workspaces yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-5 py-4 font-semibold text-zinc-900">
                    <Link href={`/decisions/${row.id}`} className="ui-link">
                      {row.title}
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-zinc-600">{row.decision_type}</td>
                  <td className="px-5 py-4 text-zinc-600">{row.status}</td>
                  <td className="px-5 py-4 text-zinc-600">{row.due_at ? new Date(row.due_at).toLocaleDateString() : "—"}</td>
                  <td className="px-5 py-4 text-zinc-600">
                    {Array.isArray(row.linked_contract_ids) ? row.linked_contract_ids.length : 0}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

