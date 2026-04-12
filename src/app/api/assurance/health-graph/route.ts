import { NextResponse } from "next/server";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { listHealthGraph } from "@/lib/v6/assurance";
import { summarizePropagationPaths, summarizeThreeHopPropagationPaths } from "@/lib/v6/health-graph-paths";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";

export async function GET() {
  const disabled = requireV6ApiFeature("v6AssuranceCore");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context();
  if (!ctx) return errorResponse!;

  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/assurance/health-graph",
  });
  if (modeGate) return modeGate;

  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_get_assurance_health_graph_total", 1).catch(
    () => undefined
  );

  const { nodes, edges, error } = await listHealthGraph(ctx.admin, ctx.orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  type NodeRow = { id: string; node_type: string; node_ref_id: string; label?: string | null };
  type EdgeRow = {
    id: string;
    source_node_id: string;
    target_node_id: string;
    relationship_type: string;
    propagation_risk: number;
  };
  const nodeRows = (nodes ?? []) as unknown as NodeRow[];
  const edgeRows = (edges ?? []) as unknown as EdgeRow[];
  const pathNodes = nodeRows.map((n) => ({
    id: String(n.id),
    node_type: String(n.node_type),
    node_ref_id: String(n.node_ref_id),
    label: n.label ?? null,
  }));
  const pathEdges = edgeRows.map((e) => ({
    id: String(e.id),
    source_node_id: String(e.source_node_id),
    target_node_id: String(e.target_node_id),
    relationship_type: String(e.relationship_type),
    propagation_risk: Number(e.propagation_risk),
  }));
  const propagation_paths = summarizePropagationPaths(pathNodes, pathEdges, { limit: 24 });
  const propagation_paths_3hop = summarizeThreeHopPropagationPaths(pathNodes, pathEdges, { limit: 12 });
  return NextResponse.json({
    nodes: nodeRows,
    edges: edgeRows,
    propagation_paths,
    propagation_paths_3hop,
    explainability_note:
      "Edge explainability_json and summarized propagation paths trace how risk is inferred across the graph.",
  });
}
