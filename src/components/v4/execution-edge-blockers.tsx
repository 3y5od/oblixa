/** Count active edges where this entity is the `from` side of depends_on (waits on `to`). */
export function blockerCountForEntity(
  edges: Array<{
    from_entity_type: string;
    from_entity_id: string;
    to_entity_type: string;
    to_entity_id: string;
    status: string;
    relation_type: string;
  }>,
  entityType: string,
  entityId: string
): number {
  return edges.filter(
    (e) =>
      e.status === "active" &&
      e.relation_type === "depends_on" &&
      e.from_entity_type === entityType &&
      e.from_entity_id === entityId
  ).length;
}

export function BlockerChip({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-2 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-900">
      blocked by {count} upstream
    </span>
  );
}
