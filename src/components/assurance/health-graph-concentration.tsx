"use client";

import { useMemo, useState } from "react";

export type HealthGraphConcentrationNode = {
  id: string;
  node_type: string;
  node_ref_id: string;
  label: string | null;
  risk_score: number;
  concentration_score: number;
};

export type HealthGraphConcentrationEdge = {
  id: string;
  source_node_id: string;
  target_node_id: string;
  relationship_type: string;
  propagation_risk: number;
  explainability_json?: Record<string, unknown> | null;
};

export type HealthGraphConcentrationProps = {
  nodes: HealthGraphConcentrationNode[];
  edges: HealthGraphConcentrationEdge[];
};

export function HealthGraphConcentration({ nodes, edges }: HealthGraphConcentrationProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"ring" | "top_edges" | "by_type">("ring");

  const displayNodes = useMemo(() => nodes.slice(0, 22), [nodes]);
  const w = 560;
  const h = 380;
  const cx = w / 2;
  const cy = h / 2;
  const radius = 132;

  const layout = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    const n = Math.max(displayNodes.length, 1);
    displayNodes.forEach((node, i) => {
      const ang = (2 * Math.PI * i) / n - Math.PI / 2;
      m.set(node.id, { x: cx + radius * Math.cos(ang), y: cy + radius * Math.sin(ang) });
    });
    return m;
  }, [displayNodes, cx, cy, radius]);

  const edgeSet = new Set(displayNodes.map((n) => n.id));
  const displayEdges = edges.filter(
    (e) => edgeSet.has(e.source_node_id) && edgeSet.has(e.target_node_id)
  );

  const selected = displayNodes.find((n) => n.id === selectedId);
  const connectedEdges = selectedId
    ? displayEdges.filter((e) => e.source_node_id === selectedId || e.target_node_id === selectedId)
    : [];

  const labelById = useMemo(() => {
    const m = new Map<string, string>();
    nodes.forEach((n) => {
      m.set(n.id, (n.label ?? n.node_ref_id).slice(0, 28));
    });
    return m;
  }, [nodes]);

  const topEdges = useMemo(() => {
    return [...edges]
      .sort((a, b) => Number(b.propagation_risk) - Number(a.propagation_risk))
      .slice(0, 14);
  }, [edges]);

  const byNodeType = useMemo(() => {
    const m = new Map<string, { count: number; maxRisk: number; maxConc: number }>();
    for (const n of nodes) {
      const t = (n.node_type || "unknown").trim() || "unknown";
      const cur = m.get(t) ?? { count: 0, maxRisk: 0, maxConc: 0 };
      cur.count += 1;
      cur.maxRisk = Math.max(cur.maxRisk, Number(n.risk_score) || 0);
      cur.maxConc = Math.max(cur.maxConc, Number(n.concentration_score) || 0);
      m.set(t, cur);
    }
    return [...m.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [nodes]);

  const maxTypeCount = byNodeType[0]?.[1].count ?? 1;

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-zinc-500">View:</span>
        <button
          type="button"
          className={`rounded-full border px-2.5 py-0.5 text-xs ${
            view === "ring" ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-surface text-zinc-700"
          }`}
          onClick={() => {
            setView("ring");
            setSelectedId(null);
          }}
        >
          Ring (top risk nodes)
        </button>
        <button
          type="button"
          className={`rounded-full border px-2.5 py-0.5 text-xs ${
            view === "top_edges" ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-surface text-zinc-700"
          }`}
          onClick={() => {
            setView("top_edges");
            setSelectedId(null);
          }}
        >
          Top edges
        </button>
        <button
          type="button"
          className={`rounded-full border px-2.5 py-0.5 text-xs ${
            view === "by_type" ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-surface text-zinc-700"
          }`}
          onClick={() => {
            setView("by_type");
            setSelectedId(null);
          }}
        >
          By node type
        </button>
      </div>
      {view === "ring" ? (
        <p className="text-xs text-zinc-600">
          Select a node to highlight propagation paths. Showing top {displayNodes.length} nodes by risk.
        </p>
      ) : view === "top_edges" ? (
        <p className="text-xs text-zinc-600">
          Edges ranked by propagation risk (full graph). Use this to spot the strongest dependency paths.
        </p>
      ) : (
        <p className="text-xs text-zinc-600">
          Count and peak risk by <code className="rounded bg-zinc-100 px-1">node_type</code> across the full snapshot
          (heatmap-style bars).
        </p>
      )}
      {view === "by_type" ? (
        <div className="max-h-[380px] space-y-2 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50/80 p-3">
          {byNodeType.length === 0 ? (
            <p className="text-xs text-zinc-500">No nodes in this snapshot.</p>
          ) : (
            byNodeType.map(([type, stats]) => {
              const wPct = Math.max(8, Math.round((stats.count / maxTypeCount) * 100));
              return (
                <div key={type}>
                  <div className="flex justify-between gap-2 text-[11px] text-zinc-600">
                    <span className="truncate font-medium text-zinc-800" title={type}>
                      {type}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {stats.count} nodes · max risk {stats.maxRisk.toFixed(1)} · max conc.{" "}
                      {stats.maxConc.toFixed(1)}
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full rounded-full bg-zinc-200/80">
                    <div
                      className="h-2 rounded-full bg-amber-500/90"
                      style={{ width: `${wPct}%` }}
                      title={`${stats.count} nodes`}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : view === "ring" ? (
        <svg
        width={w}
        height={h}
        className="rounded-xl border border-zinc-200 bg-zinc-50/80"
        role="img"
        aria-label="Health graph concentration"
      >
        {displayEdges.map((e) => {
          const a = layout.get(e.source_node_id);
          const b = layout.get(e.target_node_id);
          if (!a || !b) return null;
          const highlight =
            selectedId &&
            (e.source_node_id === selectedId || e.target_node_id === selectedId);
          return (
            <line
              key={e.id}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={highlight ? "rgb(24 24 27)" : "rgb(161 161 170)"}
              strokeWidth={highlight ? 2 : 1}
              strokeOpacity={highlight ? 0.85 : 0.35}
            />
          );
        })}
        {displayNodes.map((node) => {
          const p = layout.get(node.id);
          if (!p) return null;
          const sel = node.id === selectedId;
          const risk = Number(node.risk_score) || 0;
          const r = 6 + Math.min(risk / 15, 10);
          return (
            <g key={node.id} style={{ cursor: "pointer" }} onClick={() => setSelectedId(sel ? null : node.id)}>
              <circle
                cx={p.x}
                cy={p.y}
                r={r}
                fill={sel ? "rgb(24 24 27)" : "rgb(234 179 8)"}
                fillOpacity={sel ? 1 : 0.75}
              />
              <text
                x={p.x}
                y={p.y + r + 12}
                textAnchor="middle"
                className="fill-zinc-600"
                style={{ fontSize: 9 }}
              >
                {(node.label ?? node.node_ref_id).slice(0, 18)}
              </text>
            </g>
          );
        })}
      </svg>
      ) : view === "top_edges" ? (
        <ol className="max-h-[380px] space-y-1.5 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 text-xs text-zinc-700">
          {topEdges.length === 0 ? <li className="text-zinc-500">No edges in this snapshot.</li> : null}
          {topEdges.map((e, i) => (
            <li key={e.id} className="rounded border border-zinc-100 bg-surface px-2 py-1.5">
              <span className="font-medium tabular-nums text-zinc-900">#{i + 1}</span>
              {" · "}
              <span className="text-zinc-600">{e.relationship_type}</span>
              {" · propagation "}
              <span className="tabular-nums font-medium">{Number(e.propagation_risk).toFixed(1)}</span>
              <span className="mt-0.5 block text-[11px] text-zinc-500">
                {labelById.get(e.source_node_id) ?? e.source_node_id.slice(0, 8)}
                {" → "}
                {labelById.get(e.target_node_id) ?? e.target_node_id.slice(0, 8)}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
      {view === "ring" && selected ? (
        <div className="rounded-lg border border-zinc-100 bg-surface p-3 text-xs text-zinc-700">
          <p className="font-semibold text-zinc-900">
            {selected.node_type} · {selected.label ?? selected.node_ref_id}
          </p>
          <p className="mt-1">
            Risk {Number(selected.risk_score).toFixed(1)} · Concentration{" "}
            {Number(selected.concentration_score).toFixed(1)}
          </p>
          <p className="ui-eyebrow mt-2">Edges</p>
          <p className="ui-section-title mt-1 text-sm">Connected edges</p>
          <ul className="mt-1 list-inside list-disc text-zinc-600">
            {connectedEdges.length === 0 ? <li>None within the visible subgraph.</li> : null}
            {connectedEdges.map((e) => (
              <li key={e.id}>
                {e.relationship_type} (propagation {Number(e.propagation_risk).toFixed(1)})
                {e.explainability_json && typeof e.explainability_json.rule === "string" ? (
                  <span className="block text-zinc-500">Rule: {e.explainability_json.rule}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
