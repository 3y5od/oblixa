import type { AnchorHTMLAttributes, ReactNode } from "react";
import { ExternalLink } from "./external-link";

export function ApiJsonLink({
  href,
  children,
  className = "ui-link inline-flex items-center gap-1",
  badge = "JSON",
  ...props
}: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  children: ReactNode;
  badge?: string;
}) {
  return (
    <ExternalLink
      {...props}
      href={href}
      className={className}
      suffix={
        <span aria-hidden className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
          {badge} ↗
        </span>
      }
    >
      {children}
    </ExternalLink>
  );
}