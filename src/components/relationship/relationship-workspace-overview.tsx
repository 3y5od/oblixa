import type { RelationshipKeyMetrics } from "@/lib/v5/relationship-key-metrics";

type Props = {
  healthSignalJson: unknown;
  summaryJson: unknown;
  liveMetrics: RelationshipKeyMetrics;
};

function readRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export function RelationshipWorkspaceOverview({ healthSignalJson, summaryJson, liveMetrics }: Props) {
  const health = readRecord(healthSignalJson);
  const summary = readRecord(summaryJson);
  const riskHint = typeof health.risk_hint === "string" ? health.risk_hint : "—";
  const rollupAt =
    typeof summary.refreshed_at === "string"
      ? new Date(summary.refreshed_at).toLocaleString()
      : typeof liveMetrics.computed_at === "string"
        ? new Date(liveMetrics.computed_at).toLocaleString()
        : null;

  const tiles: { label: string; value: number | string }[] = [
    { label: "Contracts (page sample)", value: liveMetrics.contract_sample_size },
    { label: "Pending approvals", value: liveMetrics.pending_approvals },
    { label: "Open tasks", value: liveMetrics.open_tasks },
    { label: "Evidence required", value: liveMetrics.unsatisfied_evidence },
    { label: "Open attestations", value: liveMetrics.open_attestations },
    { label: "Campaign links (active)", value: liveMetrics.active_campaign_contract_links },
    { label: "Active program assignments", value: liveMetrics.active_program_assignments },
    { label: "Open exceptions", value: liveMetrics.open_exceptions },
    { label: "Open obligations", value: liveMetrics.open_obligations },
    { label: "Renewal checkpoints (pending)", value: liveMetrics.renewal_checkpoints_open },
  ];

  return (
    <section className="ui-card p-5">
      <p className="ui-label-caps">Portfolio signals (this relationship)</p>
      <p className="mt-1 text-xs text-zinc-500">
        Live counts from linked contracts on this page load. Cron rollups also persist overlapping fields into
        workspace JSON.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-800">
          Health hint: {riskHint}
        </span>
        {rollupAt ? (
          <span className="text-xs text-zinc-500">Rollup / computed: {rollupAt}</span>
        ) : null}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-zinc-100 bg-zinc-50/80 px-3 py-2">
            <p className="text-lg font-semibold text-zinc-900">{t.value}</p>
            <p className="text-[11px] leading-snug text-zinc-500">{t.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
