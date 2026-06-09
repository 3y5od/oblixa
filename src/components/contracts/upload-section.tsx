import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface UploadSectionProps {
  /** Quiet tabular step prefix folded into the caps title (§11.26 — no separate
   *  numeral medallion). Omit for unnumbered sections. */
  step?: number;
  icon: LucideIcon;
  title: string;
  lead?: string;
  /** Right-aligned slot in the section header (e.g. the file-status chip). */
  aside?: ReactNode;
  /** Suppress the top hairline for the first section in a card. */
  first?: boolean;
  children: ReactNode;
}

/**
 * One titled block inside the upload editor card — icon medallion + caps title
 * (with optional step prefix) + optional lead + right-aligned aside, then the
 * section body. Sections are separated by hairlines, never nested cards (§10.5).
 */
export function UploadSection({
  step,
  icon: Icon,
  title,
  lead,
  aside,
  first,
  children,
}: UploadSectionProps) {
  return (
    <section
      className={`px-5 py-5 sm:px-6 ${
        first
          ? ""
          : "border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)]"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_36%,var(--surface-raised))] text-[var(--accent-strong)] shadow-[var(--shadow-1)]"
        >
          <Icon className="h-4 w-4" strokeWidth={1.85} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 leading-none">
            {step != null ? (
              <span className="ui-caps-1 text-[11px] leading-none tabular-nums text-[var(--text-tertiary)]">
                {step}
              </span>
            ) : null}
            <span className="ui-caps-2 text-[11px] leading-none text-[var(--text-primary)]">
              {title}
            </span>
          </p>
          {lead ? (
            <p className="mt-1.5 text-[12px] leading-snug text-[var(--text-secondary)]">
              {lead}
            </p>
          ) : null}
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
