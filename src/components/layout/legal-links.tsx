"use client";

import Link from "next/link";

export type LegalLinkVariant = "compact" | "full";

const LINKS = [
  { href: "/security", label: "Security" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
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
        <Link key={link.href} href={link.href} prefetch={false} className="ui-link">
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
