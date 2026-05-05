import type { AdminClient } from "@/lib/v6/service";

function safeNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export type OutcomeInterventionRow = {
  id: string;
  intervention_type: string;
  intervention_ref_id: string | null;
  effectiveness_score: number;
  analyzed_at: string;
  recurrence_delta: number;
  time_to_stability_hours: number | null;
  source_playbook_run_id: string | null;
  source_campaign_id: string | null;
  source_control_policy_id: string | null;
  recommendation_effectiveness_json: Record<string, unknown>;
};

/**
 * Paginated raw analyses for APIs and drill-down UIs.
 */
export async function listOutcomeInterventionsPaginated(
  admin: AdminClient,
  orgId: string,
  opts: { limit: number; offset: number }
): Promise<{ rows: OutcomeInterventionRow[]; total: number; error: { message: string } | null }> {
  const limit = Math.min(100, Math.max(1, opts.limit));
  const offset = Math.max(0, opts.offset);
  const { data, error, count } = await admin
    .from("outcome_intervention_analyses")
    .select(
      "id, intervention_type, intervention_ref_id, effectiveness_score, analyzed_at, recurrence_delta, time_to_stability_hours, source_playbook_run_id, source_campaign_id, source_control_policy_id, recommendation_effectiveness_json",
      { count: "exact" }
    )
    .eq("organization_id", orgId)
    .order("analyzed_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return { rows: [], total: 0, error };
  }

  const rows = (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: String(row.id),
      intervention_type: String(row.intervention_type ?? ""),
      intervention_ref_id: row.intervention_ref_id != null ? String(row.intervention_ref_id) : null,
      effectiveness_score: safeNum(row.effectiveness_score ?? 0),
      analyzed_at: String(row.analyzed_at ?? ""),
      recurrence_delta: safeNum(row.recurrence_delta ?? 0),
      time_to_stability_hours:
        row.time_to_stability_hours != null && row.time_to_stability_hours !== ""
          ? safeNum(row.time_to_stability_hours)
          : null,
      source_playbook_run_id: row.source_playbook_run_id != null ? String(row.source_playbook_run_id) : null,
      source_campaign_id: row.source_campaign_id != null ? String(row.source_campaign_id) : null,
      source_control_policy_id: row.source_control_policy_id != null ? String(row.source_control_policy_id) : null,
      recommendation_effectiveness_json:
        row.recommendation_effectiveness_json &&
        typeof row.recommendation_effectiveness_json === "object" &&
        row.recommendation_effectiveness_json !== null
          ? (row.recommendation_effectiveness_json as Record<string, unknown>)
          : {},
    };
  });

  return { rows, total: count ?? rows.length, error: null };
}

export async function computeOutcomeViews(admin: AdminClient, orgId: string) {
  const { data: rows, error, count } = await admin
    .from("outcome_intervention_analyses")
    .select("id, intervention_type, effectiveness_score, analyzed_at, recurrence_delta", { count: "exact" })
    .eq("organization_id", orgId)
    .order("analyzed_at", { ascending: false })
    .limit(500);

  if (error)
    return {
      error,
      complete: false,
      truncated: false,
      scanned: 0,
      total: 0,
      interventions: [],
      programEffectiveness: {},
      controlEffectiveness: {},
      playbookEffectiveness: {},
      weeklyEffectiveness: [],
      summary: null,
    };

  const interventions = rows ?? [];
  const total = count ?? interventions.length;
  const truncated = total > interventions.length;
  const grouped = interventions.reduce(
    (acc: Record<string, { count: number; total: number }>, row) => {
      const typedRow = row as { intervention_type?: string; effectiveness_score?: number | string };
      const key = String(typedRow.intervention_type || "unknown");
      const next = acc[key] ?? { count: 0, total: 0 };
      next.count += 1;
      next.total += safeNum(typedRow.effectiveness_score ?? 0);
      acc[key] = next;
      return acc;
    },
    {}
  );

  const toAverage = (prefix: string) =>
    Object.fromEntries(
      Object.entries(grouped)
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, value]) => {
          const bucket = value as { count: number; total: number };
          return [key, safeNum((bucket.total / Math.max(1, bucket.count)).toFixed(2))];
        })
    );

  const weeklySeries = weeklyEffectivenessSeries(interventions as { analyzed_at?: string; effectiveness_score?: number }[]);

  const scores = interventions.map((r) => safeNum((r as { effectiveness_score?: number }).effectiveness_score ?? 0));
  const overallAvgEffectiveness =
    scores.length > 0 ? safeNum((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)) : null;

  const last4 = weeklySeries.slice(-4);
  const prior4 = weeklySeries.slice(-8, -4);
  const recentAvg =
    last4.length > 0
      ? last4.reduce((s, w) => s + w.avgScore, 0) / last4.length
      : null;
  const priorAvg =
    prior4.length > 0
      ? prior4.reduce((s, w) => s + w.avgScore, 0) / prior4.length
      : null;
  const effectivenessTrendDelta =
    recentAvg != null && priorAvg != null ? Number((recentAvg - priorAvg).toFixed(2)) : null;

  return {
    interventions,
    complete: !truncated,
    truncated,
    scanned: interventions.length,
    total,
    programEffectiveness: toAverage("program"),
    controlEffectiveness: toAverage("control"),
    playbookEffectiveness: toAverage("playbook"),
    weeklyEffectiveness: weeklySeries,
    summary: {
      overallAvgEffectiveness,
      effectivenessTrendDelta,
      analysesCount: interventions.length,
    },
    error: null,
  };
}

function weeklyEffectivenessSeries(
  rows: { analyzed_at?: string; effectiveness_score?: number }[]
): { week: string; avgScore: number; count: number }[] {
  const buckets = new Map<string, { sum: number; n: number }>();
  for (const r of rows) {
    const at = r.analyzed_at ? new Date(r.analyzed_at) : null;
    if (!at || Number.isNaN(at.getTime())) continue;
    const key = at.toISOString().slice(0, 7);
    const b = buckets.get(key) ?? { sum: 0, n: 0 };
    b.sum += safeNum(r.effectiveness_score ?? 0);
    b.n += 1;
    buckets.set(key, b);
  }
  return Array.from(buckets.entries())
    .map(([week, v]) => ({ week, avgScore: safeNum((v.sum / Math.max(1, v.n)).toFixed(2)), count: v.n }))
    .sort((a, b) => a.week.localeCompare(b.week))
    .slice(-12);
}
