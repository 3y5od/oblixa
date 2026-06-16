import type { ReactNode } from "react";
import type { AssuranceAnalyticsSummary } from "@/lib/assurance/assurance-analytics";
import { OPERATIONAL_SHELL_BY_TONE } from "@/lib/ui/operational-surface";
import { OperationalMetricChip } from "@/components/ui/operational-summary-card";

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-[var(--border-subtle)] p-4 shadow-[var(--shadow-1)] ${OPERATIONAL_SHELL_BY_TONE.neutral} ${className}`.trim()}
    >
      {children}
    </div>
  );
}

export function SegmentRollupPanel({ analytics: a }: { analytics: AssuranceAnalyticsSummary }) {
  if (a.latest_segment_rollup_top.length === 0) return null;

  return (
    <Panel className="mt-3 sm:col-span-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
        Latest run — top segments
      </p>
      <ul className="mt-2 space-y-1 text-xs text-[var(--text-secondary)]">
        {a.latest_segment_rollup_top.map((s) => (
          <li key={s.key} className="flex justify-between gap-4">
            <span>
              {s.name} <span className="font-mono text-[11px] text-[var(--text-tertiary)]">({s.key})</span>
            </span>
            <span className="tabular-nums font-medium">{s.member_count} members</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function AdoptionPanel({ analytics: a }: { analytics: AssuranceAnalyticsSummary }) {
  return (
    <Panel className="mt-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
        Adoption (30d)
      </p>
      <div className="mt-2 flex flex-wrap gap-2" role="list">
        <OperationalMetricChip
          label="Incremental runs"
          value={String(a.incremental_assurance_runs_last_30d)}
        />
        <OperationalMetricChip label="Review boards" value={String(a.review_board_runs_last_30d)} />
        <OperationalMetricChip label="Published policies" value={String(a.published_control_policies)} />
        <OperationalMetricChip label="Autopilot rules" value={String(a.enabled_autopilot_rules)} />
      </div>
    </Panel>
  );
}

export function QualityCountersPanel({ analytics: a }: { analytics: AssuranceAnalyticsSummary }) {
  return (
    <Panel className="mt-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
        Quality counters (30d rollup)
      </p>
      <p className="mt-1 text-xs text-[var(--text-tertiary)]">
        Summed across daily org_behavior_metrics rows (API reads, response packs, labels, notifications).
      </p>
      {Object.keys(a.v6_quality_counters_30d).length === 0 ? (
        <p className="mt-2 text-sm text-[var(--text-tertiary)]">No counters in this window.</p>
      ) : (
        <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-xs text-[var(--text-secondary)]">
          {Object.entries(a.v6_quality_counters_30d)
            .filter(([, n]) => n > 0)
            .sort((x, y) => y[1] - x[1])
            .map(([k, n]) => (
              <li
                key={k}
                className="flex justify-between gap-4 rounded border border-[var(--border-subtle)] bg-surface/70 px-2 py-1 dark:bg-[color:color-mix(in_oklab,var(--surface-raised)_35%,transparent)]"
              >
                <span className="font-mono text-[11px] text-[var(--text-secondary)]">{k}</span>
                <span className="tabular-nums font-semibold text-[var(--text-primary)]">{n}</span>
              </li>
            ))}
        </ul>
      )}
    </Panel>
  );
}

export function FindingCalibrationPanel({ analytics: a }: { analytics: AssuranceAnalyticsSummary }) {
  return (
    <Panel className="mt-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
        Finding calibration (30d)
      </p>
      <div className="mt-2 flex flex-wrap gap-2" role="list">
        <OperationalMetricChip label="False positive" value={String(a.finding_resolution_feedback_30d.false_positive)} />
        <OperationalMetricChip label="Not actionable" value={String(a.finding_resolution_feedback_30d.not_actionable)} />
        <OperationalMetricChip label="Confirmed" value={String(a.finding_resolution_feedback_30d.confirmed_true)} />
        <OperationalMetricChip label="Unlabeled" value={String(a.finding_resolution_feedback_30d.unlabeled)} />
        <OperationalMetricChip
          label="Median resolve (h)"
          value={a.median_hours_to_resolve_findings_30d != null ? String(a.median_hours_to_resolve_findings_30d) : "—"}
        />
        <OperationalMetricChip
          label="Median open age (h)"
          value={a.median_age_hours_open_findings != null ? String(a.median_age_hours_open_findings) : "—"}
        />
        <OperationalMetricChip
          label="FP share labeled"
          value={a.false_positive_share_of_labeled_feedback_30d != null ? `${(a.false_positive_share_of_labeled_feedback_30d * 100).toFixed(1)}%` : "—"}
        />
        <OperationalMetricChip
          label="Confirmed share"
          value={a.confirmed_true_share_of_labeled_feedback_30d != null ? `${(a.confirmed_true_share_of_labeled_feedback_30d * 100).toFixed(1)}%` : "—"}
        />
        <OperationalMetricChip
          label="N/A share"
          value={a.not_actionable_share_of_labeled_feedback_30d != null ? `${(a.not_actionable_share_of_labeled_feedback_30d * 100).toFixed(1)}%` : "—"}
        />
      </div>
    </Panel>
  );
}

export function PolicyPassRatePanel({ analytics: a }: { analytics: AssuranceAnalyticsSummary }) {
  return (
    <Panel className="mt-3 sm:col-span-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
        Policy pass rate by scope
      </p>
      <p className="mt-1 text-xs text-[var(--text-tertiary)]">Per evaluation unit before averaging.</p>
      {Object.keys(a.policy_pass_rate_by_scope_label).length === 0 ? (
        <p className="mt-2 text-sm text-[var(--text-tertiary)]">No published policy evaluations.</p>
      ) : (
        <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-xs text-[var(--text-secondary)]">
          {Object.entries(a.policy_pass_rate_by_scope_label)
            .sort((x, y) => x[0].localeCompare(y[0]))
            .map(([scope, rate]) => (
              <li
                key={scope}
                className="flex justify-between gap-4 rounded border border-[var(--border-subtle)] bg-surface/70 px-2 py-1"
              >
                <span className="truncate" title={scope}>
                  {scope}
                </span>
                <span className="shrink-0 tabular-nums font-semibold">{(rate * 100).toFixed(1)}%</span>
              </li>
            ))}
        </ul>
      )}
    </Panel>
  );
}

export function OpenFindingsTypePanel({ analytics: a }: { analytics: AssuranceAnalyticsSummary }) {
  if (Object.keys(a.open_findings_by_type).length === 0) return null;

  return (
    <Panel className="mt-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
        Open findings by type
      </p>
      <div className="mt-2 flex flex-wrap gap-2" role="list">
        {Object.entries(a.open_findings_by_type).map(([t, n]) => (
          <OperationalMetricChip key={t} label={t} value={String(n)} />
        ))}
      </div>
    </Panel>
  );
}
