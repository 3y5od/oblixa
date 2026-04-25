"use client";

import { useState } from "react";
import { LegalLinks } from "@/components/layout/legal-links";

export function LegalFooter() {
  const [expanded, setExpanded] = useState(false);
  return (
    <footer
      id="legal-footer"
      className="ui-footer-shell shrink-0 px-5 py-3.5 md:px-8 md:py-4"
    >
      <div className="mx-auto flex max-w-[1680px] flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 flex-col gap-2 md:flex-row md:items-center md:gap-3">
          <div className="flex items-center gap-2">
            <span className="ui-kicker">Operational notice</span>
            <button
              type="button"
              className="ui-chip md:hidden"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
            >
              {expanded ? "Hide" : "View"}
            </button>
          </div>
          <p
            className={`ui-support-copy max-w-4xl text-[11px] leading-relaxed text-[var(--text-tertiary)] ${
              expanded ? "block" : "hidden md:block"
            }`}
          >
            Oblixa helps you run post-signature contract execution workflows and operational dates. It does not
            provide legal advice, legal analysis, or a substitute for qualified counsel. Always verify critical
            terms against the original documents and your own policies.
          </p>
        </div>
        <LegalLinks variant="compact" className="gap-x-3 gap-y-1" aria-label="Footer links" />
      </div>
    </footer>
  );
}
