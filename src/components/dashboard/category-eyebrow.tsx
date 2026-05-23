import type { ReactNode } from "react";

interface CategoryEyebrowProps {
  /** Small-caps label like ATTENTION / PERFORMANCE / PEOPLE / RECENT. */
  children: ReactNode;
  /** Optional icon shown to the left of the label. */
  icon?: ReactNode;
}

/**
 * Tiny "chapter break" above a group of related sections. Renders as a
 * hairline rule + caps-tracking label aligned to the start of the row. Used
 * to group dashboard sections without forcing a heavy h2/section nesting.
 */
export function CategoryEyebrow({ children, icon }: CategoryEyebrowProps) {
  return (
    <div className="flex items-center gap-3 pb-1 pt-1.5" aria-hidden>
      <span
        className="ui-caps-1 inline-flex items-center gap-1.5 pb-px text-[10.5px] leading-none"
        style={{
          color: "color-mix(in oklab, var(--text-tertiary) 80%, var(--text-secondary))",
        }}
      >
        {icon ? <span className="inline-flex">{icon}</span> : null}
        {children}
      </span>
      <span className="h-px flex-1 bg-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)]" />
    </div>
  );
}
