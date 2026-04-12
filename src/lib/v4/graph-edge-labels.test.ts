import { describe, expect, it } from "vitest";
import { graphLinksForEntity, type ExecutionGraphEdgeRow } from "@/lib/v4/graph-edge-labels";

const task = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const other = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

describe("graphLinksForEntity", () => {
  it("returns empty when edges undefined or empty", () => {
    expect(graphLinksForEntity(undefined, "task", task)).toEqual({
      blockedBy: [],
      unblocks: [],
    });
    expect(graphLinksForEntity([], "task", task)).toEqual({
      blockedBy: [],
      unblocks: [],
    });
  });

  it("ignores non-active edges", () => {
    const edges: ExecutionGraphEdgeRow[] = [
      {
        from_entity_type: "a",
        from_entity_id: other,
        to_entity_type: "task",
        to_entity_id: task,
        relation_type: "blocks",
        status: "done",
      },
    ];
    expect(graphLinksForEntity(edges, "task", task).blockedBy).toHaveLength(0);
  });

  it("maps blockedBy and unblocks for active edges", () => {
    const edges: ExecutionGraphEdgeRow[] = [
      {
        from_entity_type: "obligation",
        from_entity_id: other,
        to_entity_type: "task",
        to_entity_id: task,
        relation_type: "requires",
        status: "active",
      },
      {
        from_entity_type: "task",
        from_entity_id: task,
        to_entity_type: "approval",
        to_entity_id: other,
        relation_type: "unblocks",
        status: "active",
      },
    ];
    const r = graphLinksForEntity(edges, "task", task);
    expect(r.blockedBy.some((s) => s.includes("requires"))).toBe(true);
    expect(r.unblocks.some((s) => s.includes("unblocks"))).toBe(true);
  });
});
