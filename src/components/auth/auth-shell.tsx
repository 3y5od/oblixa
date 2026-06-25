import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LegalLinks } from "@/components/layout/legal-links";
import { BRAND_TILE_CLASS } from "@/components/ui/brand-tile";
import { AuthLegalFooter } from "./auth-legal-footer";
import { MAIN_CONTENT_ID } from "@/lib/qa/test-ids";

/** Shared inner width for all three page zones (rail, body, footer) so they line
 *  up on one desktop grid. */
const ZONE = "mx-auto w-full max-w-[75rem] px-5 sm:px-8";

/** Quiet plain back-to-home link in the header rail. Plain text, no pill, so it
 *  reads as wayfinding rather than an action. */
export function BackHomeLink() {
  return (
    <Link
      href="/"
      className="inline-flex max-w-max items-center gap-1.5 rounded-sm text-[12.5px] font-medium text-[var(--text-tertiary)] no-underline transition-colors hover:text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--canvas)]"
    >
      <ArrowLeft className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
      Back to home
    </Link>
  );
}

/** Brand lockup — de-glossed square tile + bold wordmark. Anchors the header
 *  rail on the desktop grid. */
export function BrandMark() {
  return (
    <Link
      href="/"
      aria-label="Oblixa home"
      className="group inline-flex items-center gap-2.5 rounded-lg no-underline outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--canvas)]"
    >
      <span className={`${BRAND_TILE_CLASS} h-9 w-9 text-[15px] font-bold`} aria-hidden>
        O
      </span>
      <span className="text-[18px] font-bold leading-none tracking-tight text-[var(--text-primary)] transition-opacity group-hover:opacity-85">
        Oblixa
      </span>
    </Link>
  );
}

export type AuthCardTone = "neutral" | "warning" | "success";

/**
 * The sign-in panel — the primary object: a refined near-white sheet (hairline
 * border, subtle shadow, 8px radius, generous padding) constrained to a readable
 * form width. A terminal state may tint the border (warning/success); the normal
 * sign-in panel is neutral.
 */
export function AuthCard({ children, tone }: { children: ReactNode; tone?: AuthCardTone }) {
  const borderColor =
    tone === "warning"
      ? "color-mix(in oklab, var(--warning-ink) 40%, var(--border-card))"
      : tone === "success"
        ? "color-mix(in oklab, var(--success-ink) 40%, var(--border-card))"
        : "color-mix(in oklab, var(--border-strong) 44%, var(--border-subtle))";
  return (
    <div
      className="relative rounded-[8px] border bg-[var(--surface-raised)] p-8 shadow-[var(--shadow-1)] sm:p-9"
      style={{ borderColor }}
    >
      {children}
    </div>
  );
}

/**
 * Auth page shell — a full-viewport account-access surface built from three
 * page-wide zones: a header rail, a centered auth/access grid, and a footer
 * band, all spanning the viewport with full-width rules and aligned to one
 * desktop content width. Only the sign-in form stays narrow; an optional
 * operational access panel fills the second column (login). No product proof.
 */
export function AuthShell({
  accessPanel,
  children,
}: {
  /** Operational access panel shown beside the form (login). */
  accessPanel?: ReactNode;
  /** The auth column (form panel + callout). */
  children: ReactNode;
}) {
  return (
    <main
      id={MAIN_CONTENT_ID}
      tabIndex={-1}
      className="relative isolate flex min-h-full flex-1 flex-col bg-[var(--canvas)] outline-none"
    >
      {/* Full-width top rule — the page edge. */}
      <div
        aria-hidden
        className="h-px w-full bg-[color:color-mix(in_oklab,var(--border-strong)_38%,transparent)]"
      />

      {/* Header rail — a page-wide band. */}
      <header className="w-full border-b border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-muted)_20%,transparent)]">
        <div className={`${ZONE} flex items-center justify-between gap-4 py-5`}>
          <BrandMark />
          <BackHomeLink />
        </div>
      </header>

      {/* Main — the auth/access grid, centered in the viewport. */}
      <div className="flex w-full flex-1 items-center py-12 sm:py-16">
        <div className={ZONE}>
          {accessPanel ? (
            <div className="grid items-start gap-x-16 gap-y-10 lg:grid-cols-[40rem_minmax(0,1fr)]">
              <div className="min-w-0">{children}</div>
              <div className="min-w-0">{accessPanel}</div>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-[40rem]">{children}</div>
          )}
        </div>
      </div>

      {/* Footer — a page-wide bottom legal band. */}
      <footer className="w-full border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-muted)_22%,transparent)]">
        <div className={`${ZONE} flex flex-col gap-3 py-7 sm:flex-row sm:items-start sm:justify-between sm:gap-8`}>
          <LegalLinks variant="legal-min" className="gap-x-5 gap-y-1.5" />
          <AuthLegalFooter />
        </div>
      </footer>
    </main>
  );
}
