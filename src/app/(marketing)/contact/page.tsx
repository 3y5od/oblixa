import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { ArrowDown, ArrowUpRight, BarChart3, Compass, ShieldCheck } from "lucide-react";
import { ContactForm } from "@/components/landing/contact-form";
import { LegalPageJsonLd } from "@/components/landing/legal-page-json-ld";

const title = "Contact — Oblixa";
const description =
  "Request Oblixa early access for a small contract-tracking evaluation, or share how your team tracks signed contracts today.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/contact" },
  openGraph: { title, description, url: "/contact", type: "article" },
  twitter: { card: "summary_large_image", title, description },
};

type CardTone = "cool" | "warm" | "amber";

const TONE_COLOR: Record<CardTone, string> = {
  cool: "var(--accent-strong)",
  warm: "var(--accent-warm, var(--accent))",
  amber: "var(--warning-ink)",
};

const TONE_BG: Record<CardTone, string> = {
  cool: "color-mix(in oklab, var(--accent-soft) 36%, var(--surface-raised))",
  warm: "color-mix(in oklab, var(--accent-soft) 28%, var(--surface-raised))",
  amber: "color-mix(in oklab, var(--warning-soft) 28%, var(--surface-raised))",
};

const TONE_BORDER: Record<CardTone, string> = {
  cool: "color-mix(in oklab, var(--accent) 24%, var(--border-subtle))",
  warm: "color-mix(in oklab, var(--accent-warm, var(--accent)) 22%, var(--border-subtle))",
  amber: "color-mix(in oklab, var(--warning-ink) 22%, var(--border-subtle))",
};

const quickLinks: Array<{
  href: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  tone: CardTone;
  icon: LucideIcon;
}> = [
  {
    href: "/pricing",
    eyebrow: "Pricing",
    title: "Review early-access pricing",
    subtitle: "Month-to-month after a small evaluation.",
    tone: "cool",
    icon: BarChart3,
  },
  {
    href: "/security",
    eyebrow: "Security",
    title: "Read security basics",
    subtitle: "Access, audit, export, deletion.",
    tone: "amber",
    icon: ShieldCheck,
  },
  {
    href: "/product",
    eyebrow: "Product",
    title: "View product tour",
    subtitle: "Seven sections, one tour.",
    tone: "warm",
    icon: Compass,
  },
];

export default function ContactPage() {
  return (
    <>
      <LegalPageJsonLd path="/contact" title={title} description={description} />
      <main
        id="main-content"
        tabIndex={-1}
        className="landing-luminous relative isolate flex min-h-full flex-1 flex-col overflow-hidden outline-none"
      >
        <div aria-hidden className="landing-luminous__base" />
        <div aria-hidden className="product-top-hairline" />
        <div className="relative mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
          {/* Hero */}
          <header className="text-center">
            <p className="ui-caps-1 inline-flex items-center gap-1.5 text-[11px] text-[var(--accent-strong)]">
              <span className="landing-eyebrow-dot" aria-hidden />
              Early access
            </p>
            <h1
              className="mx-auto mt-3 max-w-[20ch] text-balance text-[2rem] font-bold leading-[1.05] tracking-tight text-[var(--text-primary)] sm:text-[2.75rem]"
              style={{ letterSpacing: "-0.02em" }}
            >
              Request <span className="text-[var(--accent-strong)]">early access</span>.
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-balance text-[15px] leading-[1.6] text-[var(--text-secondary)] sm:text-[16px]">
              If a manual tracker is where your signed-contract renewals, owners, and
              reporting live, tell us about it and we can evaluate replacing it on a small
              set of contracts.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <a href="#contact-form" className="ui-btn-ghost inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold">
                Request early access
                <ArrowDown className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
              </a>
              <Link href="/product" className="ui-btn-secondary px-4 py-2 text-[13px] font-semibold">
                View product tour
              </Link>
            </div>
            <p className="ui-caps-3 mt-4 text-[10px] leading-none text-[var(--text-tertiary)]">
              Founder-led early access
              <span className="ui-dot-sep" aria-hidden>
                ·
              </span>
              No marketing list
            </p>
          </header>

          {/* Form card — the single focal surface on the shared content column. */}
          <div className="mt-8">
            <section
              id="contact-form"
              aria-label="Contact form"
              className="landing-card-premium relative overflow-hidden rounded-2xl border p-6 sm:p-8"
            >
              <ContactForm />
            </section>
          </div>

          {/* Below-fold quiet "Browse Oblixa" links on the shared content column. */}
          <div className="mt-10">
            <header className="text-center">
              <p className="ui-caps-1 inline-flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
                <span className="landing-eyebrow-dot" aria-hidden />
                Browse Oblixa
              </p>
            </header>
            <section
              aria-label="Other paths"
              className="mt-6 overflow-hidden rounded-2xl border border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] bg-[var(--surface-raised)]"
            >
              {quickLinks.map((l) => {
                const Icon = l.icon;
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="group flex items-center gap-3.5 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] px-4 py-3.5 text-[13.5px] transition-colors first:border-t-0 hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_8%,var(--surface-raised))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)] sm:px-5"
                  >
                    <span
                      aria-hidden
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
                      style={{
                        borderColor: TONE_BORDER[l.tone],
                        background: TONE_BG[l.tone],
                        color: TONE_COLOR[l.tone],
                      }}
                    >
                      <Icon className="h-4 w-4" strokeWidth={1.85} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="ui-caps-2 text-[10px] leading-none" style={{ color: TONE_COLOR[l.tone] }}>
                        {l.eyebrow}
                      </p>
                      <p className="mt-1.5 text-[14px] font-semibold leading-snug text-[var(--text-primary)]">
                        {l.title}
                      </p>
                      <p className="mt-0.5 text-[12px] leading-snug text-[var(--text-secondary)]">
                        {l.subtitle}
                      </p>
                    </div>
                    <span
                      aria-hidden
                      className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                    >
                      <span className="inline-flex items-center gap-0.5 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-strong)]">
                        OPEN
                        <ArrowUpRight className="h-2.5 w-2.5" strokeWidth={1.85} />
                      </span>
                    </span>
                  </Link>
                );
              })}
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
