"use client";

import Link from "next/link";

export type LegalLinkVariant = "compact" | "full";

const LINKS = [
  { href: "/security", label: "Security" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/acceptable-use", label: "Acceptable use" },
  { href: "/accessibility", label: "Accessibility" },
  { href: "/cookies", label: "Cookies" },
  { href: "/contact", label: "Contact" },
] as const;

export function LegalLinks({
  variant = "full",
  className = "",
  "aria-label": ariaLabel = "Legal and policies",
}: {
  variant?: LegalLinkVariant;
  className?: string;
  "aria-label"?: string;
}) {
  const items = variant === "compact" ? LINKS.slice(0, 3) : LINKS;
  // Compact (dashboard footer) reads at a quieter caps tracking so a short row
  // like "Security Privacy Terms" doesn't look like spaced-out noise; the full
  // marketing variant keeps its wider eyebrow tracking.
  const sizeTracking =
    variant === "compact" ? "text-[11px] tracking-[0.06em]" : "text-[10.5px] tracking-[0.14em]";

  return (
    <nav className={`ui-legal-links ${className}`.trim()} aria-label={ariaLabel}>
      {items.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          prefetch={false}
          className={`ui-nowrap-safe rounded-sm font-semibold uppercase leading-none text-[var(--text-tertiary)] no-underline transition-colors duration-[var(--ui-duration)] hover:text-[var(--accent-strong)] hover:underline hover:decoration-from-font hover:underline-offset-[3px] focus-visible:text-[var(--accent-strong)] focus-visible:underline focus-visible:decoration-from-font focus-visible:underline-offset-[3px] ${sizeTracking}`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
