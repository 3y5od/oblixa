import Link from "next/link";
import { BarChart3, ClipboardList, Database, Sparkles } from "lucide-react";
import { OutcomeEffectivenessBreakdown } from "@/components/reports/outcome-effectiveness-breakdown";
import { ApiJsonLink } from "@/components/ui/api-json-link";
import {
  OperationalMetricChip,
  OperationalSectionHeader,
  OperationalSummaryCard,
} from "@/components/ui/operational-summary-card";
import type { OutcomeInterventionRow } from "@/lib/assurance/outcomes";
import type { computeOutcomeViews, listOutcomeInterventionsPaginated } from "@/lib/assurance/outcomes";

type OutcomeIntelResult = Awaited<ReturnType<typeof computeOutcomeViews>>;
type OutcomeDrilldownResult = Awaited<ReturnType<typeof listOutcomeInterventionsPaginated>>;

export function ReportsOutcomeIntelligenceSection(props: {
  outcomeIntel: OutcomeIntelResult | null;
  outcomeDrilldown: OutcomeDrilldownResult | null;
  canViewAssuranceOps: boolean;
  visibility: {
    campaigns: boolean;
    playbooks: boolean;
    controlPolicies: boolean;
  };
}) {
  const { outcomeIntel, outcomeDrilldown, canViewAssuranceOps, visibility } = props;

  return (
    <section className="ui-card scroll-mt-8 p-5" id="outcome-intelligence">
      <OperationalSectionHeader
        eyebrow="Outcomes"
        title="Outcome intelligence"
        description="Intervention effectiveness, recurrence, and links to source runs."
      />
      <OutcomeOverview outcomeIntel={outcomeIntel} canViewAssuranceOps={canViewAssuranceOps} />
      <OutcomeSummary outcomeIntel={outcomeIntel} />
      <WeeklyEffectiveness outcomeIntel={outcomeIntel} />
      <OutcomeDrilldown outcomeDrilldown={outcomeDrilldown} visibility={visibility} />
      {(!outcomeIntel || outcomeIntel.error) && (
        <p className="mt-3 text-sm text-[var(--text-tertiary)]">Loading outcome data failed or feature is off.</p>
      )}
      <OutcomeApiCards />
    </section>
  );
}

function OutcomeOverview({
  outcomeIntel,
  canViewAssuranceOps,
}: {
  outcomeIntel: OutcomeIntelResult | null;
  canViewAssuranceOps: boolean;
}) {
  if (!outcomeIntel || outcomeIntel.error) return null;
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <OperationalSummaryCard
        eyebrow="Volume"
        headline="Recorded interventions"
        tone="neutral"
        icon={Database}
        primaryValue={outcomeIntel.interventions.length}
        primaryUnit="rows"
        action={{ href: "/api/outcomes/interventions?limit=20&offset=0", label: "Interventions JSON", external: true }}
        variant="compact"
      />
      {canViewAssuranceOps ? (
        <>
          <OutcomeEffectivenessBreakdown
            title="Program effectiveness (avg score by intervention type)"
            data={outcomeIntel.programEffectiveness}
          />
          <OutcomeEffectivenessBreakdown
            title="Control effectiveness (avg score by intervention type)"
            data={outcomeIntel.controlEffectiveness}
          />
          <OutcomeEffectivenessBreakdown
            title="Playbook effectiveness (avg score by intervention type)"
            data={outcomeIntel.playbookEffectiveness ?? {}}
          />
        </>
      ) : (
        <p className="col-span-full text-sm text-[var(--text-tertiary)]">
          Operator-only breakdowns are hidden for your role.
        </p>
      )}
    </div>
  );
}

function OutcomeSummary({ outcomeIntel }: { outcomeIntel: OutcomeIntelResult | null }) {
  if (!outcomeIntel || outcomeIntel.error || !outcomeIntel.summary) return null;
  return (
    <div className="ui-support-panel mt-4 p-4 text-sm text-[var(--text-secondary)] dark:bg-[color:color-mix(in_oklab,var(--surface-raised)_35%,transparent)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Portfolio summary</p>
      <div className="mt-2 flex flex-wrap gap-2" role="list">
        <OperationalMetricChip
          label="Avg effectiveness"
          value={String(outcomeIntel.summary.overallAvgEffectiveness ?? "—")}
        />
        {outcomeIntel.summary.effectivenessTrendDelta != null ? (
          <OperationalMetricChip label="Trend delta" value={String(outcomeIntel.summary.effectivenessTrendDelta)} />
        ) : null}
      </div>
    </div>
  );
}

function WeeklyEffectiveness({ outcomeIntel }: { outcomeIntel: OutcomeIntelResult | null }) {
  if (!outcomeIntel || outcomeIntel.error || (outcomeIntel.weeklyEffectiveness?.length ?? 0) === 0) {
    return null;
  }
  return (
    <div className="ui-support-panel mt-4 p-4 dark:bg-[color:color-mix(in_oklab,var(--surface-raised)_35%,transparent)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
        Effectiveness by month
      </p>
      <ul className="mt-2 space-y-1 text-xs text-[var(--text-secondary)]">
        {(outcomeIntel.weeklyEffectiveness ?? []).map((row) => (
          <li key={row.week}>
            {row.week}: avg {row.avgScore}{" "}
            <span className="text-[var(--text-tertiary)]">({row.count} records)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function OutcomeDrilldown({
  outcomeDrilldown,
  visibility,
}: {
  outcomeDrilldown: OutcomeDrilldownResult | null;
  visibility: { campaigns: boolean; playbooks: boolean; controlPolicies: boolean };
}) {
  if (!outcomeDrilldown || outcomeDrilldown.rows.length === 0) return null;
  return (
    <div className="ui-support-panel mt-4 p-4 dark:bg-[color:color-mix(in_oklab,var(--surface-raised)_35%,transparent)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Recent analyses</p>
      <ul className="mt-2 space-y-2 text-xs text-[var(--text-secondary)]">
        {outcomeDrilldown.rows.map((row: OutcomeInterventionRow) => (
          <OutcomeDrilldownRow key={row.id} row={row} visibility={visibility} />
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">
        <ApiJsonLink className="ui-link" href="/api/outcomes/interventions?limit=20&offset=0">
          Paginated API
        </ApiJsonLink>
      </p>
    </div>
  );
}

function OutcomeDrilldownRow({
  row,
  visibility,
}: {
  row: OutcomeInterventionRow;
  visibility: { campaigns: boolean; playbooks: boolean; controlPolicies: boolean };
}) {
  return (
    <li className="ui-soft-details px-2 py-1.5 dark:bg-[color:color-mix(in_oklab,var(--surface-raised)_35%,transparent)]">
      <span className="font-medium">{row.intervention_type.replace(/_/g, " ")}</span>
      <div className="mt-1 flex flex-wrap gap-2" role="list">
        <OperationalMetricChip label="Effectiveness" value={String(row.effectiveness_score)} />
        {row.recurrence_delta !== 0 ? (
          <OperationalMetricChip label="Recurrence Δ" value={String(row.recurrence_delta)} />
        ) : null}
        {row.time_to_stability_hours != null ? (
          <OperationalMetricChip label="Time-to-close (h)" value={String(row.time_to_stability_hours)} />
        ) : null}
      </div>
      <span className="mt-1 block text-[11px] text-[var(--text-tertiary)]">
        {visibility.playbooks && row.source_playbook_run_id ? (
          <Link className="ui-link" href="/assurance/playbooks" prefetch={false}>
            Playbook run {row.source_playbook_run_id.slice(0, 8)}…
          </Link>
        ) : null}
        {visibility.campaigns && row.source_campaign_id ? (
          <>
            {visibility.playbooks && row.source_playbook_run_id ? " · " : null}
            <Link className="ui-link" href="/campaigns" prefetch={false}>
              Campaign {row.source_campaign_id.slice(0, 8)}…
            </Link>
          </>
        ) : null}
        {visibility.controlPolicies && row.source_control_policy_id ? (
          <>
            {(visibility.playbooks && row.source_playbook_run_id) ||
            (visibility.campaigns && row.source_campaign_id)
              ? " · "
              : null}
            <Link
              className="ui-link"
              prefetch={false}
              href={`/assurance/control-policies/${row.source_control_policy_id}`}
            >
              Control policy
            </Link>
          </>
        ) : null}
      </span>
    </li>
  );
}

function OutcomeApiCards() {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <OperationalSummaryCard
        eyebrow="API"
        headline="Interventions"
        tone="neutral"
        icon={Sparkles}
        primaryValue={null}
        primaryFallback="JSON"
        primaryUnit="endpoint"
        showStatusBadge={false}
        action={{ href: "/api/outcomes/interventions", label: "Inspect interventions", external: true }}
        variant="compact"
      />
      <OperationalSummaryCard
        eyebrow="API"
        headline="Program effectiveness"
        tone="neutral"
        icon={BarChart3}
        primaryValue={null}
        primaryFallback="JSON"
        primaryUnit="endpoint"
        showStatusBadge={false}
        action={{ href: "/api/outcomes/program-effectiveness", label: "Inspect program outcomes", external: true }}
        variant="compact"
      />
      <OperationalSummaryCard
        eyebrow="API"
        headline="Control effectiveness"
        tone="neutral"
        icon={ClipboardList}
        primaryValue={null}
        primaryFallback="JSON"
        primaryUnit="endpoint"
        showStatusBadge={false}
        action={{ href: "/api/outcomes/control-effectiveness", label: "Inspect control outcomes", external: true }}
        variant="compact"
      />
    </div>
  );
}
