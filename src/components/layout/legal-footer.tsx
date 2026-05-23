"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { LegalLinks } from "@/components/layout/legal-links";

export function LegalFooter() {
  const [expanded, setExpanded] = useState(false);
  return (
    <footer
      id="legal-footer"
      className="ui-footer-shell shrink-0 px-5 py-3 md:px-8 md:py-3.5"
    >
      <div className="mx-auto flex max-w-[1680px] flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-col gap-2 md:flex-row md:items-center md:gap-4">
          <div className="flex items-center gap-2">
            <span className="ui-caps-2 inline-flex shrink-0 items-center gap-1.5 text-[10.5px] text-[var(--text-tertiary)]">
              <Info
                size={11}
                strokeWidth={1.85}
                aria-hidden
                className="text-[var(--accent-strong)]"
              />
              Operational notice
            </span>
            <button
              type="button"
              className="inline-flex h-6 items-center rounded-md border border-[var(--border-subtle)] px-2 text-[10px] font-semibold uppercase tracking-[0.14em] leading-none text-[var(--text-tertiary)] transition-colors hover:border-[color:color-mix(in_oklab,var(--accent)_28%,var(--border-strong))] hover:text-[var(--accent-strong)] md:hidden"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
            >
              {expanded ? "Hide" : "View"}
            </button>
          </div>
          <p
            className={`max-w-4xl text-[11px] leading-[1.55] text-[var(--text-tertiary)] ${
              expanded ? "block" : "hidden md:block"
            }`}
          >
            Oblixa runs post-signature contract execution workflows and operational dates — not legal advice or a
            substitute for qualified counsel. Verify critical terms against the original documents and your own
            policies.
          </p>
        </div>
        <LegalLinks variant="compact" className="shrink-0 gap-x-4 gap-y-1" aria-label="Footer links" />
      </div>
    </footer>
  );
}
