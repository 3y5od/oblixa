import type { ReactNode } from "react";

export interface SectionHeaderProps {
  eyebrow?: string;
  /** Optional h2 title. When absent, the section is identified by its caps eyebrow alone. */
  title?: string;
  trailing?: ReactNode;
}

export function SectionHeader({ eyebrow, title, trailing }: SectionHeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-3">
      <div className="flex min-w-0 items-baseline gap-2">
        {eyebrow && title ? (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
              {eyebrow}
            </p>
            <span
              aria-hidden
              className="h-3 w-px bg-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)]"
            />
            <h2 className="text-[12.5px] font-semibold tracking-tight text-[var(--text-primary)]">
              {title}
            </h2>
          </>
        ) : title ? (
          <h2 className="text-[12.5px] font-semibold tracking-tight text-[var(--text-primary)]">
            {title}
          </h2>
        ) : eyebrow ? (
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
            {eyebrow}
          </h2>
        ) : null}
      </div>
      {trailing ? <div className="flex shrink-0 items-center gap-2">{trailing}</div> : null}
    </header>
  );
}
