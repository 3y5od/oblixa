/**
 * Human-readable labels for keys written to `org_behavior_metrics.v5_signal_quality_json`
 * via `incrementOrgV5SignalQuality`. Keep in sync with call sites (grep the helper).
 */
export const V5_SIGNAL_QUALITY_KEY_LABELS: Record<string, string> = {
  v5_decisions_closed: "Decision workspaces closed",
  v5_campaigns_closed: "Campaigns closed",
  v5_recommendation_accepted: "Recommendations accepted",
  v5_recommendation_dismissed: "Recommendations dismissed",
  v5_campaign_progress_cron_updates: "Campaign progress cron updates (rows)",
  v5_capacity_forecast_cron_runs: "Capacity forecast cron runs",
  v5_recommendation_refresh_cron_runs: "Recommendation refresh cron runs",
};

export type V5SignalQualityDisplayRow = { key: string; label: string; value: number };

/** Turns merged JSON into sorted display rows (numeric values only). */
export function parseV5SignalQualityForDisplay(raw: unknown): V5SignalQualityDisplayRow[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const obj = raw as Record<string, unknown>;
  const rows: V5SignalQualityDisplayRow[] = [];
  for (const [key, v] of Object.entries(obj)) {
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    rows.push({
      key,
      label: V5_SIGNAL_QUALITY_KEY_LABELS[key] ?? key,
      value: v,
    });
  }
  rows.sort((a, b) => a.label.localeCompare(b.label));
  return rows;
}
