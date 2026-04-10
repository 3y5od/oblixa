import { getAuthContext } from "@/lib/supabase/server";
import Link from "next/link";
import { ExecutionGraphVizDynamic } from "@/components/v4/execution-graph-viz-dynamic";
import type { ExecutionGraphEdgeRow } from "@/lib/v4/graph-edge-labels";

export default async function ExecutionGraphPage(props: {
  searchParams: Promise<{ contractId?: string }>;
}) {
  const { contractId } = await props.searchParams;
  const ctx = await getAuthContext();
  if (!ctx) return null;

  const { data: edges } = await ctx.admin
    .from("execution_graph_edges")
    .select("id, contract_id, from_entity_type, from_entity_id, to_entity_type, to_entity_id, relation_type, status")
    .eq("organization_id", ctx.orgId)
    .order("created_at", { ascending: false })
    .limit(300);
  const contractIds = Array.from(new Set((edges ?? []).map((row) => row.contract_id)));
  const { data: contracts } =
    contractIds.length === 0
      ? { data: [] as Array<{ id: string; title: string }> }
      : await ctx.admin.from("contracts").select("id, title").in("id", contractIds);
  const titleByContract = new Map((contracts ?? []).map((row) => [row.id, row.title]));
  const selectedContractId = contractId && contractIds.includes(contractId) ? contractId : contractIds[0] ?? null;
  const timeline =
    !selectedContractId
      ? []
      : [
          ...(await ctx.admin
            .from("contract_tasks")
            .select("id, title, status, created_at")
            .eq("contract_id", selectedContractId)
            .order("created_at", { ascending: false })
            .limit(10)).data?.map((row) => ({ ...row, domain: "task" })) ?? [],
          ...(await ctx.admin
            .from("contract_approvals")
            .select("id, approval_type, status, created_at")
            .eq("contract_id", selectedContractId)
            .order("created_at", { ascending: false })
            .limit(10)).data?.map((row) => ({ ...row, domain: "approval", title: row.approval_type })) ?? [],
          ...(await ctx.admin
            .from("contract_obligations")
            .select("id, title, status, created_at")
            .eq("contract_id", selectedContractId)
            .order("created_at", { ascending: false })
            .limit(10)).data?.map((row) => ({ ...row, domain: "obligation" })) ?? [],
        ].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 15);

  const blockerCount = (edges ?? []).filter((row) => row.status === "active").length;
  const edgesPerContract = new Map<string, number>();
  for (const row of edges ?? []) {
    if (row.status !== "active") continue;
    const cid = row.contract_id as string;
    edgesPerContract.set(cid, (edgesPerContract.get(cid) ?? 0) + 1);
  }
  const topBlockedContracts = [...edgesPerContract.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);
  const blockedByCount = new Map<string, number>();
  const unblocksCount = new Map<string, number>();
  for (const edge of edges ?? []) {
    if (edge.status !== "active") continue;
    const toKey = `${edge.to_entity_type}:${edge.to_entity_id}`;
    const fromKey = `${edge.from_entity_type}:${edge.from_entity_id}`;
    blockedByCount.set(toKey, (blockedByCount.get(toKey) ?? 0) + 1);
    unblocksCount.set(fromKey, (unblocksCount.get(fromKey) ?? 0) + 1);
  }

  return (
    <div className="space-y-8">
      <header className="ui-page-header">
        <div>
          <p className="ui-eyebrow">Execution graph</p>
          <h1 className="ui-display-title mt-2">Dependency and Blocker View</h1>
          <p className="ui-muted mt-3">
            Cross-work dependency graph across tasks, approvals, obligations, and renewal checkpoints.
          </p>
        </div>
      </header>

      <section className="ui-card p-5">
        <p className="ui-label-caps">Portfolio blocker summary</p>
        <p className="mt-2 text-sm text-zinc-700">
          Active dependency edges: <span className="font-semibold text-zinc-900">{blockerCount}</span>
        </p>
        {topBlockedContracts.length > 0 ? (
          <div className="mt-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Contracts with the most active dependencies
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-zinc-700">
              {topBlockedContracts.map(([cid, n]) => (
                <li key={cid}>
                  <Link href={`/contracts/execution-graph?contractId=${cid}`} className="ui-link font-medium">
                    {titleByContract.get(cid) ?? cid.slice(0, 8)}
                  </Link>
                  <span className="text-zinc-500"> · {n} edges</span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
        {contractIds.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <p className="w-full text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Contracts with edges
            </p>
            {contractIds.map((cid) => (
              <Link
                key={cid}
                href={`/contracts/execution-graph?contractId=${cid}`}
                className={`rounded-full border px-3 py-1 text-xs ${
                  cid === selectedContractId
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 text-zinc-700 hover:border-zinc-400"
                }`}
              >
                {titleByContract.get(cid) ?? cid.slice(0, 8)}
              </Link>
            ))}
          </div>
        ) : null}
      </section>

      {selectedContractId ? (
        <section className="ui-card p-5">
          <p className="ui-label-caps">Visual dependency graph</p>
          <p className="mt-1 text-xs text-zinc-500">
            {titleByContract.get(selectedContractId) ?? selectedContractId}
          </p>
          <div className="mt-4">
            <ExecutionGraphVizDynamic
              edges={(edges ?? []).filter((row) => row.contract_id === selectedContractId) as ExecutionGraphEdgeRow[]}
            />
          </div>
        </section>
      ) : null}

      <section className="ui-card p-5">
        <p className="ui-label-caps">Recent dependencies</p>
        <ul className="mt-3 space-y-2 text-sm">
          {(edges ?? []).length === 0 ? (
            <li className="text-zinc-500">No execution graph edges yet. Apply a program to generate work links.</li>
          ) : (
            (edges ?? []).map((edge) => (
              <li key={edge.id} className="rounded-lg border border-zinc-200 px-3 py-2">
                <p className="font-medium text-zinc-900">
                  {edge.from_entity_type} {edge.relation_type} {edge.to_entity_type}
                </p>
                <p className="text-xs text-zinc-500">
                  {titleByContract.get(edge.contract_id) ?? edge.contract_id} · status {edge.status}
                </p>
                <div className="mt-1 flex gap-2 text-[11px]">
                  <span className="rounded-full border border-zinc-300 px-2 py-0.5 text-zinc-700">
                    blocked by {blockedByCount.get(`${edge.to_entity_type}:${edge.to_entity_id}`) ?? 0}
                  </span>
                  <span className="rounded-full border border-zinc-300 px-2 py-0.5 text-zinc-700">
                    unblocks {unblocksCount.get(`${edge.from_entity_type}:${edge.from_entity_id}`) ?? 0}
                  </span>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>
      <section className="ui-card p-5">
        <p className="ui-label-caps">Execution timeline (selected contract)</p>
        {!selectedContractId ? (
          <p className="mt-2 text-sm text-zinc-500">No contract selected.</p>
        ) : (
          <>
            <p className="mt-2 text-xs text-zinc-500">
              {titleByContract.get(selectedContractId) ?? selectedContractId}
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              {timeline.length === 0 ? (
                <li className="text-zinc-500">No timeline entries yet.</li>
              ) : (
                timeline.map((entry) => (
                  <li key={`${entry.domain}:${entry.id}`} className="rounded border border-zinc-200 px-3 py-2">
                    <p className="font-medium text-zinc-900">
                      {entry.domain} · {entry.title}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {entry.status} · {new Date(entry.created_at).toLocaleString()}
                    </p>
                  </li>
                ))
              )}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
