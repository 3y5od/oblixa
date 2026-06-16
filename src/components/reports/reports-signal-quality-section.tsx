import { Activity } from "lucide-react";
import type { SignalQualityDisplayRow } from "@/lib/decision-intelligence/signal-quality-labels";
import {
  OperationalSectionHeader,
  OperationalSummaryCard,
} from "@/components/ui/operational-summary-card";

type SignalQualityRow = SignalQualityDisplayRow;

export function ReportsV5SignalQualitySection(props: {
  metricsDate: string;
  rows: SignalQualityRow[];
}) {
  return (
    <section className="ui-card scroll-mt-8 p-5" id="success-metrics">
      <OperationalSectionHeader
        eyebrow="Telemetry"
        title="Success metrics"
        description="Operational counters that show completed work, recommendation activity, and automation throughput."
        actions={<span className="text-xs text-[var(--text-secondary)]">As of {props.metricsDate}</span>}
      />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {props.rows.map((row) => (
          <OperationalSummaryCard
            key={row.key}
            eyebrow="Metric"
            headline={row.label}
            tone="neutral"
            icon={Activity}
            primaryValue={row.value}
            primaryUnit="count"
            showStatusBadge={false}
            action={{ href: "/reports#success-metrics", label: "Review success metrics" }}
            variant="compact"
          />
        ))}
      </div>
      {props.rows.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--text-tertiary)]">No numeric counters recorded yet.</p>
      ) : null}
    </section>
  );
}
