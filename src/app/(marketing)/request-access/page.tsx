import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Minus } from "lucide-react";
import { ContactForm } from "@/components/landing/contact-form";
import { LegalPageJsonLd } from "@/components/landing/legal-page-json-ld";
import { GradientPhrase } from "@/components/ui/gradient-phrase";
import { KeyValueChip } from "@/components/ui/key-value-chip";
import { ActionChip } from "@/components/ui/action-chip";

const title = "Request Access — Oblixa";
const description =
  "Request reviewed workspace access to Oblixa if your team tracks what signed contracts require next.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/request-access" },
  openGraph: { title, description, url: "/request-access", type: "article" },
  twitter: { card: "summary_large_image", title, description },
};

const fitChecklist = [
  "Signed contracts already exist and need operational follow-up",
  "A spreadsheet, folder, inbox, calendar, or memory is the current tracker",
  "Renewals, owners, contract requirements, evidence, or reports are becoming unreliable",
  "The first workspace can start with a bounded contract set",
] as const;

const boundaries = [
  "Not a CLM, drafting, redlining, or e-signature product",
  "Not legal advice or a replacement for your team's review",
  "Not a managed implementation, migration, or spreadsheet cleanup",
  "Not a formal enterprise procurement package",
] as const;

const priceFacts = [
  { label: "Core", value: "$249 per month" },
  { label: "Term", value: "Month-to-month" },
  { label: "Charged", value: "After approval & checkout" },
] as const;

const completionLinks = [
  { href: "/security", label: "Security" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
] as const;

const hairline = "color-mix(in oklab, var(--border-subtle) 70%, transparent)";

export default function RequestAccessPage() {
  return (
    <>
      <LegalPageJsonLd path="/request-access" title={title} description={description} />
      <main
        id="main-content"
        tabIndex={-1}
        className="landing-luminous landing-luminous--quiet relative isolate flex min-h-full flex-1 flex-col overflow-hidden outline-none"
      >
        <div aria-hidden className="landing-luminous__base" />
        <div aria-hidden className="landing-luminous__glow" />
        <div aria-hidden className="product-top-hairline" />

        <div className="relative mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
          {/* Compact identity band — declares the page's job; the headline carries
              the product promise. */}
          <header className="max-w-2xl">
            <p className="ui-caps-1 inline-flex items-center gap-1.5 text-[11px] text-[var(--accent-strong)]">
              <span className="landing-eyebrow-dot" aria-hidden />
              Workspace access
            </p>
            <h1
              className="mt-3 max-w-[18ch] text-balance text-[2rem] font-bold leading-[1.06] tracking-tight text-[var(--text-primary)] sm:text-[2.75rem]"
              style={{ letterSpacing: "-0.02em" }}
            >
              Track what signed contracts <GradientPhrase>require next</GradientPhrase>.
            </h1>
            <p className="mt-4 max-w-xl text-[14.5px] leading-[1.6] text-[var(--text-secondary)] sm:text-[15.5px]">
              Oblixa tracks renewals, owners, contract requirements, evidence, and reports after signature.
              Reviewed workspace access keeps the first workspace bounded — clear owner, data
              boundary, and a paid Core plan.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href="#request-access-form"
                className="ui-btn-primary inline-flex min-h-10 items-center gap-1.5 px-4 py-2 text-[13px] font-semibold"
              >
                Request access
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
              </a>
              <Link
                href="/product"
                className="ui-btn-ghost inline-flex min-h-10 items-center gap-1.5 px-3.5 py-2 text-[13px] font-semibold"
              >
                View product
              </Link>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {priceFacts.map((fact) => (
                <KeyValueChip key={fact.label} label={fact.label} value={fact.value} />
              ))}
            </div>
          </header>

          {/* Composed body: the form is the single focal card; the rail is one
              quiet panel. The form leads on mobile, then the rail. */}
          <div className="mt-8 grid gap-6 lg:mt-10 lg:grid-cols-[5fr_7fr] lg:items-start lg:gap-9">
            <section
              id="request-access-form"
              aria-label="Access request form"
              className="order-1 min-w-0 lg:order-2"
            >
              <div className="ui-card-raised relative overflow-hidden p-5 sm:p-7">
                <ContactForm />
              </div>
            </section>

            <aside className="order-2 min-w-0 lg:order-1 lg:sticky lg:top-8">
              <div className="ui-card-quiet p-5">
                <p className="ui-caps-1 inline-flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
                  <span className="landing-eyebrow-dot" aria-hidden />
                  Best fit
                </p>
                <ul className="mt-3 grid gap-2.5">
                  {fitChecklist.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2.5 text-[13px] leading-snug text-[var(--text-secondary)]"
                    >
                      <span
                        aria-hidden
                        className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                        style={{
                          background: "color-mix(in oklab, var(--success-ink) 14%, transparent)",
                          color: "var(--success-ink)",
                        }}
                      >
                        <Check className="h-2.5 w-2.5" strokeWidth={2.6} />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>

                <div className="mt-6 border-t pt-6" style={{ borderColor: hairline }}>
                  <p className="ui-caps-2 text-[10.5px] text-[var(--text-tertiary)]">Boundaries</p>
                  <p className="mt-2 text-[12.5px] leading-snug text-[var(--text-secondary)]">
                    Redacted sample contracts or a small low-risk subset are best for the first
                    workspace.
                  </p>
                  <ul className="mt-2.5 grid gap-1.5">
                    {boundaries.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2 text-[12px] leading-snug text-[var(--text-tertiary)]"
                      >
                        <span
                          aria-hidden
                          className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center text-[var(--text-tertiary)]"
                        >
                          <Minus className="h-3 w-3" strokeWidth={2} />
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div
                  className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t pt-6"
                  style={{ borderColor: hairline }}
                >
                  <p className="text-[12.5px] leading-snug text-[var(--text-secondary)]">
                    Questions before requesting access?
                  </p>
                  <ActionChip verb="Contact us" href="/contact" />
                </div>
              </div>
            </aside>
          </div>

          {/* Completion strip — closes the page with a quiet reassurance + trust
              links instead of empty canvas. */}
          <footer
            aria-label="More about Oblixa"
            className="mt-8 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between"
            style={{ borderColor: hairline }}
          >
            <p className="text-[12px] leading-snug text-[var(--text-tertiary)]">
              No account is created and no card is charged until access is approved and checkout is
              complete.
            </p>
            <nav aria-label="Trust and pricing" className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {completionLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded text-[12.5px] text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </footer>
        </div>
      </main>
    </>
  );
}
