"use client";

import dynamic from "next/dynamic";
import type { ExecutionGraphEdgeRow } from "@/lib/v4/graph-edge-labels";

const ExecutionGraphViz = dynamic(
  () => import("./execution-graph-viz").then((m) => ({ default: m.ExecutionGraphViz })),
  {
    ssr: false,
    loading: () => <p className="ui-muted-tight text-sm">Loading execution graph…</p>,
  }
);

export function ExecutionGraphVizDynamic({ edges }: { edges: ExecutionGraphEdgeRow[] }) {
  return <ExecutionGraphViz edges={edges} />;
}
