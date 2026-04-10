import Link from "next/link";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { AssuranceListCard } from "@/components/assurance/assurance-list-card";
import { getAuthContext } from "@/lib/supabase/server";
import { assertV6PageFeature } from "@/lib/v6/feature-guards";

function isLikelyContractId(ref: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ref.trim());
}

export default async function AssuranceScorecardsPage() {
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;
  assertV6PageFeature("v6AssuranceCore");

  const { data } = await ctx.admin
    .from("assurance_scorecards")
    .select("id, scorecard_type, entity_ref_id, overall_score, dimensions_json, score_drivers_json, updated_at")
    .eq("organization_id", ctx.orgId)
    .order("updated_at", { ascending: false })
    .limit(50);

  const topId = data?.[0]?.id as string | undefined;
  let priorSnapshot: { overall_score: number; snapshot_at: string } | null = null;
  if (topId) {
    const { data: snaps } = await ctx.admin
      .from("scorecard_snapshots")
      .select("overall_score, snapshot_at")
      .eq("organization_id", ctx.orgId)
      .eq("assurance_scorecard_id", topId)
      .order("snapshot_at", { ascending: false })
      .limit(2);
    priorSnapshot = snaps && snaps.length > 1 ? (snaps[1] as { overall_score: number; snapshot_at: string }) : null;
  }

  const ids = (data ?? []).map((r) => String(r.id));
  const snapshotTrailByScorecard = new Map<string, string>();
  if (ids.length > 0) {
    const { data: allSnaps } = await ctx.admin
      .from("scorecard_snapshots")
      .select("assurance_scorecard_id, overall_score, snapshot_at")
      .eq("organization_id", ctx.orgId)
      .in("assurance_scorecard_id", ids)
      .limit(500);

    const byCard = new Map<string, { score: number; at: string }[]>();
    for (const s of allSnaps ?? []) {
      const snap = s as { assurance_scorecard_id: string; overall_score: unknown; snapshot_at: string };
      const score = Number(snap.overall_score);
      if (!Number.isFinite(score) || !snap.snapshot_at) continue;
      const sid = String(snap.assurance_scorecard_id);
      const list = byCard.get(sid) ?? [];
      list.push({ score, at: snap.snapshot_at });
      byCard.set(sid, list);
    }
    for (const [sid, list] of byCard) {
      list.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
      const oldestFirst = list.slice(0, 5).reverse();
      if (oldestFirst.length >= 2) {
        snapshotTrailByScorecard.set(sid, oldestFirst.map((x) => x.score.toFixed(1)).join(" → "));
      }
    }
  }

  return (
    <AssuranceListCard
      title="Assurance scorecards"
      subtitle="Assurance"
      explainer={
        <p>
          Scores are explainable: drivers and dimensions are stored on each row. Compare the latest scorecard to its
          prior snapshot when history exists.
        </p>
      }
    >
      {priorSnapshot && data?.[0] ? (
        <p className="mb-3 text-xs text-zinc-600">
          Top scorecard vs prior snapshot:{" "}
          <span className="font-medium tabular-nums text-zinc-900">
            {Number(data[0].overall_score).toFixed(1)}
          </span>{" "}
          vs{" "}
          <span className="tabular-nums">{Number(priorSnapshot.overall_score).toFixed(1)}</span>{" "}
          <span className="text-zinc-400">({priorSnapshot.snapshot_at})</span>
        </p>
      ) : null}
      <ul className="space-y-2 text-sm">
        {(data ?? []).map((row) => {
          const dims = row.dimensions_json as Record<string, unknown> | null;
          const drivers = Array.isArray(row.score_drivers_json)
            ? (row.score_drivers_json as { label?: string; direction?: string; weight?: number }[])
            : [];
          const snapshotTrail = snapshotTrailByScorecard.get(String(row.id));
          return (
            <li key={row.id} className="rounded-lg border border-zinc-100 p-3">
              <p className="font-medium text-zinc-900">
                {row.scorecard_type}: {row.entity_ref_id}
              </p>
              <p className="mt-1 text-xs text-zinc-600">
                Overall <span className="font-semibold tabular-nums">{row.overall_score}</span>
              </p>
              {snapshotTrail ? (
                <p className="mt-1 text-[11px] text-zinc-500">
                  Recent snapshot scores (oldest → newest):{" "}
                  <span className="font-medium tabular-nums text-zinc-700">{snapshotTrail}</span>
                </p>
              ) : null}
              {dims && Object.keys(dims).length > 0 ? (
                <div className="mt-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Dimensions</p>
                  <ul className="mt-1 space-y-0.5 text-xs text-zinc-700">
                    {Object.entries(dims)
                      .slice(0, 12)
                      .map(([k, v]) => (
                        <li key={k} className="flex justify-between gap-2">
                          <span className="text-zinc-600">{k}</span>
                          <span className="tabular-nums font-medium">{typeof v === "number" ? v.toFixed(1) : String(v)}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              ) : null}
              {drivers.length > 0 ? (
                <div className="mt-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Drivers</p>
                  <ul className="mt-1 space-y-1 text-xs text-zinc-700">
                    {drivers.slice(0, 8).map((d, i) => (
                      <li key={i} className="rounded border border-zinc-100 bg-zinc-50/80 px-2 py-1">
                        <span className="font-medium">{d.label ?? "driver"}</span>
                        {d.direction ? <span className="text-zinc-500"> · {d.direction}</span> : null}
                        {d.weight != null ? (
                          <span className="tabular-nums text-zinc-600"> · weight {d.weight}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <p className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[11px]">
                <Link className="ui-link" href="/assurance/findings?status=open">
                  Open findings
                </Link>
                <span className="text-zinc-300">·</span>
                <Link className="ui-link" href="/assurance/health-graph">
                  Health graph
                </Link>
                {row.scorecard_type === "contract" && isLikelyContractId(row.entity_ref_id) ? (
                  <>
                    <span className="text-zinc-300">·</span>
                    <Link className="ui-link" href={`/contracts/${row.entity_ref_id}`}>
                      Contract record
                    </Link>
                  </>
                ) : null}
                {row.scorecard_type === "program" ? (
                  <>
                    <span className="text-zinc-300">·</span>
                    <Link className="ui-link" href="/contracts/programs">
                      Programs directory
                    </Link>
                  </>
                ) : null}
                {row.scorecard_type === "counterparty" ? (
                  <>
                    <span className="text-zinc-300">·</span>
                    <Link className="ui-link" href="/contracts">
                      Contracts (search counterparty)
                    </Link>
                  </>
                ) : null}
                <span className="text-zinc-300">·</span>
                <Link
                  className="ui-link"
                  href={`/api/assurance/scorecards/${encodeURIComponent(String(row.id))}/snapshots`}
                  target="_blank"
                >
                  Snapshots JSON
                </Link>
                <span className="text-zinc-300">·</span>
                <Link className="ui-link" href="/api/assurance/scorecards" target="_blank">
                  Scorecards API
                </Link>
              </p>
            </li>
          );
        })}
        {(data ?? []).length === 0 ? <li className="text-zinc-500">No scorecards yet.</li> : null}
      </ul>
      <p className="mt-4 text-xs text-zinc-600">
        <Link className="ui-link" href="/api/assurance/scorecards" target="_blank">
          Scorecards JSON
        </Link>
        {" · "}
        <Link className="ui-link" href="/api/assurance/health-graph" target="_blank">
          Health graph JSON
        </Link>
        {" · "}
        <Link className="ui-link" href="/api/assurance/check-runs?limit=40" target="_blank">
          Check runs JSON
        </Link>
        {" · "}
        <Link className="ui-link" href="/api/assurance/analytics/summary" target="_blank">
          Analytics summary
        </Link>
      </p>
    </AssuranceListCard>
  );
}
