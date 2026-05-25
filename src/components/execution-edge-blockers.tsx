import { StatusBadge } from "@/components/ui/status-badge";

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
    <StatusBadge status="blocked" className="ml-2 text-[11px] font-medium">
      blocked by {count} upstream
    </StatusBadge>
  );
}
