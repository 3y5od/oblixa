"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export interface UiCodeBlockProps {
  code: string;
  language?: string;
  copyable?: boolean;
  ariaLabel?: string;
  className?: string;
  wrap?: boolean;
  /** Optional caps eyebrow above the block (e.g., "REQUEST"). */
  eyebrow?: string;
  /** Show the language badge inside the code block (top-right). */
  showLanguage?: boolean;
}

export function UiCodeBlock({
  code,
  language,
  copyable = true,
  ariaLabel,
  className,
  wrap = false,
  eyebrow,
  showLanguage = false,
}: UiCodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard API may be unavailable in some contexts; silently no-op.
    }
  };

  return (
    <div className={className}>
      {eyebrow ? (
        <p className="mb-1.5 text-[9.5px] font-medium uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
          {eyebrow}
        </p>
      ) : null}
      <div className="relative overflow-hidden rounded-xl border border-[color:color-mix(in_oklab,var(--border-subtle)_92%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-muted)_60%,var(--surface-raised))]">
        {showLanguage && language ? (
          <span
            aria-hidden
            className="absolute right-12 top-2 z-[1] inline-flex items-center rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]"
          >
            {language}
          </span>
        ) : null}
        {copyable ? (
          <button
            type="button"
            onClick={handleCopy}
            aria-label={copied ? "Copied" : "Copy code"}
            className="ui-btn-ghost absolute right-2 top-2 z-[1] inline-flex h-7 w-7 items-center justify-center rounded-md p-0"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-[var(--success-ink)]" strokeWidth={1.85} aria-hidden />
            ) : (
              <Copy className="h-3.5 w-3.5 text-[var(--text-tertiary)]" strokeWidth={1.85} aria-hidden />
            )}
          </button>
        ) : null}
        <pre
          aria-label={ariaLabel}
          className={`overflow-x-auto px-4 py-3 pr-12 font-mono text-[12.5px] leading-relaxed text-[var(--text-primary)] ${
            wrap ? "whitespace-pre-wrap break-all" : "whitespace-pre"
          }`}
        >
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}
