import type { FieldReviewSegmentedProgress } from "@/lib/field-review/model";

/** Per-contract confirmation progress: a "N of M confirmed" headline plus a segmented
 *  bar that distinguishes confirmed, unknown, waiting-for-source,
 *  and remaining pending details — so the bar communicates *why* tasks remain, not
 *  just how much. Confirmed turns green only when nothing is pending. */
export function ReviewSegmentedProgress({ segments }: { segments: FieldReviewSegmentedProgress }) {
  const { reviewed, pending, unknown, blockedNoSource, total } = segments;
  const decided = reviewed + unknown;
  const openPending = Math.max(0, pending - blockedNoSource);
  const reviewedColor = pending === 0 ? "var(--success-ink)" : "var(--accent)";
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);
  const segs = [
    { key: "reviewed", n: reviewed, color: reviewedColor },
    { key: "unknown", n: unknown, color: "color-mix(in oklab, var(--text-tertiary) 60%, transparent)" },
    { key: "blocked", n: blockedNoSource, color: "var(--warning-ink)" },
    { key: "pending", n: openPending, color: "color-mix(in oklab, var(--accent) 45%, transparent)" },
  ].filter((s) => s.n > 0);

  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-baseline gap-1 leading-none tabular-nums">
        <span className="text-[12px] font-semibold text-[var(--text-primary)]">{decided}</span>
        <span className="text-[10px] text-[var(--text-tertiary)]">of</span>
        <span className="text-[12px] font-semibold text-[var(--text-secondary)]">{total}</span>
        <span className="ui-caps-3 ml-0.5 text-[10px] text-[var(--text-tertiary)]">confirmed</span>
      </span>
      <span
        className="flex h-1.5 w-24 overflow-hidden rounded-full sm:w-32"
        style={{ background: "color-mix(in oklab, var(--border-strong) 32%, transparent)" }}
        role="progressbar"
        aria-valuenow={decided}
        aria-valuemin={0}
        aria-valuemax={Math.max(total, 1)}
        aria-label={`${reviewed} confirmed, ${unknown} marked unknown, ${blockedNoSource} waiting for source, ${openPending} pending of ${total} details`}
      >
        {segs.map((s) => (
          <span
            key={s.key}
            aria-hidden
            className="block h-full transition-[width] duration-500 ease-out"
            style={{ width: `${pct(s.n)}%`, background: s.color }}
          />
        ))}
      </span>
    </div>
  );
}
