/**
 * Two-hop propagation summaries over stored health-graph edges (bottleneck = min edge risk on the path).
 */

export type HealthGraphPathNode = {
  id: string;
  node_type: string;
  node_ref_id: string;
  label?: string | null;
};

export type HealthGraphPathEdge = {
  id: string;
  source_node_id: string;
  target_node_id: string;
  relationship_type: string;
  propagation_risk: number;
};

export type PropagationPathSummary = {
  path_label: string;
  hops: number;
  bottleneck_risk: number;
  relationship_types: string[];
  edge_ids: string[];
};

function nodeLabel(n: HealthGraphPathNode | undefined, fallbackId: string): string {
  if (!n) return fallbackId.slice(0, 12);
  const tail = (n.label ?? n.node_ref_id ?? "").trim() || n.id.slice(0, 8);
  return `${n.node_type}:${tail.length > 48 ? `${tail.slice(0, 48)}…` : tail}`;
}

/**
 * Returns up to `limit` distinct A→B→C paths ranked by bottleneck propagation risk (highest first).
 */
export function summarizePropagationPaths(
  nodes: HealthGraphPathNode[],
  edges: HealthGraphPathEdge[],
  options?: { limit?: number }
): PropagationPathSummary[] {
  const limit = options?.limit ?? 20;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out = new Map<string, HealthGraphPathEdge[]>();
  const inn = new Map<string, HealthGraphPathEdge[]>();
  for (const e of edges) {
    const s = String(e.source_node_id);
    const t = String(e.target_node_id);
    if (!out.has(s)) out.set(s, []);
    out.get(s)!.push(e);
    if (!inn.has(t)) inn.set(t, []);
    inn.get(t)!.push(e);
  }

  const seen = new Set<string>();
  const paths: PropagationPathSummary[] = [];

  for (const mid of nodes.map((n) => n.id)) {
    const incoming = inn.get(mid) ?? [];
    const outgoing = out.get(mid) ?? [];
    for (const e1 of incoming) {
      for (const e2 of outgoing) {
        const a = String(e1.source_node_id);
        const c = String(e2.target_node_id);
        if (a === c) continue;
        const key = `${a}|${mid}|${c}|${e1.id}|${e2.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const r1 = Number(e1.propagation_risk);
        const r2 = Number(e2.propagation_risk);
        if (!Number.isFinite(r1) || !Number.isFinite(r2)) continue;
        const bottleneck = Math.min(r1, r2);
        const na = byId.get(a);
        const nb = byId.get(mid);
        const nc = byId.get(c);
        paths.push({
          path_label: `${nodeLabel(na, a)} → ${nodeLabel(nb, mid)} → ${nodeLabel(nc, c)}`,
          hops: 2,
          bottleneck_risk: Number(bottleneck.toFixed(4)),
          relationship_types: [String(e1.relationship_type), String(e2.relationship_type)],
          edge_ids: [String(e1.id), String(e2.id)],
        });
      }
    }
  }

  paths.sort((p, q) => q.bottleneck_risk - p.bottleneck_risk);
  return paths.slice(0, limit);
}

/**
 * Directed three-hop paths A→B→C→D (distinct endpoints), bottleneck = min of the three edge risks.
 */
export function summarizeThreeHopPropagationPaths(
  nodes: HealthGraphPathNode[],
  edges: HealthGraphPathEdge[],
  options?: { limit?: number }
): PropagationPathSummary[] {
  const limit = options?.limit ?? 12;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out = new Map<string, HealthGraphPathEdge[]>();
  for (const e of edges) {
    const s = String(e.source_node_id);
    if (!out.has(s)) out.set(s, []);
    out.get(s)!.push(e);
  }

  const seen = new Set<string>();
  const paths: PropagationPathSummary[] = [];

  for (const e1 of edges) {
    const a = String(e1.source_node_id);
    const b = String(e1.target_node_id);
    for (const e2 of out.get(b) ?? []) {
      const c = String(e2.target_node_id);
      if (c === a) continue;
      for (const e3 of out.get(c) ?? []) {
        const d = String(e3.target_node_id);
        if (d === a || d === b) continue;
        const key = `${e1.id}|${e2.id}|${e3.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const r1 = Number(e1.propagation_risk);
        const r2 = Number(e2.propagation_risk);
        const r3 = Number(e3.propagation_risk);
        if (!Number.isFinite(r1) || !Number.isFinite(r2) || !Number.isFinite(r3)) continue;
        const bottleneck = Math.min(r1, r2, r3);
        paths.push({
          path_label: `${nodeLabel(byId.get(a), a)} → ${nodeLabel(byId.get(b), b)} → ${nodeLabel(byId.get(c), c)} → ${nodeLabel(byId.get(d), d)}`,
          hops: 3,
          bottleneck_risk: Number(bottleneck.toFixed(4)),
          relationship_types: [
            String(e1.relationship_type),
            String(e2.relationship_type),
            String(e3.relationship_type),
          ],
          edge_ids: [String(e1.id), String(e2.id), String(e3.id)],
        });
      }
    }
  }

  paths.sort((p, q) => q.bottleneck_risk - p.bottleneck_risk);
  return paths.slice(0, limit);
}
