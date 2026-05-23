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

  return (
    <nav className={`ui-legal-links ${className}`.trim()} aria-label={ariaLabel}>
      {items.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          prefetch={false}
          className="rounded-sm text-[10.5px] font-semibold uppercase tracking-[0.14em] leading-none text-[var(--text-tertiary)] no-underline transition-colors duration-[var(--ui-duration)] hover:text-[var(--accent-strong)] hover:underline hover:decoration-from-font hover:underline-offset-[3px] focus-visible:text-[var(--accent-strong)] focus-visible:underline focus-visible:decoration-from-font focus-visible:underline-offset-[3px]"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
