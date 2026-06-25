"use client";

import { useState } from "react";
import { AlertTriangle, ArrowDownRight, Quote } from "lucide-react";

const SNIPPET_COLLAPSE_AT = 240;

/** Citation evidence: a found/not-found status over the cited clause, the quote
 *  toned by `sourceBacked` — the value-located trust signal (sourceQuality ===
 *  "located"), the SAME signal the decision pane uses, so the two surfaces never
 *  disagree. Green found / amber not-found carry the state; cobalt stays on the
 *  decision path. The clause uses the source families for its margin rule and a
 *  jump-to-highlight affordance when source-backed; a correction hint otherwise.
 *  Long snippets expand/collapse. (No copy control — copying the clause is not a
 *  primary review action here.) */
export function ReviewCitation({
  sourceSnippet,
  sourceBacked,
  previewAnchor,
}: {
  sourceSnippet: string | null;
  sourceBacked: boolean;
  previewAnchor: string;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!sourceSnippet || sourceSnippet.trim().length === 0) {
    return (
      <p className="inline-flex items-baseline gap-1.5">
        <span aria-hidden className="text-[13px] font-semibold leading-none text-[var(--text-tertiary)]">
          &mdash;
        </span>
        <span className="text-[11.5px] leading-snug text-[var(--text-tertiary)]">
          No citation attached to this suggestion
        </span>
      </p>
    );
  }

  const clean = sourceSnippet.replace(/\s+/g, " ").trim().replace(/[.\s]+$/u, "");
  const isLong = clean.length > SNIPPET_COLLAPSE_AT;
  const shown = expanded || !isLong ? clean : `${clean.slice(0, SNIPPET_COLLAPSE_AT)}…`;

  return (
    <div className="space-y-2">
      {sourceBacked ? (
        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold leading-none text-[var(--success-ink)]">
          <Quote className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          Source text found for this suggestion
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold leading-none text-[var(--warning-ink)]">
          <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          Not located in the source
        </span>
      )}

      {/* The cited clause on warm source paper, with a margin rule whose colour
          carries the found/not-found state — paper for "source", the source
          families for trust (green found / amber not-found). */}
      <blockquote
        className={`ui-surface-source overflow-hidden rounded-r-lg border-l-[3px] ${
          sourceBacked
            ? "border-[color:color-mix(in_oklab,var(--success-ink)_60%,var(--border-strong))]"
            : "border-[color:color-mix(in_oklab,var(--warning-ink)_60%,var(--border-strong))]"
        }`}
      >
        <p className="px-3.5 py-3 text-[13px] leading-[1.65] text-[var(--text-primary)]">{shown}</p>
      </blockquote>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {isLong ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="ui-chip-focus rounded text-[11.5px] font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        ) : null}
        {sourceBacked ? (
          <a
            href={`#${previewAnchor}`}
            className="ui-chip-focus inline-flex items-center gap-1 rounded text-[11.5px] font-semibold text-[var(--success-ink)]"
          >
            <ArrowDownRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            Show highlighted source text
          </a>
        ) : (
          <span className="text-[11.5px] leading-snug text-[var(--text-tertiary)]">
            Not found in the preview — edit to add the correct source text, or mark unknown.
          </span>
        )}
      </div>
    </div>
  );
}
