import Link from "next/link";
import { LineChart, Megaphone } from "lucide-react";
import { CapacityReassignmentPlannerForm } from "@/components/reports/capacity-reassignment-planner-form";
import { RecommendationRowActions } from "@/components/reports/recommendation-row-actions";
import { ApiJsonLink } from "@/components/ui/api-json-link";
import {
  OperationalSectionHeader,
  OperationalSummaryCard,
} from "@/components/ui/operational-summary-card";
import { CAPACITY_FORECAST_JSON_KEYS } from "@/lib/decision-intelligence/capacity-forecast-keys";

type ForecastRow = {
  id: string;
  forecast_horizon_days: number | null;
  forecast_json: unknown;
  generated_at: string;
};

type RecommendationRow = {
  id: string;
  recommendation_type: string;
  priority: string;
  accepted: boolean | null;
  dismissed: boolean | null;
};

type CampaignRow = { id: string; name: string; status: string };

export function ReportsCapacityCampaignsSection(props: {
  simOn: boolean;
  forecasts: ForecastRow[] | null | undefined;
  recommendations: RecommendationRow[] | null | undefined;
  activeCampaigns: CampaignRow[] | null | undefined;
  deltaTasks: number | null;
  deltaStalledDecisions: number | null;
  latestOpenTasks: number | null;
  latestPendingApprovals: number | null;
  showCampaignSurfaces: boolean;
  showDecisionSignals: boolean;
  showAnalyticsLinks: boolean;
}) {
  return (
    <section id="capacity-forecasts" className="grid scroll-mt-8 gap-4 lg:grid-cols-3">
      <ForecastSummaryCard {...props} />
      <ReassignmentPlannerCard {...props} />
      <RecommendationsCard {...props} />
      {props.showCampaignSurfaces ? <CampaignDriftCard activeCampaigns={props.activeCampaigns ?? []} /> : null}
    </section>
  );
}

function ForecastSummaryCard(props: {
  simOn: boolean;
  forecasts: ForecastRow[] | null | undefined;
  deltaTasks: number | null;
  deltaStalledDecisions: number | null;
  showDecisionSignals: boolean;
  showAnalyticsLinks: boolean;
}) {
  const forecasts = props.forecasts ?? [];
  return (
    <OperationalSummaryCard
      eyebrow="Capacity"
      headline="Forecasts"
      tone="neutral"
      icon={LineChart}
      primaryValue={forecasts.length}
      primaryUnit="recent runs"
      breakdown={[
        ...(props.deltaTasks !== null
          ? [{ label: "Δ open tasks", value: props.deltaTasks > 0 ? `+${props.deltaTasks}` : String(props.deltaTasks) }]
          : []),
        ...(props.showDecisionSignals && props.deltaStalledDecisions !== null
          ? [
              {
                label: "Δ stalled decisions",
                value:
                  props.deltaStalledDecisions > 0
                    ? `+${props.deltaStalledDecisions}`
                    : String(props.deltaStalledDecisions),
              },
            ]
          : []),
      ]}
      action={
        props.showAnalyticsLinks
          ? { href: "/api/capacity/forecast", label: "Forecast JSON", external: true }
          : { href: "/reports#capacity-forecasts", label: "Forecast details" }
      }
      variant="compact"
      footerExtra={<ForecastRows forecasts={forecasts} simOn={props.simOn} showAnalyticsLinks={props.showAnalyticsLinks} />}
    />
  );
}

function ForecastRows({
  forecasts,
  simOn,
  showAnalyticsLinks,
}: {
  forecasts: ForecastRow[];
  simOn: boolean;
  showAnalyticsLinks: boolean;
}) {
  return (
    <div className="mt-3 space-y-2 text-[11px] text-[var(--text-secondary)]">
      {simOn && showAnalyticsLinks ? (
        <p>
          Tie to{" "}
          <Link href="/reports#portfolio-signals" className="ui-link">
            portfolio signals
          </Link>{" "}
          before rebalancing ownership.
        </p>
      ) : null}
      <ul className="space-y-1.5 text-[var(--text-secondary)]">
        {forecasts.map((f) => {
          const fj = f.forecast_json as Record<string, unknown> | null;
          return (
            <li key={f.id}>
              Horizon {f.forecast_horizon_days}d · {new Date(f.generated_at).toLocaleString()}
              {fj && typeof fj[CAPACITY_FORECAST_JSON_KEYS.open_tasks] === "number" ? (
                <span className="ml-1 text-[var(--text-tertiary)]">
                  (tasks {String(fj[CAPACITY_FORECAST_JSON_KEYS.open_tasks])}, approvals{" "}
                  {String(fj[CAPACITY_FORECAST_JSON_KEYS.pending_approvals] ?? "—")}, decisions{" "}
                  {String(fj[CAPACITY_FORECAST_JSON_KEYS.open_decisions] ?? "—")}
                  {typeof fj[CAPACITY_FORECAST_JSON_KEYS.contracts_without_owner] === "number"
                    ? `, unassigned ${String(fj[CAPACITY_FORECAST_JSON_KEYS.contracts_without_owner])}`
                    : ""}
                  )
                </span>
              ) : null}
            </li>
          );
        })}
        {forecasts.length === 0 ? <li className="text-[var(--text-tertiary)]">No forecasts available.</li> : null}
      </ul>
    </div>
  );
}

function ReassignmentPlannerCard(props: {
  latestOpenTasks: number | null;
  latestPendingApprovals: number | null;
  showCampaignSurfaces: boolean;
  showDecisionSignals: boolean;
  showAnalyticsLinks: boolean;
}) {
  return (
    <article className="ui-card p-4">
      <OperationalSectionHeader
        eyebrow="Planning"
        title="Reassignment planner"
        description={
          props.showCampaignSurfaces || props.showDecisionSignals
            ? "Model delegation, then apply updates in campaigns and decisions."
            : "Model delegation and track operational workload shifts."
        }
      />
      <CapacityReassignmentPlannerForm
        defaultCurrentLoad={props.latestOpenTasks ?? 0}
        defaultTargetLoad={props.latestPendingApprovals ?? 0}
        enabled={props.showAnalyticsLinks}
      />
    </article>
  );
}

function RecommendationsCard(props: {
  simOn: boolean;
  recommendations: RecommendationRow[] | null | undefined;
  showAnalyticsLinks: boolean;
}) {
  const recommendations = props.recommendations ?? [];
  return (
    <article className="ui-card p-4">
      <OperationalSectionHeader
        eyebrow="Workflow"
        title="Recommendations"
        description="Accept or dismiss grounded recommendations."
      />
      <ul className="mt-3 divide-y divide-[var(--border-subtle)] text-sm text-[var(--text-secondary)]">
        {recommendations.map((r) => (
          <li key={r.id} className="flex flex-col gap-2 py-3 first:pt-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {r.recommendation_type} · {r.priority} ·{" "}
                {r.accepted ? "accepted" : r.dismissed ? "dismissed" : "pending"}
              </span>
              {props.simOn && props.showAnalyticsLinks ? (
                <RecommendationRowActions
                  recommendationId={r.id}
                  accepted={!!r.accepted}
                  dismissed={!!r.dismissed}
                />
              ) : null}
            </div>
          </li>
        ))}
        {recommendations.length === 0 ? <li className="py-2 text-[var(--text-tertiary)]">No recommendations.</li> : null}
      </ul>
      {props.showAnalyticsLinks ? (
        <ApiJsonLink href="/api/intelligence/recommendations" className="ui-link mt-3 inline-block text-xs">
          Recommendations JSON
        </ApiJsonLink>
      ) : null}
    </article>
  );
}

function CampaignDriftCard({ activeCampaigns }: { activeCampaigns: CampaignRow[] }) {
  return (
    <OperationalSummaryCard
      eyebrow="Rollout"
      headline="Campaign drift"
      tone={activeCampaigns.length > 0 ? "neutral" : "healthy"}
      icon={Megaphone}
      primaryValue={activeCampaigns.length}
      primaryUnit="active / paused"
      action={{ href: "/campaigns", label: "Review campaign center" }}
      variant="compact"
      id="campaign-drift"
      footerExtra={
        <ul className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
          {activeCampaigns.map((c) => (
            <li key={c.id}>
              <Link href={`/campaigns/${c.id}`} prefetch={false} className="ui-link">
                {c.name}
              </Link>{" "}
              <span className="text-[var(--text-tertiary)]">· {c.status}</span>
            </li>
          ))}
          {activeCampaigns.length === 0 ? <li className="text-[var(--text-tertiary)]">No active campaigns.</li> : null}
        </ul>
      }
    />
  );
}
