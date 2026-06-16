"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

/**
 * §31/§32 — the expandable renewal ledger row. Each row stays scannable; its
 * deeper operational context (date basis, source/review status, report
 * inclusion, last reviewed, related work) lives in a disclosure panel that opens
 * in place. The component owns the article, the open state, the leading chevron
 * toggle, and the panel so a single client boundary coordinates them.
 *
 * Render-props can't cross the RSC boundary, so the page passes server-rendered
 * nodes: `children` is the summary grid content and `detail` is the panel
 * content. The toggle is a real APG disclosure button (aria-expanded /
 * aria-controls); clicking it never interferes with the links inside the row.
 *
 * No nested cards (§32): the panel is an inset band of labeled fields separated
 * by thin rules.
 */

export interface RenewalRowDisclosureProps {
  /** Stable id for the row's heading (the contract title), used as the article's
   *  accessible name. */
  labelledById: string;
  /** Accessible noun for the toggle, e.g. the contract title. */
  title: string;
  /** Grid/layout classes for the summary row content. */
  gridClassName: string;
  /** The summary row cells (server-rendered). */
  children: ReactNode;
  /** The disclosure panel content (server-rendered). */
  detail: ReactNode;
}

export function RenewalRowDisclosure({
  labelledById,
  title,
  gridClassName,
  children,
  detail,
}: RenewalRowDisclosureProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <article
      aria-labelledby={labelledById}
      className="border-b border-[color:color-mix(in_oklab,var(--border-subtle)_48%,transparent)] px-4 py-4 transition-colors last:border-b-0 hover:bg-[color:color-mix(in_oklab,var(--surface-contrast)_55%,transparent)] sm:px-5"
    >
      <div className="flex items-start gap-2.5 sm:gap-3">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? `Hide renewal details for ${title}` : `Show renewal details for ${title}`}
          className="ui-chip-focus mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--text-tertiary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_70%,transparent)] hover:text-[var(--text-primary)] aria-expanded:text-[var(--text-primary)]"
        >
          <ChevronRight
            className={`h-4 w-4 transition-transform duration-150 ${open ? "rotate-90" : ""}`}
            strokeWidth={2}
            aria-hidden
          />
        </button>
        <div className={`flex-1 ${gridClassName}`}>{children}</div>
      </div>
      {open ? (
        <div
          id={panelId}
          role="region"
          aria-label={`${title} renewal detail`}
          className="mt-3 ml-[2.125rem] border-l-2 border-[color:color-mix(in_oklab,var(--accent)_30%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--surface-muted)_30%,transparent)] px-4 py-3.5"
        >
          {detail}
        </div>
      ) : null}
    </article>
  );
}
