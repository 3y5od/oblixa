import Link from "next/link";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { AssuranceListCard } from "@/components/assurance/assurance-list-card";
import { SegmentRecomputeButton } from "@/components/assurance/segment-recompute-button";
import { ApiJsonLink } from "@/components/ui/api-json-link";
import { getAuthContext } from "@/lib/supabase/server";
import { collectSupabaseRangePages } from "@/lib/supabase/range-pagination";
import { assertV6PageFeature } from "@/lib/v6/feature-guards";

export default async function AssuranceSegmentsPage() {
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;
  assertV6PageFeature("v6Segments");

  const { data: segments } = await ctx.admin
    .from("segment_definitions")
    .select("id, segment_type, key, name, criteria_json, active, updated_at")
    .eq("organization_id", ctx.orgId)
    .order("updated_at", { ascending: false })
    .limit(50);

  type SegmentMembershipRow = { segment_definition_id: string; computed_at: string };
  const { rows: memRows } = await collectSupabaseRangePages<SegmentMembershipRow>(
    (from, to) =>
      ctx.admin
        .from("segment_memberships")
        .select("segment_definition_id, computed_at")
        .eq("organization_id", ctx.orgId)
        .range(from, to),
    { pageSize: 1000, maxRows: 250_000 }
  );

  const memberCountBySegment = new Map<string, number>();
  const lastComputedBySegment = new Map<string, string>();
  for (const m of memRows ?? []) {
    const sid = String(m.segment_definition_id);
    memberCountBySegment.set(sid, (memberCountBySegment.get(sid) ?? 0) + 1);
    const ca = String(m.computed_at);
    const prev = lastComputedBySegment.get(sid);
    if (!prev || ca > prev) lastComputedBySegment.set(sid, ca);
  }

  return (
    <AssuranceListCard
      title="Segments"
      subtitle="Assurance"
      explainer={
        <p>
          Portfolio segments drive policy assignments and rollups. <code className="rounded bg-[color:color-mix(in_oklab,var(--surface-muted)_88%,var(--canvas))] px-1">segmentType</code>{" "}
          must be one of: business_unit, region, product_line, contract_class, customer_tier, operational_tier,
          control_sensitivity_tier, or custom. Criteria support status, regions, program, contract type,
          counterparty substring, and <code className="rounded bg-[color:color-mix(in_oklab,var(--surface-muted)_88%,var(--canvas))] px-1">tags_any</code> (requires contract tags
          from migration 050). Optional <code className="rounded bg-[color:color-mix(in_oklab,var(--surface-muted)_88%,var(--canvas))] px-1">membership_entity_types</code> in{" "}
          <code className="rounded bg-[color:color-mix(in_oklab,var(--surface-muted)_88%,var(--canvas))] px-1">criteria_json</code> adds rollups for{" "}
          <code className="rounded bg-[color:color-mix(in_oklab,var(--surface-muted)_88%,var(--canvas))] px-1">account</code>, <code className="rounded bg-[color:color-mix(in_oklab,var(--surface-muted)_88%,var(--canvas))] px-1">counterparty</code>,{" "}
          <code className="rounded bg-[color:color-mix(in_oklab,var(--surface-muted)_88%,var(--canvas))] px-1">program</code>, <code className="rounded bg-[color:color-mix(in_oklab,var(--surface-muted)_88%,var(--canvas))] px-1">owner</code>,{" "}
          <code className="rounded bg-[color:color-mix(in_oklab,var(--surface-muted)_88%,var(--canvas))] px-1">team</code> (derived from matched contracts). Default is{" "}
          <code className="rounded bg-[color:color-mix(in_oklab,var(--surface-muted)_88%,var(--canvas))] px-1">[&quot;contract&quot;]</code> only. Create via{" "}
          <code className="rounded bg-[color:color-mix(in_oklab,var(--surface-muted)_88%,var(--canvas))] px-1">POST /api/segments</code>, recompute with{" "}
          <code className="rounded bg-[color:color-mix(in_oklab,var(--surface-muted)_88%,var(--canvas))] px-1">POST /api/segments/&#123;id&#125;/recompute</code>.
        </p>
      }
    >
      <ul className="space-y-2 text-sm">
        {(segments ?? []).map((row) => (
          <li key={row.id} className="rounded-lg border border-[var(--border-subtle)] p-3">
            <p className="font-medium text-[var(--text-primary)]">
              {row.name} <span className="text-[var(--text-tertiary)]">({row.key})</span>
            </p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Type {row.segment_type} · {row.active ? "active" : "inactive"} · Updated {String(row.updated_at)}
            </p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Members:{" "}
              <span className="font-semibold tabular-nums">{memberCountBySegment.get(String(row.id)) ?? 0}</span>
              {lastComputedBySegment.get(String(row.id)) ? (
                <>
                  {" "}
                  · Last membership run: {lastComputedBySegment.get(String(row.id))}
                </>
              ) : (
                <span className="text-[var(--text-tertiary)]"> · Not recomputed yet</span>
              )}
            </p>
            {row.active ? <SegmentRecomputeButton segmentId={String(row.id)} /> : null}
            <pre className="mt-2 max-h-32 overflow-auto rounded bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] p-2 text-[10px] text-[var(--text-secondary)]">
              {JSON.stringify(row.criteria_json ?? {}, null, 2)}
            </pre>
          </li>
        ))}
        {(segments ?? []).length === 0 ? <li className="text-[var(--text-tertiary)]">No segments yet.</li> : null}
      </ul>
      <p className="mt-4 text-xs text-[var(--text-secondary)]">
        <ApiJsonLink className="ui-link" href="/api/segments">
          Segments JSON
        </ApiJsonLink>
        {" · "}
        <ApiJsonLink className="ui-link" href="/api/assurance/analytics/summary">
          Analytics summary
        </ApiJsonLink>
        {" · "}
        <Link className="ui-link" href="/assurance">
          Back to assurance
        </Link>
      </p>
    </AssuranceListCard>
  );
}
