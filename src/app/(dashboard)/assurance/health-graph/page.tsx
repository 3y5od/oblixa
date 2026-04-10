import Link from "next/link";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { AssuranceListCard } from "@/components/assurance/assurance-list-card";
import { HealthGraphConcentrationDynamic } from "@/components/assurance/health-graph-concentration-dynamic";
import { getAuthContext } from "@/lib/supabase/server";
import { assertV6PageFeature } from "@/lib/v6/feature-guards";
import { summarizePropagationPaths, summarizeThreeHopPropagationPaths } from "@/lib/v6/health-graph-paths";

export default async function AssuranceHealthGraphPage(props: {
  searchParams: Promise<{ type?: string }>;
}) {
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;
  assertV6PageFeature("v6AssuranceCore");

  const { type: rawType } = await props.searchParams;
  const typeFilter = String(rawType ?? "").trim();

  const [{ data: nodesRaw }, { data: edges }] = await Promise.all([
    ctx.admin
      .from("portfolio_health_graph_nodes")
      .select("id, node_type, node_ref_id, label, risk_score, concentration_score, metadata_json")
      .eq("organization_id", ctx.orgId)
      .order("risk_score", { ascending: false })
      .limit(80),
    ctx.admin
      .from("portfolio_health_graph_edges")
      .select("id, source_node_id, target_node_id, relationship_type, propagation_risk, explainability_json")
      .eq("organization_id", ctx.orgId)
      .order("propagation_risk", { ascending: false })
      .limit(160),
  ]);

  const nodes =
    typeFilter && typeFilter !== "all"
      ? (nodesRaw ?? []).filter((n) => n.node_type === typeFilter)
      : (nodesRaw ?? []);

  const types = Array.from(new Set((nodesRaw ?? []).map((n) => n.node_type))).sort();

  const nodeLabelById = new Map(
    (nodesRaw ?? []).map((n) => [
      String(n.id),
      `${String(n.node_type)}:${String(n.label ?? n.node_ref_id)}`,
    ])
  );
  const topEdges = [...(edges ?? [])]
    .sort((a, b) => Number(b.propagation_risk) - Number(a.propagation_risk))
    .slice(0, 24);

  const propagationPaths = summarizePropagationPaths(
    (nodesRaw ?? []).map((n) => ({
      id: String(n.id),
      node_type: String(n.node_type),
      node_ref_id: String(n.node_ref_id),
      label: n.label ? String(n.label) : null,
    })),
    (edges ?? []).map((e) => ({
      id: String(e.id),
      source_node_id: String(e.source_node_id),
      target_node_id: String(e.target_node_id),
      relationship_type: String(e.relationship_type),
      propagation_risk: Number(e.propagation_risk),
    })),
    { limit: 16 }
  );

  const propagationPaths3 = summarizeThreeHopPropagationPaths(
    (nodesRaw ?? []).map((n) => ({
      id: String(n.id),
      node_type: String(n.node_type),
      node_ref_id: String(n.node_ref_id),
      label: n.label ? String(n.label) : null,
    })),
    (edges ?? []).map((e) => ({
      id: String(e.id),
      source_node_id: String(e.source_node_id),
      target_node_id: String(e.target_node_id),
      relationship_type: String(e.relationship_type),
      propagation_risk: Number(e.propagation_risk),
    })),
    { limit: 10 }
  );

  return (
    <AssuranceListCard
      title="Portfolio health graph"
      subtitle="Assurance"
      explainer={
        <div className="space-y-2">
          <p>
            Nodes combine scorecards, organization rollups, published control policies, active campaigns, owners, teams,
            open decisions, exceptions, and evidence concentration buckets. Edges show rollups, shared contract exposure,
            policy and campaign touchpoints, and org-to-entity load.
          </p>
          <p className="text-xs text-zinc-600">
            Select a node in the diagram to highlight connected edges — each edge carries{" "}
            <code className="rounded bg-zinc-100 px-1">explainability_json</code> describing the rule used to infer
            propagation risk.
          </p>
        </div>
      }
    >
      <div className="flex flex-wrap gap-2 text-xs">
        <a
          className={`rounded-full border px-3 py-1 ${!typeFilter || typeFilter === "all" ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 text-zinc-700"}`}
          href="/assurance/health-graph"
        >
          All types
        </a>
        {types.map((t) => (
          <a
            key={t}
            className={`rounded-full border px-3 py-1 ${typeFilter === t ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 text-zinc-700"}`}
            href={`/assurance/health-graph?type=${encodeURIComponent(t)}`}
          >
            {t}
          </a>
        ))}
      </div>
      <p className="mt-3 text-sm text-zinc-700">
        {(nodesRaw ?? []).length} nodes · {(edges ?? []).length} edges
        {typeFilter && typeFilter !== "all" ? ` (showing ${nodes.length} filtered)` : null}
      </p>
      <HealthGraphConcentrationDynamic
        nodes={
          nodes.map((row) => ({
            id: String(row.id),
            node_type: String(row.node_type),
            node_ref_id: String(row.node_ref_id),
            label: row.label ? String(row.label) : null,
            risk_score: Number(row.risk_score),
            concentration_score: Number(row.concentration_score),
          }))
        }
        edges={
          (edges ?? []).map((row) => ({
            id: String(row.id),
            source_node_id: String(row.source_node_id),
            target_node_id: String(row.target_node_id),
            relationship_type: String(row.relationship_type),
            propagation_risk: Number(row.propagation_risk),
            explainability_json: row.explainability_json as Record<string, unknown> | null,
          }))
        }
      />
      <ul className="mt-3 max-h-[480px] space-y-2 overflow-y-auto text-sm">
        {nodes.map((row) => (
          <li key={row.id} className="rounded-lg border border-zinc-100 p-3">
            <p className="font-medium text-zinc-900">
              <span className="text-zinc-500">{row.node_type}</span> · {row.label ?? row.node_ref_id}
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              Risk {Number(row.risk_score).toFixed(1)} · Concentration {Number(row.concentration_score).toFixed(1)}
            </p>
          </li>
        ))}
      </ul>
      {propagationPaths.length > 0 ? (
        <div className="mt-6 rounded-lg border border-amber-100 bg-amber-50/40 p-3">
          <p className="ui-label-caps">High propagation paths (two hops)</p>
          <p className="mt-1 text-xs text-zinc-600">
            Each row is A→B→C through two edges. Bottleneck score is the lower of the two edge propagation values (weakest
            link on that chain).
          </p>
          <ul className="mt-2 max-h-56 space-y-2 overflow-y-auto text-xs text-zinc-800">
            {propagationPaths.map((p, i) => (
              <li key={`${p.edge_ids.join("-")}-${i}`} className="rounded border border-zinc-100 bg-surface/90 p-2">
                <span className="font-medium tabular-nums text-amber-900">bottleneck {p.bottleneck_risk}</span>
                <span className="text-zinc-500"> · </span>
                <span className="text-zinc-700">{p.path_label}</span>
                <p className="mt-1 text-[10px] text-zinc-500">
                  {p.relationship_types.join(" → ")}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {propagationPaths3.length > 0 ? (
        <div className="mt-4 rounded-lg border border-violet-100 bg-violet-50/40 p-3">
          <p className="ui-label-caps">High propagation paths (three hops)</p>
          <p className="mt-1 text-xs text-zinc-600">
            A→B→C→D across three edges. Bottleneck is the minimum propagation risk among them. Larger portfolios may need
            more edges loaded in the rollup job to see long chains.
          </p>
          <ul className="mt-2 max-h-56 space-y-2 overflow-y-auto text-xs text-zinc-800">
            {propagationPaths3.map((p, i) => (
              <li key={`3-${p.edge_ids.join("-")}-${i}`} className="rounded border border-zinc-100 bg-surface/90 p-2">
                <span className="font-medium tabular-nums text-violet-900">bottleneck {p.bottleneck_risk}</span>
                <span className="text-zinc-500"> · </span>
                <span className="text-zinc-700">{p.path_label}</span>
                <p className="mt-1 text-[10px] text-zinc-500">{p.relationship_types.join(" → ")}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="ui-label-caps mt-6">Propagation risk (top edges)</p>
      <p className="mt-1 text-xs text-zinc-500">
        Sorted by propagation_risk; endpoints show node labels for quick “why this is risky” scanning.
      </p>
      <ul className="mt-2 max-h-80 space-y-2 overflow-y-auto text-sm">
        {topEdges.map((row) => (
          <li key={row.id} className="rounded-lg border border-zinc-100 p-3">
            <p className="font-medium text-zinc-900">{row.relationship_type}</p>
            <p className="mt-1 text-xs text-zinc-600">
              Propagation {Number(row.propagation_risk).toFixed(1)} ·{" "}
              <span className="text-zinc-500">
                {nodeLabelById.get(String(row.source_node_id)) ?? row.source_node_id} →{" "}
                {nodeLabelById.get(String(row.target_node_id)) ?? row.target_node_id}
              </span>
            </p>
            {row.explainability_json ? (
              <pre className="mt-2 max-h-24 overflow-auto rounded bg-zinc-50 p-2 text-[10px] text-zinc-600">
                {JSON.stringify(row.explainability_json, null, 2)}
              </pre>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="mt-6 text-xs text-zinc-600">
        <Link className="ui-link" href="/api/assurance/health-graph" target="_blank">
          Health graph JSON
        </Link>
        {" · "}
        <Link className="ui-link" href="/api/assurance/check-runs?limit=40" target="_blank">
          Check runs JSON
        </Link>
        {" · "}
        <Link className="ui-link" href="/api/assurance/analytics/summary" target="_blank">
          Analytics summary
        </Link>
        {" · "}
        <Link className="ui-link" href="/assurance">
          Assurance hub
        </Link>
      </p>
    </AssuranceListCard>
  );
}
