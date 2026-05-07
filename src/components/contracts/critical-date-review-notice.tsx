"use client";

export function CriticalDateReviewNotice({
  pendingLabels,
  missingLabels,
  canEdit,
  summaryCopy,
}: {
  pendingLabels: string[];
  missingLabels: string[];
  canEdit: boolean;
  summaryCopy: string;
}) {
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
          <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
            {summaryCopy}: reminders, renewals, and downstream workflow should not rely on this contract until the fields below have approved values.
          </p>
        </div>
        <p className="shrink-0 text-[12px] font-medium text-[var(--text-secondary)]">
          {canEdit ? "Approve, edit, or add the missing values below." : "Ask an editor to approve or add the missing values."}
        </p>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <CriticalDateLabelGroup title="Needs review" labels={pendingLabels} prefix="pending" />
        <CriticalDateLabelGroup title="Missing approved value" labels={missingLabels} prefix="missing" />
      </div>
    </section>
  );
}

function CriticalDateLabelGroup({
  title,
  labels,
  prefix,
}: {
  title: string;
  labels: string[];
  prefix: string;
}) {
  if (labels.length === 0) return null;
  return (
    <div className="min-w-0 rounded-xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface)_72%,transparent)] px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{title}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {labels.map((label) => (
          <span key={`${prefix}-${label}`} className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-2 py-0.5 text-[12px] font-medium text-[var(--text-secondary)]">
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
