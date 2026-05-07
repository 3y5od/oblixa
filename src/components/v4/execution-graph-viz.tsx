"use client";

import type { ExecutionGraphEdgeRow } from "@/lib/v4/graph-edge-labels";

function shortId(id: string) {
  return id.slice(0, 8);
}

function labelFor(type: string, id: string) {
  return `${type.replace(/_/g, " ")} · ${shortId(id)}`;
}

export function ExecutionGraphViz({ edges }: { edges: ExecutionGraphEdgeRow[] }) {
  const active = edges.filter((e) => e.status === "active");
  if (active.length === 0) {
    return (
      <p className="text-sm text-[var(--text-tertiary)]">No active dependency edges for this contract.</p>
    );
  }

  const keys = new Set<string>();
  for (const e of active) {
    keys.add(`${e.from_entity_type}:${e.from_entity_id}`);
    keys.add(`${e.to_entity_type}:${e.to_entity_id}`);
  }
  const nodeList = Array.from(keys);
  const colGap = 200;
  const rowGap = 56;
  const cols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(nodeList.length))));
  const positions = new Map<string, { x: number; y: number }>();
  nodeList.forEach((key, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions.set(key, { x: 40 + col * colGap, y: 36 + row * rowGap });
  });

  const width = Math.max(400, cols * colGap + 80);
  const height = Math.max(200, (Math.ceil(nodeList.length / cols) || 1) * rowGap + 80);

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)] bg-surface">
      <svg width={width} height={height} className="text-[var(--text-primary)]" aria-label="Execution dependency graph">
        <defs>
          <marker
            id="arrowhead"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="4"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L8,4 L0,8 z" fill="currentColor" className="text-[var(--text-tertiary)]" />
          </marker>
        </defs>
        {active.map((e, idx) => {
          const fromK = `${e.from_entity_type}:${e.from_entity_id}`;
          const toK = `${e.to_entity_type}:${e.to_entity_id}`;
          const a = positions.get(fromK);
          const b = positions.get(toK);
          if (!a || !b) return null;
          return (
            <line
              key={e.id ?? `e-${idx}-${fromK}-${toK}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="currentColor"
              strokeWidth={1.25}
              className="text-[var(--text-tertiary)]"
              markerEnd="url(#arrowhead)"
            />
          );
        })}
        {nodeList.map((key) => {
          const p = positions.get(key);
          if (!p) return null;
          const sep = key.indexOf(":");
          const type = sep === -1 ? key : key.slice(0, sep);
          const id = sep === -1 ? "" : key.slice(sep + 1);
          return (
            <g key={key} transform={`translate(${p.x - 70},${p.y - 14})`}>
              <rect width={140} height={28} rx={6} className="fill-[var(--surface-muted)] stroke-[var(--border-subtle)]" strokeWidth={1} />
              <text
                x={70}
                y={18}
                textAnchor="middle"
                fill="var(--text-primary)"
                style={{ fontSize: "10px", fontWeight: 600 }}
              >
                {labelFor(type, id)}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="border-t border-[var(--border-subtle)] px-3 py-2 text-[11px] text-[var(--text-tertiary)]">
        Arrows follow stored edges (from → to). Relation: {active[0]?.relation_type ?? "depends_on"}.
      </p>
    </div>
  );
}
