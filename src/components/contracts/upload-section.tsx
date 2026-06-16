import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface UploadSectionProps {
  /** Quiet tabular step prefix shown before the sentence-case title (no caps,
   *  no separate numeral medallion). Omit for unnumbered sections. */
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
 * One titled block inside the upload editor card — a quiet line icon + a
 * sentence-case title (with optional quiet step index) + optional lead +
 * right-aligned aside, then the section body. Sections are separated by
 * hairlines, never nested cards (§13).
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
      <div className="flex items-start gap-2.5">
        <Icon
          aria-hidden
          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-tertiary)]"
          strokeWidth={1.75}
        />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-1.5">
            {step != null ? (
              <span className="text-[12px] font-semibold leading-none tabular-nums text-[var(--text-tertiary)]">
                {step}.
              </span>
            ) : null}
            <span className="text-[13.5px] font-semibold leading-none text-[var(--text-primary)]">
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
