import type { AnchorHTMLAttributes, ReactNode } from "react";
import { sanitizeExternalHref } from "@/lib/security/safe-external-href";

function mergeRel(rel?: string) {
  const parts = new Set(["noreferrer", "noopener"]);
  for (const token of (rel ?? "").split(/\s+/).filter(Boolean)) parts.add(token);
  return [...parts].join(" ");
}

export function ExternalLink({
  href,
  children,
  className = "",
  rel,
  suffix,
  ...props
}: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  children: ReactNode;
  suffix?: ReactNode;
}) {
  const safeHref = sanitizeExternalHref(href);
  if (!safeHref) {
    return (
      <span aria-disabled="true" className={`${className}`.trim() || undefined}>
        <span>{children}</span>
      </span>
    );
  }

  return (
    <a
      {...props}
      href={safeHref}
      target="_blank"
      rel={mergeRel(rel)}
      className={`${className}`.trim() || undefined}
    >
      <span>{children}</span>
      {suffix ?? <span aria-hidden className="ml-1 text-[0.9em]">↗</span>}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
