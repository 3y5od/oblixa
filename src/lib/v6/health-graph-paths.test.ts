import { describe, expect, it } from "vitest";
import { summarizePropagationPaths, summarizeThreeHopPropagationPaths } from "@/lib/v6/health-graph-paths";

describe("summarizePropagationPaths", () => {
  it("ranks two-hop paths by bottleneck risk", () => {
    const nodes = [
      { id: "a", node_type: "contract", node_ref_id: "c1", label: "Alpha" },
      { id: "b", node_type: "counterparty", node_ref_id: "cp", label: "Beta" },
      { id: "c", node_type: "campaign", node_ref_id: "camp", label: null },
    ];
    const edges = [
      {
        id: "e1",
        source_node_id: "a",
        target_node_id: "b",
        relationship_type: "exposure",
        propagation_risk: 8,
      },
      {
        id: "e2",
        source_node_id: "b",
        target_node_id: "c",
        relationship_type: "rollup",
        propagation_risk: 3,
      },
    ];
    const paths = summarizePropagationPaths(nodes, edges, { limit: 5 });
    expect(paths).toHaveLength(1);
    expect(paths[0].hops).toBe(2);
    expect(paths[0].bottleneck_risk).toBe(3);
    expect(paths[0].edge_ids).toEqual(["e1", "e2"]);
    expect(paths[0].relationship_types).toEqual(["exposure", "rollup"]);
    expect(paths[0].path_label).toContain("Alpha");
    expect(paths[0].path_label).toContain("Beta");
  });

  it("finds a three-hop chain with bottleneck from the weakest edge", () => {
    const nodes = [
      { id: "a", node_type: "contract", node_ref_id: "c1" },
      { id: "b", node_type: "counterparty", node_ref_id: "cp" },
      { id: "c", node_type: "program", node_ref_id: "p1" },
      { id: "d", node_type: "campaign", node_ref_id: "m1" },
    ];
    const edges = [
      { id: "e1", source_node_id: "a", target_node_id: "b", relationship_type: "x", propagation_risk: 9 },
      { id: "e2", source_node_id: "b", target_node_id: "c", relationship_type: "y", propagation_risk: 4 },
      { id: "e3", source_node_id: "c", target_node_id: "d", relationship_type: "z", propagation_risk: 7 },
    ];
    const paths = summarizeThreeHopPropagationPaths(nodes, edges, { limit: 5 });
    expect(paths).toHaveLength(1);
    expect(paths[0].hops).toBe(3);
    expect(paths[0].bottleneck_risk).toBe(4);
    expect(paths[0].edge_ids).toEqual(["e1", "e2", "e3"]);
  });

  it("returns empty when no two-hop path exists", () => {
    const nodes = [
      { id: "a", node_type: "x", node_ref_id: "1" },
      { id: "b", node_type: "y", node_ref_id: "2" },
    ];
    const edges = [
      {
        id: "e1",
        source_node_id: "a",
        target_node_id: "b",
        relationship_type: "only",
        propagation_risk: 5,
      },
    ];
    expect(summarizePropagationPaths(nodes, edges)).toEqual([]);
  });
});
