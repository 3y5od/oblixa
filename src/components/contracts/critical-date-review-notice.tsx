"use client";

export function CriticalDateReviewNotice({
  pendingLabels,
  missingLabels,
  canEdit,
  summaryCopy: _summaryCopy,
}: {
  pendingLabels: string[];
  /**
   * v23: still accepted for API stability (the upstream model still
   * computes it for tests/dashboard summaries), but no longer rendered
   * here. The "missing approved value" group surfaced critical-date
   * keys that weren't extracted at all, which produced labels with no
   * matching row below — the section read as a mismatch with the
   * visible field list. The single Needs-review group now maps 1:1 to
   * the pending rows the user can act on. Missing extractions are
   * handled by the "Add field manually" entry point in the parent
   * extracted-fields section.
   */
  missingLabels?: string[];
  canEdit: boolean;
  /** Kept on the props for backwards compat; no longer rendered after v23. */
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
            Date automation is blocked until key dates are approved
          </p>
          <p className="text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
            Approve the pending key date{pendingLabels.length === 1 ? "" : "s"} below to unblock reminders and renewal tracking.
          </p>
        </div>
        <p className="shrink-0 text-[12.5px] font-medium text-[var(--text-secondary)]">
          {canEdit ? "Approve or edit each field below." : "Ask an editor to approve these fields."}
        </p>
      </div>
      <div className="mt-3">
        <div className="min-w-0 rounded-xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface)_72%,transparent)] px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            Needs review
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
