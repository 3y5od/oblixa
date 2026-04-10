import Link from "next/link";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { AssuranceListCard } from "@/components/assurance/assurance-list-card";
import { SegmentRecomputeButton } from "@/components/assurance/segment-recompute-button";
import { getAuthContext } from "@/lib/supabase/server";
import { assertV6PageFeature } from "@/lib/v6/feature-guards";

export default async function AssuranceSegmentsPage() {
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;
  assertV6PageFeature("v6Segments");

  const [{ data: segments }, { data: memRows }] = await Promise.all([
    ctx.admin
      .from("segment_definitions")
      .select("id, segment_type, key, name, criteria_json, active, updated_at")
      .eq("organization_id", ctx.orgId)
      .order("updated_at", { ascending: false })
      .limit(50),
    ctx.admin
      .from("segment_memberships")
      .select("segment_definition_id, computed_at")
      .eq("organization_id", ctx.orgId)
      .limit(8000),
  ]);

  const memberCountBySegment = new Map<string, number>();
  const lastComputedBySegment = new Map<string, string>();
  for (const m of memRows ?? []) {
    const sid = String((m as { segment_definition_id: string }).segment_definition_id);
    memberCountBySegment.set(sid, (memberCountBySegment.get(sid) ?? 0) + 1);
    const ca = String((m as { computed_at: string }).computed_at);
    const prev = lastComputedBySegment.get(sid);
    if (!prev || ca > prev) lastComputedBySegment.set(sid, ca);
  }

  return (
    <AssuranceListCard
      title="Segments"
      subtitle="Assurance"
      explainer={
        <p>
          Portfolio segments drive policy assignments and rollups. <code className="rounded bg-zinc-100 px-1">segmentType</code>{" "}
          must be one of: business_unit, region, product_line, contract_class, customer_tier, operational_tier,
          control_sensitivity_tier, or custom (see v6.md segments section). Criteria support status, regions, program, contract type,
          counterparty substring, and <code className="rounded bg-zinc-100 px-1">tags_any</code> (requires contract tags
          from migration 050). Optional <code className="rounded bg-zinc-100 px-1">membership_entity_types</code> in{" "}
          <code className="rounded bg-zinc-100 px-1">criteria_json</code> adds rollups for{" "}
          <code className="rounded bg-zinc-100 px-1">account</code>, <code className="rounded bg-zinc-100 px-1">counterparty</code>,{" "}
          <code className="rounded bg-zinc-100 px-1">program</code>, <code className="rounded bg-zinc-100 px-1">owner</code>,{" "}
          <code className="rounded bg-zinc-100 px-1">team</code> (derived from matched contracts). Default is{" "}
          <code className="rounded bg-zinc-100 px-1">[&quot;contract&quot;]</code> only. Create via{" "}
          <code className="rounded bg-zinc-100 px-1">POST /api/segments</code>, recompute with{" "}
          <code className="rounded bg-zinc-100 px-1">POST /api/segments/&#123;id&#125;/recompute</code>.
        </p>
      }
    >
      <ul className="space-y-2 text-sm">
        {(segments ?? []).map((row) => (
          <li key={row.id} className="rounded-lg border border-zinc-100 p-3">
            <p className="font-medium text-zinc-900">
              {row.name} <span className="text-zinc-500">({row.key})</span>
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              Type {row.segment_type} · {row.active ? "active" : "inactive"} · Updated {String(row.updated_at)}
            </p>
            <p className="mt-1 text-xs text-zinc-700">
              Members:{" "}
              <span className="font-semibold tabular-nums">{memberCountBySegment.get(String(row.id)) ?? 0}</span>
              {lastComputedBySegment.get(String(row.id)) ? (
                <>
                  {" "}
                  · Last membership run: {lastComputedBySegment.get(String(row.id))}
                </>
              ) : (
                <span className="text-zinc-500"> · Not recomputed yet</span>
              )}
            </p>
            {row.active ? <SegmentRecomputeButton segmentId={String(row.id)} /> : null}
            <pre className="mt-2 max-h-32 overflow-auto rounded bg-zinc-50 p-2 text-[10px] text-zinc-600">
              {JSON.stringify(row.criteria_json ?? {}, null, 2)}
            </pre>
          </li>
        ))}
        {(segments ?? []).length === 0 ? <li className="text-zinc-500">No segments yet.</li> : null}
      </ul>
      <p className="mt-4 text-xs text-zinc-600">
        <Link className="ui-link" href="/api/segments" target="_blank">
          Segments JSON
        </Link>
        {" · "}
        <Link className="ui-link" href="/api/assurance/analytics/summary" target="_blank">
          Analytics summary
        </Link>
        {" · "}
        <Link className="ui-link" href="/assurance">
          Back to assurance
        </Link>
      </p>
    </AssuranceListCard>
  );
}
