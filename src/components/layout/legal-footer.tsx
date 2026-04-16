"use client";

import { useState } from "react";
import Link from "next/link";

export function LegalFooter() {
  const [expanded, setExpanded] = useState(false);
  return (
    <footer
      id="legal-footer"
      className="shrink-0 border-t border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface)_86%,transparent)] px-5 py-3.5 backdrop-blur-md md:px-8 md:py-4"
    >
      <div className="mx-auto flex max-w-[1680px] flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 flex-col gap-2 md:flex-row md:items-center md:gap-3">
          <div className="flex items-center gap-2">
            <span className="ui-kicker">Operational notice</span>
            <button
              type="button"
              className="inline-flex rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)] md:hidden"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
            >
              {expanded ? "Hide" : "View"}
            </button>
          </div>
          <p
            className={`max-w-4xl text-[11px] leading-relaxed text-[var(--text-tertiary)] ${
              expanded ? "block" : "hidden md:block"
            }`}
          >
            Oblixa helps you run post-signature contract execution workflows and operational dates. It does not
            provide legal advice, legal analysis, or a substitute for qualified counsel. Always verify critical
            terms against the original documents and your own policies.
          </p>
        </div>
        <nav className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]" aria-label="Footer links">
          <Link href="/security" prefetch={false} className="ui-link">
            Security
          </Link>
          <Link href="/privacy" prefetch={false} className="ui-link">
            Privacy
          </Link>
          <Link href="/terms" prefetch={false} className="ui-link">
            Terms
          </Link>
        </nav>
      </div>
    </footer>
  );
}
