import type { FieldReviewSegmentedProgress } from "@/lib/field-review/model";

/** Per-contract confirmation progress: a labelled "Review progress" headline
 *  ("N of M suggested details confirmed") plus a segmented bar that distinguishes
 *  confirmed, unknown, waiting-for-source, and remaining pending details — so the
 *  bar communicates *why* details remain, not just how much. Confirmed turns
 *  green only when nothing is pending. The bar keeps a fixed width so the band
 *  never shifts as counts change. */
export function ReviewSegmentedProgress({ segments }: { segments: FieldReviewSegmentedProgress }) {
  const { reviewed, pending, unknown, blockedNoSource, total } = segments;
  // "Confirmed" counts only reviewed (approved/edited) details. Marked-unknown
  // details are decided but explicitly NOT trusted, so they are excluded from the
  // confirmed headline (they remain visible as their own segment + aria breakdown).
  const openPending = Math.max(0, pending - blockedNoSource);
  // Progress reads in neutral ink + green-when-done, not cobalt — blue stays
  // reserved for the primary decision path (the Confirm control).
  const reviewedColor = pending === 0 ? "var(--success-ink)" : "var(--text-secondary)";
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);
  const segs = [
    { key: "reviewed", n: reviewed, color: reviewedColor },
    { key: "unknown", n: unknown, color: "color-mix(in oklab, var(--text-tertiary) 55%, transparent)" },
    { key: "blocked", n: blockedNoSource, color: "var(--warning-ink)" },
    { key: "pending", n: openPending, color: "color-mix(in oklab, var(--text-tertiary) 35%, transparent)" },
  ].filter((s) => s.n > 0);

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] leading-none text-[var(--text-tertiary)]">
        Review progress
      </p>
      <div className="flex items-center gap-2.5">
        <span className="inline-flex items-baseline gap-1 whitespace-nowrap leading-none tabular-nums">
          <span className="text-[13px] font-semibold text-[var(--text-primary)]">{reviewed}</span>
          <span className="text-[11px] text-[var(--text-tertiary)]">of</span>
          <span className="text-[13px] font-semibold text-[var(--text-secondary)]">{total}</span>
          <span className="ml-0.5 text-[11.5px] font-medium text-[var(--text-tertiary)]">
            suggested details confirmed
          </span>
        </span>
        <span
          className="flex h-2 w-28 shrink-0 overflow-hidden rounded-full sm:w-36"
          style={{ background: "color-mix(in oklab, var(--border-strong) 32%, transparent)" }}
          role="progressbar"
          aria-valuenow={reviewed}
          aria-valuemin={0}
          aria-valuemax={Math.max(total, 1)}
          aria-label={`Review progress: ${reviewed} of ${total} suggested details confirmed (${unknown} marked unknown, ${blockedNoSource} waiting for source, ${openPending} still pending)`}
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
    </div>
  );
}
