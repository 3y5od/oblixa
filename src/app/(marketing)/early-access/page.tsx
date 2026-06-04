import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileSpreadsheet, ShieldCheck } from "lucide-react";
import { ContactForm } from "@/components/landing/contact-form";
import { LegalPageJsonLd } from "@/components/landing/legal-page-json-ld";
import { GradientPhrase } from "@/components/ui/gradient-phrase";

const title = "Early Access — Oblixa";
const description =
  "Request founder-led early access to Oblixa if your team is replacing a contract-tracking spreadsheet.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/early-access" },
  openGraph: { title, description, url: "/early-access", type: "article" },
  twitter: { card: "summary_large_image", title, description },
};

const fitBullets = [
  "Signed contracts already exist and need operational follow-up",
  "A spreadsheet, folder, inbox, calendar, or memory is the current tracker",
  "Renewals, owners, obligations, evidence, or reports are becoming unreliable",
  "The first evaluation can start with a small redacted or low-risk subset",
] as const;

const boundaries = [
  "Not a CLM, drafting, redlining, or e-signature product",
  "Not legal advice or a replacement for your team's review",
  "Not a managed implementation, migration, or spreadsheet cleanup service",
  "not intended for teams that require formal enterprise security review before evaluation",
] as const;

export default function EarlyAccessPage() {
  return (
    <>
      <LegalPageJsonLd path="/early-access" title={title} description={description} />
      <main
        id="main-content"
        tabIndex={-1}
        className="landing-luminous relative isolate flex min-h-full flex-1 flex-col overflow-hidden outline-none"
      >
        <div aria-hidden className="landing-luminous__base" />
        <div aria-hidden className="landing-luminous__glow" />
        <div aria-hidden className="landing-luminous__grid" />
        <div aria-hidden className="product-top-hairline" />

        <div className="relative mx-auto grid w-full max-w-6xl gap-8 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <section>
            <p className="ui-caps-1 inline-flex items-center gap-1.5 text-[11px] text-[var(--accent-strong)]">
              <span className="landing-eyebrow-dot" aria-hidden />
              Founder-led early access
            </p>
            <h1
              className="mt-3 max-w-[16ch] text-balance text-[2.5rem] font-bold leading-[1.04] tracking-tight text-[var(--text-primary)] sm:text-[3.75rem]"
              style={{ letterSpacing: "-0.02em" }}
            >
              Replace your <GradientPhrase>contract-tracking spreadsheet</GradientPhrase>.
            </h1>
            <p className="mt-5 max-w-2xl text-[15px] leading-[1.65] text-[var(--text-secondary)] sm:text-[17px]">
              Oblixa is taking a small number of founder-led evaluations for teams
              tracking signed contracts manually today.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#early-access-form" className="ui-btn-primary inline-flex min-h-10 items-center gap-1.5 px-4 py-2 text-[13px] font-semibold">
                Request early access
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
              </a>
              <Link href="/product" className="ui-btn-ghost inline-flex min-h-10 items-center gap-1.5 px-3.5 py-2 text-[13px] font-semibold">
                View product tour
              </Link>
            </div>

            <div className="mt-10 grid gap-4">
              <article className="rounded-2xl border border-[color:color-mix(in_oklab,var(--accent)_24%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_10%,var(--surface-raised))] p-5">
                <p className="ui-caps-2 inline-flex items-center gap-1.5 text-[10.5px] text-[var(--accent-strong)]">
                  <FileSpreadsheet className="h-3 w-3" strokeWidth={1.85} aria-hidden />
                  Best fit
                </p>
                <ul className="mt-3 grid gap-2">
                  {fitBullets.map((item) => (
                    <li key={item} className="text-[13.5px] leading-[1.55] text-[var(--text-secondary)]">
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
              <article className="rounded-2xl border border-[color:color-mix(in_oklab,var(--warning-ink)_24%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning-soft)_14%,var(--surface-raised))] p-5">
                <p className="ui-caps-2 inline-flex items-center gap-1.5 text-[10.5px] text-[var(--warning-ink)]">
                  <ShieldCheck className="h-3 w-3" strokeWidth={1.85} aria-hidden />
                  Boundaries
                </p>
                <p className="mt-2 text-[13.5px] leading-[1.55] text-[var(--text-secondary)]">
                  Redacted sample contracts or a small low-risk subset are best for the
                  first evaluation.
                </p>
                <ul className="mt-3 grid gap-2">
                  {boundaries.map((item) => (
                    <li key={item} className="text-[13.5px] leading-[1.55] text-[var(--text-secondary)]">
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            </div>
          </section>

          <section
            id="early-access-form"
            aria-label="Early access request form"
            className="landing-card-premium relative overflow-hidden rounded-2xl border p-6 sm:p-8"
          >
            <span
              aria-hidden
              className="landing-corner-ring"
              style={{ top: "-2rem", right: "-2rem", width: "8rem", height: "8rem" }}
            />
            <div className="relative">
              <ContactForm />
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
