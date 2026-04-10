import Link from "next/link";
import { OperationalMetricChip } from "@/components/ui/operational-summary-card";
import type { V5SignalQualityDisplayRow } from "@/lib/v5/v5-signal-quality-labels";

export function V5TelemetryCompact(props: {
  metricsDate: string;
  rows: V5SignalQualityDisplayRow[];
}) {
  if (props.rows.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-zinc-200/80 bg-zinc-50/50 px-4 py-3 text-xs text-zinc-500">
        No V5 telemetry counters yet for {props.metricsDate}. Closures, recommendation actions, and crons populate
        this over time.
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="ui-eyebrow">V5 success metrics</p>
        <p className="text-[11px] text-zinc-500">As of {props.metricsDate}</p>
      </div>
      <div className="flex flex-wrap gap-2" role="list">
        {props.rows.slice(0, 8).map((r) => (
          <OperationalMetricChip key={r.key} label={r.label} value={String(r.value)} />
        ))}
      </div>
      <Link href="/reports#v5-success-metrics" className="ui-link inline-block text-xs">
        Open full metrics on reports
      </Link>
    </section>
  );
}
