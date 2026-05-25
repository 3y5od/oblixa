import Link from "next/link";
import { OperationalMetricChip } from "@/components/ui/operational-summary-card";
import type { SignalQualityDisplayRow } from "@/lib/decision-intelligence/signal-quality-labels";

export function TelemetryCompact(props: {
  metricsDate: string;
  rows: SignalQualityDisplayRow[];
}) {
  if (props.rows.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] px-4 py-3 text-xs text-[var(--text-tertiary)]">
        No success metrics yet for {props.metricsDate}. Closures, recommendation actions, and crons populate this
        over time.
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="ui-caps-1 inline-flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
          <span className="landing-eyebrow-dot" aria-hidden />
          Success metrics
        </p>
        <p className="text-[11px] text-[var(--text-tertiary)]">As of {props.metricsDate}</p>
      </div>
      <div className="flex flex-wrap gap-2" role="list">
        {props.rows.slice(0, 8).map((r) => (
          <OperationalMetricChip key={r.key} label={r.label} value={String(r.value)} />
        ))}
      </div>
      <Link href="/reports#success-metrics" className="ui-link inline-block text-xs">
        Open full metrics on reports
      </Link>
    </section>
  );
}

/** @deprecated Compatibility alias for legacy internal imports. */
export const V5TelemetryCompact = TelemetryCompact;
