"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Printer } from "lucide-react";

// SPEC: docs/billing-page-polish-pass.md §1.7 + §7.5 + §7.6 + §8.6
// Admin-only client affordances: print, copy IDs (masked), tooltips.

export function BillingPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="ui-btn-ghost inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] billing-no-print"
      title="Print billing summary"
    >
      <Printer className="h-3 w-3" strokeWidth={1.85} aria-hidden />
      Print billing summary
    </button>
  );
}

/**
 * Mask an identifier preserving the first N + last M chars with
 * ellipsis in between. Per polish-pass §1.7 + §7.5.
 */
export function maskIdentifier(
  value: string,
  prefix = 4,
  suffix = 3
): string {
  if (value.length <= prefix + suffix) return value;
  return `${value.slice(0, prefix)}···${value.slice(-suffix)}`;
}

/**
 * Generic copy button — masks the value by default; reveals full
 * value on hover/focus. Clipboard always writes the full value.
 *
 * SPEC: polish-pass §7.6 — extracted primitive shared by §7.5
 * workspace-ID + customer-ID buttons.
 */
export function BillingCopyButton({
  value,
  label,
  prefix = 4,
  suffix = 3,
  displayPrefix,
}: {
  value: string;
  /** Caps-3 label rendered before the value (e.g., "CUSTOMER", "WORKSPACE"). */
  label: string;
  /** Chars kept from the start when masked. Default 4. */
  prefix?: number;
  /** Chars kept from the end when masked. Default 3. */
  suffix?: number;
  /** Optional literal prefix to prepend in the display (e.g., "org_"). */
  displayPrefix?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const resetTimerRef = useRef<number | null>(null);
  const masked = maskIdentifier(value, prefix, suffix);
  const display = revealed ? value : masked;

  useEffect(() => {
    return () => {
      if (resetTimerRef.current != null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setRevealed(true);
          if (resetTimerRef.current != null) {
            window.clearTimeout(resetTimerRef.current);
          }
          resetTimerRef.current = window.setTimeout(() => {
            setCopied(false);
            setRevealed(false);
            resetTimerRef.current = null;
          }, 2000);
        } catch {
          // Clipboard may be blocked by permissions — silent.
        }
      }}
      onMouseEnter={() => setRevealed(true)}
      onMouseLeave={() => {
        if (!copied) setRevealed(false);
      }}
      onFocus={() => setRevealed(true)}
      onBlur={() => {
        if (!copied) setRevealed(false);
      }}
      className="ui-btn-ghost group inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] billing-no-print"
      title={`Click to copy ${value}`}
      aria-label={`Copy ${label} ID ${value}`}
    >
      <span className="ui-caps-3 text-[var(--text-tertiary)]">{label}</span>
      <span className="font-mono text-[12.5px]">
        {displayPrefix}
        {display}
      </span>
      {copied ? (
        <Check
          className="h-3 w-3 text-[var(--success-ink)]"
          strokeWidth={2}
          aria-hidden
        />
      ) : (
        // Finishing-pass §1.5 — opacity-50 default so the affordance
        // reads at rest; opacity-100 on hover/focus.
        <Copy
          className="h-3 w-3 opacity-50 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          strokeWidth={1.85}
          aria-hidden
        />
      )}
    </button>
  );
}

/**
 * Backwards-compatible export for the customer-ID button. New code
 * should use `<BillingCopyButton value={customerId} label="CUSTOMER" />`.
 *
 * @deprecated — use BillingCopyButton.
 */
export function BillingCopyCustomerId({
  customerId,
}: {
  customerId: string;
}) {
  return <BillingCopyButton value={customerId} label="CUSTOMER" />;
}
