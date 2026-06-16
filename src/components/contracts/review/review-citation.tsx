"use client";

import { useState } from "react";
import { AlertTriangle, ArrowDownRight, Check, Copy, Quote } from "lucide-react";

const SNIPPET_COLLAPSE_AT = 240;

/** Citation evidence: status above the quote, the quote toned by located state
 *  (accent when located, warning when not), and snippet controls (copy,
 *  expand/collapse, jump-to-highlight). The positive trust signal lives in the
 *  decision pane's "Source-backed" badge, so a located citation shows only the
 *  jump affordance here — never a second positive badge (§ no duplicate positive). */
export function ReviewCitation({
  sourceSnippet,
  snippetLocated,
  previewAnchor,
}: {
  sourceSnippet: string | null;
  snippetLocated: boolean;
  previewAnchor: string;
}) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (!sourceSnippet || sourceSnippet.trim().length === 0) {
    return (
      <p className="inline-flex items-baseline gap-1.5">
        <span aria-hidden className="text-[13px] font-semibold leading-none text-[var(--text-tertiary)]">
          &mdash;
        </span>
        <span className="ui-caps-3 text-[10px] leading-none text-[var(--text-tertiary)]">
          No citation attached to this suggestion
        </span>
      </p>
    );
  }

  const clean = sourceSnippet.replace(/\s+/g, " ").trim().replace(/[.\s]+$/u, "");
  const isLong = clean.length > SNIPPET_COLLAPSE_AT;
  const shown = expanded || !isLong ? clean : `${clean.slice(0, SNIPPET_COLLAPSE_AT)}…`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(clean);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (insecure context / denied) — no-op; copy is a convenience.
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        {snippetLocated ? (
          <span className="ui-caps-3 inline-flex items-center gap-1.5 text-[10px] leading-none text-[var(--text-tertiary)]">
            <Quote className="h-3 w-3 text-[var(--accent-strong)]" strokeWidth={2} aria-hidden />
            Source text
          </span>
        ) : (
          <span className="ui-caps-3 inline-flex items-center gap-1.5 text-[10px] leading-none text-[var(--warning-ink)]">
            <AlertTriangle className="h-3 w-3" strokeWidth={2} aria-hidden />
            Not located
          </span>
        )}
        <button
          type="button"
          onClick={copy}
          className="ui-chip-focus inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]"
          aria-label="Copy source text"
        >
          {copied ? (
            <Check className="h-3 w-3 text-[var(--success-ink)]" strokeWidth={2} aria-hidden />
          ) : (
            <Copy className="h-3 w-3" strokeWidth={2} aria-hidden />
          )}
          {copied ? "Copied" : "Copy source text"}
        </button>
      </div>

      <blockquote
        className={`overflow-hidden rounded-r-lg border-l-[3px] ${
          snippetLocated
            ? "border-[color:color-mix(in_oklab,var(--accent)_55%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_12%,var(--surface-muted))]"
            : "border-[color:color-mix(in_oklab,var(--warning)_50%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning-soft)_16%,var(--surface-muted))]"
        }`}
      >
        <p className="px-3.5 py-2.5 text-[12.5px] leading-relaxed text-[var(--text-primary)]">{shown}</p>
      </blockquote>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {isLong ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="ui-chip-focus rounded text-[11px] font-medium text-[var(--accent-strong)]"
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        ) : null}
        {snippetLocated ? (
          <a
            href={`#${previewAnchor}`}
            className="ui-chip-focus inline-flex items-center gap-1 rounded text-[11px] font-medium text-[var(--accent-strong)]"
          >
            <ArrowDownRight className="h-3 w-3" strokeWidth={2} aria-hidden />
            Show source highlight
          </a>
        ) : (
          <span className="text-[11px] leading-snug text-[var(--text-tertiary)]">
            Not found in the preview — edit to add the correct source text, or mark unknown.
          </span>
        )}
      </div>
    </div>
  );
}
