"use client";

export function CriticalDateReviewNotice({
  pendingLabels,
  missingLabels,
  canEdit,
  summaryCopy: _summaryCopy,
}: {
  pendingLabels: string[];
  /**
   * Still accepted for API stability: upstream summaries may compute
   * missing labels, but this notice only renders details the user can
   * confirm in the visible list.
   */
  missingLabels?: string[];
  canEdit: boolean;
  /** Kept on the props for backwards compatibility. */
  summaryCopy?: string;
}) {
  void missingLabels;
  void _summaryCopy;
  if (pendingLabels.length === 0) return null;
  return (
    <section
      className="rounded-2xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--warning-soft)_32%,var(--surface))] px-4 py-3 text-sm text-[var(--warning-ink)]"
      role="status"
      aria-labelledby="critical-date-review-title"
      data-testid="critical-date-review-notice"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1">
          <p id="critical-date-review-title" className="font-semibold text-[var(--text-primary)]">
            Date reminders need key dates to be confirmed
          </p>
          <p className="text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
            Confirm the pending key date{pendingLabels.length === 1 ? "" : "s"} below before reminders and renewal tracking rely on them.
          </p>
        </div>
        <p className="shrink-0 text-[12.5px] font-medium text-[var(--text-secondary)]">
          {canEdit ? "Confirm or edit each detail below." : "Ask an editor to confirm these details."}
        </p>
      </div>
      <div className="mt-3">
        <div className="min-w-0 rounded-xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface)_72%,transparent)] px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            Needs confirmation
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {pendingLabels.map((label) => (
              <span
                key={`pending-${label}`}
                className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-2 py-0.5 text-[12.5px] font-medium text-[var(--text-secondary)]"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
