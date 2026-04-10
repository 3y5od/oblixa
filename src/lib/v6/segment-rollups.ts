import type { AdminClient } from "@/lib/v6/service";
import type { SegmentCriteriaJson } from "@/lib/v6/segments";

export type SegmentRollupRow = {
  segment_id: string;
  key: string;
  name: string;
  member_count: number;
  criteria_summary: string;
};

/**
 * Lightweight segment membership counts for assurance check run summaries (v6.md §9.2 rollups).
 */
export async function buildSegmentRollupsForOrg(
  admin: AdminClient,
  orgId: string,
  maxSegments = 40
): Promise<SegmentRollupRow[]> {
  const { data: segs } = await admin
    .from("segment_definitions")
    .select("id, key, name, criteria_json")
    .eq("organization_id", orgId)
    .eq("active", true)
    .order("updated_at", { ascending: false })
    .limit(maxSegments);

  const rollups: SegmentRollupRow[] = [];
  for (const s of segs ?? []) {
    const { count } = await admin
      .from("segment_memberships")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("segment_definition_id", String((s as { id: string }).id));
    const cj = (s as { criteria_json?: unknown }).criteria_json as SegmentCriteriaJson | undefined;
    const parts: string[] = [];
    if (cj?.contract_status_in?.length) parts.push(`status∈${cj.contract_status_in.join(",")}`);
    if (cj?.regions?.length) parts.push(`region∈${cj.regions.join(",")}`);
    if (cj?.counterparty_contains) parts.push(`counterparty~${cj.counterparty_contains}`);
    if (cj?.program_id) parts.push(`program=${cj.program_id}`);
    if (cj?.contract_type_equals) parts.push(`type=${cj.contract_type_equals}`);
    if (cj?.tags_any?.length) parts.push(`tags:${cj.tags_any.join("|")}`);
    if (cj?.membership_entity_types?.length) parts.push(`members:${cj.membership_entity_types.join(",")}`);
    rollups.push({
      segment_id: String((s as { id: string }).id),
      key: String((s as { key: string }).key),
      name: String((s as { name: string }).name),
      member_count: count ?? 0,
      criteria_summary: parts.length ? parts.join("; ") : "criteria (default / empty)",
    });
  }
  return rollups;
}
