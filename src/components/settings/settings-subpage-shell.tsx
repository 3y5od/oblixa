import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";

export interface SettingsSubpageShellProps {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  lead?: ReactNode;
  /** Header right-aligned action cluster. */
  actions?: ReactNode;
  /** Full-width identity / metadata strip rendered below the header on a hairline.
   *  Pass compact key/value chips here — keep labels caps and user values plain. */
  identity?: ReactNode;
  /** Accessible label for the identity strip's <dl>. */
  identityLabel?: string;
  backLabel?: string;
  backHref?: string;
  /** First focusable skip link (target id + visible label) when the page wants one. */
  skipLink?: { href: string; label: string };
  density?: "compact" | "default";
  children: ReactNode;
}

const SKIP_LINK_CLASS =
  "ui-skip-link sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-md focus:bg-[var(--surface-raised)] focus:px-3 focus:py-2 focus:text-[var(--text-primary)]";

/**
 * One shared frame for settings sub-pages (Security, Billing, Notifications):
 * optional skip link, a "Back to settings" pill, the flat DashboardPageHeader,
 * an optional identity strip on a hairline, and the page content — all inside a
 * consistent max-w-5xl page stack. Page-specific content goes in `children`.
 */
export function SettingsSubpageShell({
  icon,
  eyebrow,
  title,
  lead,
  actions,
  identity,
  identityLabel,
  backLabel = "Back to settings",
  backHref = "/settings",
  skipLink,
  density,
  children,
}: SettingsSubpageShellProps) {
  return (
    <div className="ui-page-stack mx-auto max-w-5xl gap-5">
      {skipLink ? (
        <a href={skipLink.href} className={SKIP_LINK_CLASS}>
          {skipLink.label}
        </a>
      ) : null}
      <Link
        href={backHref}
        className="ui-btn-ghost inline-flex max-w-max items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px] billing-no-print"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        {backLabel}
      </Link>
      <div className="flex flex-col gap-4">
        <DashboardPageHeader
          icon={icon}
          eyebrow={eyebrow}
          title={title}
          lead={lead}
          actions={actions}
          density={density}
        />
        {identity ? (
          <dl
            aria-label={identityLabel}
            className="billing-no-print flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-[var(--border-subtle)] pt-3.5"
          >
            {identity}
          </dl>
        ) : null}
      </div>
      {children}
    </div>
  );
}

/** Compact identity chip for the shell's `identity` strip: caps label + plain
 *  (non-uppercased) value, so workspace names and emails never read as shouting. */
export function IdentityChip({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2.5 py-1${className ? ` ${className}` : ""}`}
    >
      <dt className="ui-caps-3 text-[var(--text-tertiary)]">{label}</dt>
      <dd className="min-w-0 text-[12px] text-[var(--text-secondary)]">{children}</dd>
    </div>
  );
}
