export type ExecutionGraphEdgeRow = {
  id?: string;
  from_entity_type: string;
  from_entity_id: string;
  to_entity_type: string;
  to_entity_id: string;
  relation_type: string;
  status: string;
};

function short(id: string) {
  return id.slice(0, 8);
}

export function graphLinksForEntity(
  edges: ExecutionGraphEdgeRow[] | undefined,
  entityType: string,
  entityId: string
): { blockedBy: string[]; unblocks: string[] } {
  if (!edges?.length) return { blockedBy: [], unblocks: [] };
  const active = edges.filter((e) => e.status === "active");
  const blockedBy = active
    .filter((e) => e.to_entity_type === entityType && e.to_entity_id === entityId)
    .map((e) => `${e.from_entity_type} · ${short(e.from_entity_id)} · ${e.relation_type}`);
  const unblocks = active
    .filter((e) => e.from_entity_type === entityType && e.from_entity_id === entityId)
    .map((e) => `${e.relation_type} → ${e.to_entity_type} · ${short(e.to_entity_id)}`);
  return { blockedBy, unblocks };
}
