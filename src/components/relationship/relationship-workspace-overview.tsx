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
    <section className="ui-page-shell p-5">
      <p className="ui-eyebrow">Relationship</p>
      <h2 className="ui-page-title mt-1 text-[1.6rem]">Portfolio signals</h2>
      <p className="ui-section-lead mt-2">
        Live counts from linked contracts on this page load. Cron rollups also persist overlapping fields into
        workspace JSON.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="ui-metric-chip">
          Health hint: {riskHint}
        </span>
        {rollupAt ? (
          <span className="ui-support-copy text-xs">Rollup / computed: {rollupAt}</span>
        ) : null}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((t) => (
          <div key={t.label} className="ui-operational-card px-3 py-3">
            <p className="text-lg font-semibold tabular-nums text-[var(--text-primary)]">{t.value}</p>
            <p className="ui-meta mt-1 leading-snug">{t.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
