"use client";

import { useState } from "react";

export function LegalFooter() {
  const [expanded, setExpanded] = useState(false);
  return (
    <footer
      id="legal-footer"
      className="shrink-0 border-t border-zinc-200/70 bg-white/84 px-5 py-3.5 backdrop-blur-sm md:px-10 md:py-4"
    >
      <div className="mx-auto max-w-[1600px]">
        <button
          type="button"
          className="mx-auto block text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 hover:text-zinc-700 md:hidden"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? "Hide legal notice" : "Show legal notice"}
        </button>
        <p
          className={`text-center text-[11px] leading-relaxed text-zinc-500 ${
            expanded ? "mt-3 block" : "hidden md:block"
          }`}
        >
          Contract Operations Tracker helps you organize agreements and operational
          dates. It does not provide legal advice, legal analysis, or a substitute
          for qualified counsel. Always verify critical terms against the original
          documents and your own policies.
        </p>
      </div>
    </footer>
  );
}
