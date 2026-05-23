import type { ReactNode } from "react";

// SPEC: docs/billing-page-maximal-pass.md §9.27 — inline brand-mark
// SVGs rendered in `var(--text-secondary)` neutral, not trademark
// colors (per ui-design-principles §10.2 — trademark colors would
// compete with the status-color vocabulary).
//
// These are minimal geometric representations, NOT trademarked logos.
// Use brand-name caps text for fallback when needed.

const BRAND_LABELS: Record<string, string> = {
  visa: "VISA",
  mastercard: "MC",
  amex: "AMEX",
  discover: "DISC",
  diners: "DC",
  jcb: "JCB",
  unionpay: "UP",
  link: "LINK",
  unknown: "CARD",
};

export function CardBrandMark({
  brand,
  className = "",
}: {
  brand: string | null | undefined;
  className?: string;
}): ReactNode {
  const normalized = (brand ?? "unknown").toLowerCase();
  const label = BRAND_LABELS[normalized] ?? "CARD";

  return (
    <span
      aria-hidden
      className={`inline-flex h-4 min-w-[2rem] items-center justify-center rounded border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-1 text-[8px] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)] ${className}`.trim()}
    >
      {label}
    </span>
  );
}
