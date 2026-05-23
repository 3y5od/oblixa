import type { Metadata } from "next";
import { Accessibility, Keyboard, Eye, MessagesSquare } from "lucide-react";
import { LegalPageJsonLd } from "@/components/landing/legal-page-json-ld";

const title = "Accessibility — Oblixa";
const description =
  "Accessibility commitment for Oblixa marketing pages and the product experience. Feedback welcome.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/accessibility" },
  openGraph: { title, description, url: "/accessibility", type: "article" },
  twitter: { card: "summary_large_image", title, description },
};

export default function AccessibilityPage() {
  return (
    <>
      <LegalPageJsonLd path="/accessibility" title={title} description={description} />
      <main
        id="main-content"
        tabIndex={-1}
        className="landing-luminous relative isolate flex min-h-full flex-1 flex-col overflow-hidden outline-none"
      >
        <div aria-hidden className="landing-luminous__base" />
        <div aria-hidden className="landing-luminous__glow" />
        <div aria-hidden className="landing-luminous__grid" />
        <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
          <article className="landing-card-premium landing-card-rail relative overflow-hidden rounded-2xl border p-7 sm:p-10">
            <div className="flex items-start gap-4">
              <span
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_24%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_38%,var(--surface-raised))] text-[var(--accent-strong)] shadow-[var(--shadow-1)]"
                aria-hidden
              >
                <Accessibility className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="landing-eyebrow-dot text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                  Inclusive design
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-3xl">
                  Accessibility
                </h1>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  Our public commitments for keyboard, visible focus, and semantic structure.
                </p>
              </div>
            </div>

            <p className="mt-8 text-sm leading-relaxed text-[var(--text-secondary)]">
              We aim to keep primary flows keyboard accessible, preserve visible focus, and use semantic
              structure on public marketing pages. The authenticated product is exercised in CI with
              accessibility checks on a defined route matrix; coverage expands as surfaces evolve.
            </p>

            <div className="mt-10 space-y-7">
              <div className="flex gap-4">
                <span
                  className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--accent-soft)_22%,var(--surface-raised))] text-[var(--accent-strong)]"
                  aria-hidden
                >
                  <Keyboard className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-[var(--text-primary)]">Keyboard navigation</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
                    Primary navigation, forms, and disclosures are reachable with the keyboard. Tab order
                    matches visual order; skip links jump straight to main content.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <span
                  className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--accent-soft)_22%,var(--surface-raised))] text-[var(--accent-strong)]"
                  aria-hidden
                >
                  <Eye className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-[var(--text-primary)]">Visible focus &amp; contrast</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
                    Focus rings are preserved on every interactive element. Color choices target WCAG AA
                    contrast on standard text in both light and dark color schemes.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-10 rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_20%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,var(--surface-raised))] p-5">
              <div className="flex items-start gap-3">
                <span
                  className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[color:color-mix(in_oklab,var(--accent)_30%,var(--border-subtle))] bg-[var(--surface-raised)] text-[var(--accent-strong)]"
                  aria-hidden
                >
                  <MessagesSquare className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-[var(--text-primary)]">Reporting a barrier</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
                    If you cannot complete a task because of a barrier in the UI, contact your workspace
                    administrator or the support channel your organization uses for Oblixa so we can route
                    feedback to the right team.
                  </p>
                </div>
              </div>
            </div>
          </article>
        </div>
      </main>
    </>
  );
}
