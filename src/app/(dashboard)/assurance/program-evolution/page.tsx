import Link from "next/link";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { AssuranceListCard } from "@/components/assurance/assurance-list-card";
import {
  ProgramEvolutionAdvanceRolloutButton,
  ProgramEvolutionCreateForm,
  ProgramEvolutionRecordResultButton,
  ProgramEvolutionSimulateButton,
} from "@/components/assurance/program-evolution-form";
import { ApiJsonLink } from "@/components/ui/api-json-link";
import { getAuthContext } from "@/lib/supabase/server";
import { assertV6PageFeature } from "@/lib/v6/feature-guards";

export default async function ProgramEvolutionPage() {
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;
  assertV6PageFeature("v6AssuranceCore");

  const { data } = await ctx.admin
    .from("program_evolution_experiments")
    .select("id, status, hypothesis, simulation_summary_json, rollout_plan_json, updated_at")
    .eq("organization_id", ctx.orgId)
    .order("updated_at", { ascending: false })
    .limit(40);

  const expIds = (data ?? []).map((row) => String(row.id));
  const { data: resultRows } =
    expIds.length > 0
      ? await ctx.admin
          .from("program_evolution_results")
          .select(
            "id, experiment_id, period_start, period_end, health_impact_json, scorecard_delta_json, created_at"
          )
          .eq("organization_id", ctx.orgId)
          .in("experiment_id", expIds)
          .order("created_at", { ascending: false })
          .limit(120)
      : { data: [] as never[] };

  const resultsByExperiment = new Map<
    string,
    {
      id: string;
      experiment_id: string;
      period_start: string | null;
      period_end: string | null;
      health_impact_json: unknown;
      scorecard_delta_json: unknown;
      created_at: string;
    }[]
  >();
  for (const r of resultRows ?? []) {
    const row = r as {
      id: string;
      experiment_id: string;
      period_start: string | null;
      period_end: string | null;
      health_impact_json: unknown;
      scorecard_delta_json: unknown;
      created_at: string;
    };
    const eid = String(row.experiment_id);
    const list = resultsByExperiment.get(eid) ?? [];
    list.push(row);
    resultsByExperiment.set(eid, list);
  }

  return (
    <AssuranceListCard
      title="Program evolution studio"
      subtitle="Assurance"
      explainer={
        <div className="space-y-2">
          <p>
            Compare program versions, run simulations, stage rollout to a segment, and record health impact. Use the
            API to create experiments and record results.
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            <strong className="font-medium text-[var(--text-primary)]">Guided flow:</strong> simulate on a narrow segment → start an
            experiment run → record periodic results while watching assurance scorecards and findings → expand rollout in{" "}
            <code className="rounded bg-[color:color-mix(in_oklab,var(--surface-muted)_88%,var(--canvas))] px-1">rollout_plan_json</code> when health impact stays positive. Past
            performance by version is visible via linked program IDs and stored{" "}
            <code className="rounded bg-[color:color-mix(in_oklab,var(--surface-muted)_88%,var(--canvas))] px-1">health_impact_json</code> /{" "}
            <code className="rounded bg-[color:color-mix(in_oklab,var(--surface-muted)_88%,var(--canvas))] px-1">scorecard_delta_json</code> on each result row.
          </p>
        </div>
      }
    >
      <p className="text-sm">
        <Link className="ui-link" href="/contracts/programs">
          Open programs directory
        </Link>{" "}
        to pick baseline and candidate versions for experiments.
      </p>
      <ProgramEvolutionCreateForm />
      <p className="mt-4 text-xs text-[var(--text-tertiary)]">
        <ApiJsonLink className="ui-link" href="/api/program-evolution/experiments">
          GET experiments (JSON)
        </ApiJsonLink>
        {" · "}
        <ApiJsonLink className="ui-link" href="/api/assurance/analytics/summary">
          Assurance analytics summary
        </ApiJsonLink>
        {" · "}
        <ApiJsonLink className="ui-link" href="/api/assurance/check-runs?limit=40">
          Check runs JSON
        </ApiJsonLink>
      </p>
      <ul className="mt-4 space-y-2 text-sm">
        {(data ?? []).map((row) => (
          <li key={row.id} className="ui-support-panel p-3">
            <p className="font-medium text-[var(--text-primary)]">{row.hypothesis ?? "Experiment"}</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Status {row.status} · Updated {String(row.updated_at)}
            </p>
            {row.status === "draft" ? <ProgramEvolutionSimulateButton experimentId={String(row.id)} /> : null}
            {row.status === "simulated" || row.status === "running" ? (
              <ProgramEvolutionAdvanceRolloutButton experimentId={String(row.id)} />
            ) : null}
            {row.status === "simulated" || row.status === "running" ? (
              <ProgramEvolutionRecordResultButton experimentId={String(row.id)} />
            ) : null}
            {(resultsByExperiment.get(String(row.id)) ?? []).length > 0 ? (
              <ul className="mt-2 space-y-1 text-[11px] text-[var(--text-secondary)]">
                {(resultsByExperiment.get(String(row.id)) ?? []).slice(0, 5).map((res) => (
                  <li key={res.id} className="ui-soft-details px-2 py-1">
                    {String(res.created_at)}
                    {res.period_start ? ` · period ${res.period_start}` : ""}
                    {res.health_impact_json &&
                    typeof res.health_impact_json === "object" &&
                    Object.keys(res.health_impact_json as object).length > 0 ? (
                      <pre className="mt-1 max-h-20 overflow-auto font-mono text-[11px] text-[var(--text-tertiary)]">
                        {JSON.stringify(res.health_impact_json, null, 2)}
                      </pre>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {row.simulation_summary_json && Object.keys(row.simulation_summary_json as object).length > 0 ? (
              <div className="mt-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Simulation summary</p>
                <pre className="ui-soft-details mt-1 max-h-36 overflow-auto p-2 text-[11px] text-[var(--text-secondary)]">
                  {JSON.stringify(row.simulation_summary_json, null, 2)}
                </pre>
              </div>
            ) : null}
            {row.rollout_plan_json && Object.keys(row.rollout_plan_json as object).length > 0 ? (
              <div className="mt-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Rollout plan</p>
                <pre className="ui-alert-warning mt-1 max-h-24 overflow-auto p-2 text-[11px] text-[var(--text-secondary)]">
                  {JSON.stringify(row.rollout_plan_json, null, 2)}
                </pre>
              </div>
            ) : null}
          </li>
        ))}
        {(data ?? []).length === 0 ? <li className="text-[var(--text-tertiary)]">No experiments yet.</li> : null}
      </ul>
    </AssuranceListCard>
  );
}
