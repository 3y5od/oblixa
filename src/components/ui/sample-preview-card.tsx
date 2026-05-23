import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

export interface SamplePreviewRow {
  label: string;
  value: string;
}

export interface SamplePreviewCardProps {
  eyebrow: string;
  title: string;
  /** Optional descriptive prose under the title; rendered at 13px secondary, not small. */
  description?: string;
  /** Short metadata tags replacing prose subtitle with middot separators. */
  meta?: string[];
  /** Top-right status indicator slot. Pass `<StatusPill>` or a stack of pills. */
  status?: ReactNode;
  rows: SamplePreviewRow[];
  /** Standard "Next action" footer: caps eyebrow + chevron + accent caps value. */
  footerEyebrow?: string;
  footerValue?: string;
  /** Alternative footer: a tertiary status note with optional leading icon (e.g. "Delivered to your team"). */
  footerNote?: { icon?: ReactNode; text: string };
}

export function SamplePreviewCard({
  eyebrow,
  title,
  description,
  meta,
  status,
  rows,
  footerEyebrow = "Next action",
  footerValue,
  footerNote,
}: SamplePreviewCardProps) {
  return (
    <aside
      aria-label={`${eyebrow} row`}
      className="relative overflow-hidden rounded-xl border border-dashed border-[color:color-mix(in_oklab,var(--accent)_18%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--surface-muted)_38%,var(--surface-raised))]"
    >
      <header className="flex items-start justify-between gap-3 px-5 pb-4 pt-5">
        <div className="min-w-0">
          <p className="text-[9.5px] font-medium uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
            {eyebrow}
          </p>
          <h3 className="mt-2 text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">
            {title}
          </h3>
          {description ? (
            <p className="mt-1 text-[12.5px] leading-snug text-[var(--text-secondary)]">{description}</p>
          ) : null}
          {meta && meta.length > 0 ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {meta.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_60%,transparent)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        {status ? <div className="flex shrink-0 items-center gap-1.5">{status}</div> : null}
      </header>

      <dl className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)]">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 px-5 py-2">
            <dt className="text-[9.5px] font-medium uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
              {row.label}
            </dt>
            <dd className="font-mono text-[12.5px] tabular-nums text-[var(--text-primary)]">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      {footerValue ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] px-5 py-3">
          <span className="text-[9.5px] font-medium uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
            {footerEyebrow}
          </span>
          <ChevronRight
            className="h-3 w-3 shrink-0 text-[var(--text-tertiary)]"
            strokeWidth={1.85}
            aria-hidden
          />
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-strong)]">
            {footerValue}
          </span>
        </div>
      ) : footerNote ? (
        <div className="flex items-center gap-2 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] px-5 py-3">
          {footerNote.icon ? (
            <span className="inline-flex shrink-0 items-center text-[var(--text-tertiary)]">
              {footerNote.icon}
            </span>
          ) : null}
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            {footerNote.text}
          </span>
        </div>
      ) : null}
    </aside>
  );
}
