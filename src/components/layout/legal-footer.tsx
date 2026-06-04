"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { LegalLinks } from "@/components/layout/legal-links";

export function LegalFooter() {
  const [expanded, setExpanded] = useState(false);
  return (
    <footer
      id="legal-footer"
      className="ui-footer-shell shrink-0 px-4 py-2.5 md:px-6"
    >
      <div className="mx-auto flex max-w-[1680px] flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="ui-caps-2 inline-flex shrink-0 items-center gap-1.5 text-[10px] leading-none text-[var(--text-tertiary)]">
            <Info
              size={11}
              strokeWidth={1.85}
              aria-hidden
              className="text-[var(--accent-strong)]"
            />
            Operational notice
          </span>
          {/* Quiet always-on summary — the binding no-legal-advice text lives in
              the disclosure so it never competes with dense work content. */}
          <span className="min-w-0 truncate text-[11px] leading-none text-[var(--text-tertiary)]">
            Post-signature contract workflows and operational dates.
          </span>
          <button
            type="button"
            className="inline-flex h-5 items-center rounded-md border border-[var(--border-subtle)] px-1.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] leading-none text-[var(--text-tertiary)] transition-colors hover:border-[color:color-mix(in_oklab,var(--accent)_28%,var(--border-strong))] hover:text-[var(--accent-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-controls="legal-notice-detail"
          >
            {expanded ? "Hide" : "View"}
          </button>
        </div>
        <LegalLinks variant="compact" className="shrink-0 gap-x-4 gap-y-1" aria-label="Footer links" />
      </div>
      <p
        id="legal-notice-detail"
        className={`mx-auto mt-2 max-w-[1680px] text-[11px] leading-[1.55] text-[var(--text-tertiary)] ${
          expanded ? "block" : "hidden"
        }`}
      >
        Oblixa runs post-signature contract execution workflows and operational dates — not legal advice or a
        substitute for qualified counsel. Verify critical terms against the original documents and your own
        policies.
      </p>
    </footer>
  );
}
