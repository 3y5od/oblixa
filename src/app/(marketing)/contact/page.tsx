import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { ArrowUpRight, BarChart3, Compass, ShieldCheck } from "lucide-react";
import { ContactForm } from "@/components/landing/contact-form";
import { LegalPageJsonLd } from "@/components/landing/legal-page-json-ld";
import { GradientPhrase } from "@/components/ui/gradient-phrase";

const title = "Contact — Oblixa";
const description =
  "Talk to Oblixa about Core, security and DPA requests, the Founding Customer offer, the guided pilot, or larger-team workflows. We respond within one business day.";

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
    title: "See Core pricing",
    subtitle: "$249/mo billed annually.",
    tone: "cool",
    icon: BarChart3,
  },
  {
    href: "/security",
    eyebrow: "Security",
    title: "Read our practices",
    subtitle: "Access, audit, export, DPA.",
    tone: "amber",
    icon: ShieldCheck,
  },
  {
    href: "/product",
    eyebrow: "Product",
    title: "See how it works",
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
        <div aria-hidden className="landing-luminous__glow" />
        <div aria-hidden className="landing-luminous__grid" />
        <div aria-hidden className="product-top-hairline" />
        <span
          aria-hidden
          className="pointer-events-none absolute -right-40 -top-32 hidden h-[480px] w-[480px] rounded-full opacity-50 blur-3xl md:block"
          style={{
            background:
              "radial-gradient(circle, color-mix(in oklab, var(--accent-strong) 8%, transparent), transparent 70%)",
          }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -left-40 bottom-12 hidden h-[480px] w-[480px] rounded-full opacity-40 blur-3xl md:block"
          style={{
            background:
              "radial-gradient(circle, color-mix(in oklab, var(--success-ink) 8%, transparent), transparent 70%)",
          }}
        />
        {/* Tertiary blob — breaks the visual void around the constrained
            max-w-3xl form card within the wider max-w-7xl container. */}
        <span
          aria-hidden
          className="pointer-events-none absolute right-[12%] top-[42%] hidden h-[280px] w-[280px] rounded-full opacity-30 blur-3xl lg:block"
          style={{
            background:
              "radial-gradient(circle, color-mix(in oklab, var(--accent-warm) 10%, transparent), transparent 70%)",
          }}
        />

        <div className="relative mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
          {/* Hero */}
          <header className="text-center">
            <p className="ui-caps-1 inline-flex items-center gap-1.5 text-[11px] text-[var(--accent-strong)]">
              <span className="landing-eyebrow-dot" aria-hidden />
              Contact
            </p>
            <h1
              className="mx-auto mt-3 max-w-[20ch] text-balance text-[2.25rem] font-bold leading-[1.05] tracking-tight text-[var(--text-primary)] sm:text-[3rem] md:text-[3.5rem]"
              style={{ letterSpacing: "-0.02em" }}
            >
              Book a <GradientPhrase>setup call</GradientPhrase>.
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-balance text-[15px] leading-[1.6] text-[var(--text-secondary)] sm:text-[16px]">
              Tell us what you&apos;re trying to solve.
            </p>
            <div className="mt-5 flex justify-center">
              <div className="inline-flex flex-wrap divide-x divide-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)] rounded-md border border-[color:color-mix(in_oklab,var(--border-subtle)_45%,transparent)] text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                <span className="px-3 py-1.5">1-day reply</span>
                <span className="px-3 py-1.5">No marketing list</span>
              </div>
            </div>
          </header>

          {/* Form card — constrained inner width within the wider container. */}
          <div className="mx-auto mt-10 max-w-3xl">
            <section
              aria-label="Contact form"
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

          {/* Below-fold "Browse Oblixa" cards — wider than the form to read as a
              separate surface. Self-serve card dropped (registration); replaced
              with Product tour. */}
          <div className="mx-auto mt-14 max-w-5xl">
            <header className="text-center">
              <p className="ui-caps-1 inline-flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
                <span className="landing-eyebrow-dot" aria-hidden />
                Browse Oblixa
              </p>
            </header>
            <section
              aria-label="Other paths"
              className="mt-6 grid gap-3 sm:grid-cols-3"
            >
              {quickLinks.map((l) => {
                const Icon = l.icon;
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="group relative rounded-2xl border bg-[var(--surface-raised)] p-5 text-[13.5px] transition-all hover:-translate-y-px hover:border-[color:color-mix(in_oklab,var(--accent)_30%,var(--border-strong))] hover:shadow-[0_8px_24px_-12px_color-mix(in_oklab,var(--accent-strong)_18%,transparent)] sm:p-6"
                    style={{
                      borderColor: "color-mix(in oklab, var(--border-subtle) 70%, transparent)",
                      borderLeftWidth: "2px",
                      borderLeftColor: TONE_COLOR[l.tone],
                    }}
                  >
                    <span
                      aria-hidden
                      className="absolute right-4 top-4 inline-flex h-6 w-6 items-center justify-center opacity-50 transition-opacity group-hover:opacity-100"
                      style={{ color: TONE_COLOR[l.tone] }}
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.85} />
                    </span>
                    <span
                      aria-hidden
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border"
                      style={{
                        borderColor: TONE_BORDER[l.tone],
                        background: TONE_BG[l.tone],
                        color: TONE_COLOR[l.tone],
                      }}
                    >
                      <Icon className="h-4 w-4" strokeWidth={1.85} />
                    </span>
                    <p
                      className="ui-caps-2 mt-2.5 text-[10.5px]"
                      style={{ color: TONE_COLOR[l.tone] }}
                    >
                      {l.eyebrow}
                    </p>
                    <p className="mt-2 text-[16px] font-semibold text-[var(--text-primary)]">
                      {l.title}
                    </p>
                    <p className="mt-1 text-[12.5px] leading-[1.55] text-[var(--text-secondary)]">
                      {l.subtitle}
                    </p>
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
