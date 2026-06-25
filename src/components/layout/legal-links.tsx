"use client";

import Link from "next/link";

export type LegalLinkVariant = "compact" | "full" | "legal-min";

const LINKS = [
  { href: "/security", label: "Security" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/acceptable-use", label: "Acceptable use" },
  { href: "/accessibility", label: "Accessibility" },
  { href: "/cookies", label: "Cookies" },
  { href: "/contact", label: "Contact" },
] as const;

/**
 * Auth surfaces (`legal-min`) carry only the legally necessary policy links —
 * privacy, terms, cookies, and the accessibility statement. Broad navigation /
 * marketing links (security, acceptable use, contact) are intentionally dropped
 * so the sign-in page does not read as a marketing page.
 */
const LEGAL_MIN_HREFS: ReadonlySet<string> = new Set([
  "/privacy",
  "/terms",
  "/accessibility",
  "/cookies",
]);

export function LegalLinks({
  variant = "full",
  className = "",
  "aria-label": ariaLabel = "Legal and policies",
}: {
  variant?: LegalLinkVariant;
  className?: string;
  "aria-label"?: string;
}) {
  const items =
    variant === "compact"
      ? LINKS.slice(0, 3)
      : variant === "legal-min"
        ? LINKS.filter((link) => LEGAL_MIN_HREFS.has(link.href))
        : LINKS;
  // Compact (authenticated-shell footer) reads as quiet title-case links —
  // formal, not shouted caps (§18.13). The full marketing and legal-min auth
  // variants keep the wider uppercase eyebrow tracking.
  const caseClass = variant === "compact" ? "" : "uppercase";
  const sizeTracking =
    variant === "compact" ? "text-[11px] tracking-[0.01em]" : "text-[10.5px] tracking-[0.14em]";

  return (
    <nav className={`ui-legal-links ${className}`.trim()} aria-label={ariaLabel}>
      {items.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          prefetch={false}
          className={`ui-nowrap-safe rounded-sm font-semibold leading-tight text-[var(--text-tertiary)] no-underline transition-colors duration-[var(--ui-duration)] hover:text-[var(--accent-strong)] hover:underline hover:decoration-from-font hover:underline-offset-[3px] focus-visible:text-[var(--accent-strong)] focus-visible:underline focus-visible:decoration-from-font focus-visible:underline-offset-[3px] ${caseClass} ${sizeTracking}`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
