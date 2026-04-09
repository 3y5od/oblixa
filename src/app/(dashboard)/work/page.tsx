import Link from "next/link";
import { getAuthContext } from "@/lib/supabase/server";
import { BlockerChip, blockerCountForEntity } from "@/components/v4/execution-edge-blockers";

export default async function WorkPage() {
  const ctx = await getAuthContext();
  if (!ctx) return null;
  const userId = ctx.user.id;

  const [tasksRes, approvalsRes, obligationsRes, exceptionsRes] = await Promise.all([
    ctx.admin
      .from("contract_tasks")
      .select("id, title, status, due_date, contract_id")
      .eq("organization_id", ctx.orgId)
      .eq("assignee_id", userId)
      .in("status", ["open", "in_progress", "blocked"])
      .order("due_date", { ascending: true })
      .limit(12),
    ctx.admin
      .from("contract_approvals")
      .select("id, approval_type, status, due_at, contract_id")
      .eq("organization_id", ctx.orgId)
      .eq("status", "pending")
      .eq("approver_id", userId)
      .order("due_at", { ascending: true })
      .limit(12),
    ctx.admin
      .from("contract_obligations")
      .select("id, title, status, due_date, contract_id")
      .eq("organization_id", ctx.orgId)
      .in("status", ["open", "in_progress"])
      .eq("owner_id", userId)
      .order("due_date", { ascending: true })
      .limit(12),
    ctx.admin
      .from("exceptions")
      .select("id, title, severity, status, contract_id, owner_id")
      .eq("organization_id", ctx.orgId)
      .in("status", ["open", "in_progress"])
      .or(`owner_id.eq.${userId},owner_id.is.null`)
      .order("updated_at", { ascending: false })
      .limit(12),
  ]);

  const tasks = tasksRes.data ?? [];
  const approvals = approvalsRes.data ?? [];
  const obligations = obligationsRes.data ?? [];
  const exceptions = exceptionsRes.data ?? [];

  const contractIdSet = new Set<string>();
  for (const r of tasks) if (r.contract_id) contractIdSet.add(r.contract_id as string);
  for (const r of approvals) if (r.contract_id) contractIdSet.add(r.contract_id as string);
  for (const r of obligations) if (r.contract_id) contractIdSet.add(r.contract_id as string);
  for (const r of exceptions) if (r.contract_id) contractIdSet.add(r.contract_id as string);
  const contractIds = [...contractIdSet];

  type EdgeRow = {
    from_entity_type: string;
    from_entity_id: string;
    to_entity_type: string;
    to_entity_id: string;
    relation_type: string;
    status: string;
  };
  const { data: edgeRows } =
    contractIds.length === 0
      ? { data: [] as EdgeRow[] }
      : await ctx.admin
          .from("execution_graph_edges")
          .select("from_entity_type, from_entity_id, to_entity_type, to_entity_id, relation_type, status")
          .eq("organization_id", ctx.orgId)
          .eq("status", "active")
          .in("contract_id", contractIds);
  const edges: EdgeRow[] = (edgeRows ?? []) as EdgeRow[];

  return (
    <div className="space-y-8">
      <header className="ui-page-header">
        <div>
          <p className="ui-eyebrow">Work</p>
          <h1 className="ui-display-title mt-2">Execution Workbench</h1>
          <p className="ui-muted mt-3">
            Work assigned to you: tasks, approvals you must action, obligations you own, and exceptions you own or
            unassigned. Open module pages for the full workspace queue.
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-xs">
            <Link href="/contracts/tasks" className="ui-link">
              All org tasks
            </Link>
            <Link href="/contracts/approvals" className="ui-link">
              All approvals
            </Link>
            <Link href="/contracts/obligations" className="ui-link">
              All obligations
            </Link>
          </div>
        </div>
      </header>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="ui-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="ui-section-title">Your tasks</h2>
            <Link href="/contracts/tasks" className="ui-link text-xs">
              Open tasks module
            </Link>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {tasks.length === 0 ? (
              <li className="text-zinc-500">No open tasks assigned to you.</li>
            ) : (
              tasks.map((row) => (
                <li key={row.id} className="rounded-lg border border-zinc-200 px-3 py-2">
                  <p className="font-medium text-zinc-900">
                    {row.title}
                    <BlockerChip count={blockerCountForEntity(edges, "task", row.id as string)} />
                  </p>
                  <p className="text-xs text-zinc-500">
                    {row.status} {row.due_date ? `· due ${row.due_date}` : ""}
                    {row.contract_id ? (
                      <>
                        {" "}
                        ·{" "}
                        <Link href={`/contracts/${row.contract_id}`} className="ui-link">
                          contract
                        </Link>
                      </>
                    ) : null}
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="ui-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="ui-section-title">Your approvals</h2>
            <Link href="/contracts/approvals" className="ui-link text-xs">
              Open approvals
            </Link>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {approvals.length === 0 ? (
              <li className="text-zinc-500">No pending approvals assigned to you.</li>
            ) : (
              approvals.map((row) => (
                <li key={row.id} className="rounded-lg border border-zinc-200 px-3 py-2">
                  <p className="font-medium text-zinc-900">
                    {row.approval_type}
                    <BlockerChip count={blockerCountForEntity(edges, "approval", row.id as string)} />
                  </p>
                  <p className="text-xs text-zinc-500">
                    {row.status} {row.due_at ? `· due ${new Date(row.due_at).toLocaleString()}` : ""}
                    {row.contract_id ? (
                      <>
                        {" "}
                        ·{" "}
                        <Link href={`/contracts/${row.contract_id}`} className="ui-link">
                          contract
                        </Link>
                      </>
                    ) : null}
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="ui-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="ui-section-title">Your obligations</h2>
            <Link href="/contracts/obligations" className="ui-link text-xs">
              Open obligations
            </Link>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {obligations.length === 0 ? (
              <li className="text-zinc-500">No open obligations owned by you.</li>
            ) : (
              obligations.map((row) => (
                <li key={row.id} className="rounded-lg border border-zinc-200 px-3 py-2">
                  <p className="font-medium text-zinc-900">
                    {row.title}
                    <BlockerChip count={blockerCountForEntity(edges, "obligation", row.id as string)} />
                  </p>
                  <p className="text-xs text-zinc-500">
                    {row.status} {row.due_date ? `· due ${row.due_date}` : ""}
                    {row.contract_id ? (
                      <>
                        {" "}
                        ·{" "}
                        <Link href={`/contracts/${row.contract_id}`} className="ui-link">
                          contract
                        </Link>
                      </>
                    ) : null}
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="ui-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="ui-section-title">Exceptions for you / triage</h2>
            <Link href="/contracts/exceptions" className="ui-link text-xs">
              Open exception ledger
            </Link>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {exceptions.length === 0 ? (
              <li className="text-zinc-500">No matching exceptions.</li>
            ) : (
              exceptions.map((row) => (
                <li key={row.id} className="rounded-lg border border-zinc-200 px-3 py-2">
                  <p className="font-medium text-zinc-900">{row.title}</p>
                  <p className="text-xs text-zinc-500">
                    {row.status} · {row.severity}
                    {row.contract_id ? (
                      <>
                        {" "}
                        ·{" "}
                        <Link href={`/contracts/${row.contract_id}`} className="ui-link">
                          contract
                        </Link>
                      </>
                    ) : null}
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}
