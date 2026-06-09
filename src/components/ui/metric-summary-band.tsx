import type { ReactNode } from "react";
import { ActionChip } from "@/components/ui/action-chip";
import { ChipPair } from "@/components/ui/chip-pair";
import { CountChip } from "@/components/ui/count-chip";
import { KeyValueChip } from "@/components/ui/key-value-chip";
import type { StatTone } from "@/components/ui/stat-cell";

/**
 * Shared summary/metric band for the dense data surfaces (Work, Renewals,
 * Evidence). One recipe: sr-only h2 + caps eyebrow + a count chip (a plain
 * CountChip or a ChipPair when the count needs a unit word) + toned metric
 * chips + an optional trailing quiet ActionChip. Replaces the three hand-built
 * bands that had drifted to different wrappers, gaps, and chip constructions.
 *
 * Static metric chips are declared via `metrics`; interactive metric chips
 * (e.g. Work's quick-filter links) are passed through `metricsSlot`. Both render
 * in the left cluster after the count.
 */

type CountSpec =
  | { kind: "count"; value: number; emphasis?: "subtle" | "strong" }
  | { kind: "pair"; primary: string; secondary?: string };

export interface MetricSummaryBandProps {
  /** Visually-hidden section heading (the surface's accessible name). */
  srTitle: string;
  srTitleId: string;
  eyebrow: string;
  count: CountSpec;
  metrics?: ReadonlyArray<{ label: string; value: string | number; tone?: StatTone }>;
  metricsSlot?: ReactNode;
  action?: { verb: string; href: string };
  className?: string;
}

export function MetricSummaryBand({
  srTitle,
  srTitleId,
  eyebrow,
  count,
  metrics,
  metricsSlot,
  action,
  className,
}: MetricSummaryBandProps) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-3.5 ${className ?? ""}`.trim()}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <h2 id={srTitleId} className="sr-only">
          {srTitle}
        </h2>
        <p className="ui-caps-2 text-[var(--text-tertiary)]">{eyebrow}</p>
        {count.kind === "pair" ? (
          <ChipPair primary={count.primary} secondary={count.secondary} className="tabular-nums" />
        ) : (
          <CountChip value={count.value} emphasis={count.emphasis ?? "strong"} />
        )}
        {metricsSlot}
        {metrics?.map((metric) => (
          <KeyValueChip key={metric.label} label={metric.label} value={metric.value} tone={metric.tone} />
        ))}
      </div>
      {action ? <ActionChip verb={action.verb} href={action.href} /> : null}
    </div>
  );
}
