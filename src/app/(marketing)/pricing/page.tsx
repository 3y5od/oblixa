import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  Check,
  HandHeart,
  LifeBuoy,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { LegalPageJsonLd } from "@/components/landing/legal-page-json-ld";
import { GradientPhrase } from "@/components/ui/gradient-phrase";

const title = "Pricing — Oblixa";
const description =
  "Simple pricing for contract tracking. Core $249/mo billed annually. 21-day free trial, no credit card required.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/pricing" },
  openGraph: { title, description, url: "/pricing", type: "article" },
  twitter: { card: "summary_large_image", title, description },
};

/* ────────────────────────────────────────────────────────────────────────────
   Tone tokens — used by Core feature grid + FAQ category labels + offer cards.
   Mirrors the /security TONE pattern.
   ──────────────────────────────────────────────────────────────────────────── */
type Tone = "cool" | "warm" | "amber" | "success" | "neutral";

const TONE: Record<Tone, { color: string; bg: string; border: string }> = {
  cool: {
    color: "var(--accent-strong)",
    bg: "color-mix(in oklab, var(--accent-soft) 42%, var(--surface-raised))",
    border: "color-mix(in oklab, var(--accent) 28%, var(--border-subtle))",
  },
  warm: {
    color: "var(--accent-warm, var(--accent))",
    bg: "color-mix(in oklab, var(--accent-soft) 30%, var(--surface-raised))",
    border: "color-mix(in oklab, var(--accent-warm, var(--accent)) 28%, var(--border-subtle))",
  },
  amber: {
    color: "var(--warning-ink)",
    bg: "color-mix(in oklab, var(--warning-soft) 30%, var(--surface-raised))",
    border: "color-mix(in oklab, var(--warning-ink) 26%, var(--border-subtle))",
  },
  success: {
    color: "var(--success-ink)",
    bg: "color-mix(in oklab, var(--success-soft) 30%, var(--surface-raised))",
    border: "color-mix(in oklab, var(--success-ink) 26%, var(--border-subtle))",
  },
  neutral: {
    color: "var(--text-secondary)",
    bg: "var(--surface-raised)",
    border: "var(--border-subtle)",
  },
};

/* ────────────────────────────────────────────────────────────────────────────
   Core plan feature groups — visual grid with per-category icon + tone.
   Replaces the prior caps-category-+-bullet-list pattern (read as feature
   spec sheet) with a denser 3-col grid of tone-coded tiles.
   ──────────────────────────────────────────────────────────────────────────── */
type CoreFeatureGroup = {
  heading: string;
  icon: LucideIcon;
  tone: Tone;
  items: string[];
};

const corePlanFeatureGroups: CoreFeatureGroup[] = [
  {
    heading: "Limits",
    icon: Users,
    tone: "cool",
    items: ["Up to 500 active contracts", "Up to 10 team members"],
  },
  {
    heading: "Capture",
    icon: Sparkles,
    tone: "warm",
    items: [
      "Contract upload and import",
      "AI-assisted extraction",
      "Source-backed field review",
    ],
  },
  {
    heading: "Day-to-day",
    icon: CalendarClock,
    tone: "cool",
    items: [
      "Renewals and deadlines",
      "Work, approvals, obligations, exceptions",
      "Evidence requests",
      "Email reminders",
    ],
  },
  {
    heading: "Output",
    icon: BarChart3,
    tone: "success",
    items: ["Reports and CSV export"],
  },
  {
    heading: "Team & support",
    icon: LifeBuoy,
    tone: "neutral",
    items: ["Team roles", "Standard support", "21-day free trial"],
  },
];

/* ────────────────────────────────────────────────────────────────────────────
   FAQ — 8 spec-mandated questions + 3 sensible additions, grouped into 4
   tone-coded categories.
   ──────────────────────────────────────────────────────────────────────────── */
type FaqItem = { id: string; question: string; answer: ReactNode };

const TRIAL_FAQS: FaqItem[] = [
  {
    id: "faq-trial-card",
    question: "Is a credit card required for the trial?",
    answer:
      "No. The 21-day free trial does not require a credit card. You only enter payment information if you choose to continue on a paid plan.",
  },
  {
    id: "faq-trial-after",
    question: "What happens after the trial?",
    answer:
      "Your data stays available. Choose a plan to keep tracking renewals, work, evidence, and reports — or export everything to CSV and continue in your existing tools.",
  },
  {
    id: "faq-trial-limits",
    question: "What are the trial limits?",
    answer:
      "The 21-day trial includes up to 25 contracts, up to 3 team members, fair-use AI extraction, and CSV export. No credit card required.",
  },
];

const LIMITS_FAQS: FaqItem[] = [
  {
    id: "faq-active-contract",
    question: "What counts as an active contract?",
    answer:
      "A signed contract record that is being tracked in your workspace. Archived contracts, expired-without-renewal contracts, and template drafts do not count toward your plan limit.",
  },
  {
    id: "faq-more-than-500",
    question: "What if we have more than 500 contracts?",
    answer: (
      <>
        Reach out for{" "}
        <Link
          href="#custom-plans"
          className="ui-link font-medium text-[var(--text-primary)]"
        >
          custom pricing
        </Link>
        {" "}— we will size the plan to your contract volume and team.
      </>
    ),
  },
  {
    id: "faq-more-team-members",
    question: "Can we add more team members?",
    answer: (
      <>
        Yes. The Core plan includes up to 10 team members. Larger teams are available on{" "}
        <Link
          href="#custom-plans"
          className="ui-link font-medium text-[var(--text-primary)]"
        >
          custom plans
        </Link>
        .
      </>
    ),
  },
];

const BILLING_FAQS: FaqItem[] = [
  {
    id: "faq-annual-billing",
    question: "Do you offer annual billing?",
    answer:
      "Yes. The Core annual plan is $2,988/year ($249/month). Monthly billing is also available at $299/month.",
  },
  {
    id: "faq-cancel",
    question: "What happens if I cancel?",
    answer:
      "Cancel from your workspace settings. Your data stays exportable for 30 days after cancellation.",
  },
  {
    id: "faq-change-plans",
    question: "Can we change plans later?",
    answer:
      "Yes. Upgrade or downgrade by contacting us — we will prorate the difference.",
  },
];

const SETUP_FAQS: FaqItem[] = [
  {
    id: "faq-setup-help",
    question: "Do you offer setup help?",
    answer: (
      <>
        Yes. The{" "}
        <Link
          href="#founding-customer"
          className="ui-link font-medium text-[var(--text-primary)]"
        >
          Founding Customer Offer
        </Link>
        {" "}and the{" "}
        <Link
          href="#guided-pilot"
          className="ui-link font-medium text-[var(--text-primary)]"
        >
          60-day Guided Pilot
        </Link>
        {" "}both include a setup call and import help.
      </>
    ),
  },
  {
    id: "faq-export-anytime",
    question: "Can I export my data anytime?",
    answer:
      "Yes. Export reports and contract records as CSV at any time, on every plan.",
  },
  {
    id: "faq-ai-training",
    question: "Does Oblixa train AI models on our contracts?",
    answer: (
      <>
        No. Extraction runs on our own infrastructure and your contract content is not used to train third-party models. See{" "}
        <Link
          href="/security#not-stored"
          prefetch={false}
          className="ui-link font-medium text-[var(--text-primary)]"
        >
          what Oblixa does not store
        </Link>
        .
      </>
    ),
  },
];

const FAQ_GROUPS: Array<{ id: string; label: string; tone: Tone; items: FaqItem[] }> = [
  { id: "trial", label: "Trial", tone: "cool", items: TRIAL_FAQS },
  { id: "limits", label: "Plan limits", tone: "warm", items: LIMITS_FAQS },
  { id: "billing", label: "Billing & cancellation", tone: "amber", items: BILLING_FAQS },
  { id: "setup", label: "Setup & data", tone: "success", items: SETUP_FAQS },
];

/* ────────────────────────────────────────────────────────────────────────────
   Sub-nav anchors — sticky in-page navigation at lg+.
   ──────────────────────────────────────────────────────────────────────────── */
const SUB_NAV: Array<{ href: string; label: string }> = [
  { href: "#oblixa-core", label: "Core" },
  { href: "#founding-customer", label: "Founding" },
  { href: "#guided-pilot", label: "Pilot" },
  { href: "#custom-plans", label: "Custom" },
  { href: "#pricing-faq-heading", label: "FAQ" },
];

export default function PricingPage() {
  return (
    <>
      <LegalPageJsonLd path="/pricing" title={title} description={description} />
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
          style={{ background: "radial-gradient(circle, color-mix(in oklab, var(--accent-strong) 8%, transparent), transparent 70%)" }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -left-40 bottom-12 hidden h-[480px] w-[480px] rounded-full opacity-40 blur-3xl md:block"
          style={{ background: "radial-gradient(circle, color-mix(in oklab, var(--success-ink) 8%, transparent), transparent 70%)" }}
        />

        <div className="relative mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
          {/* Hero — bigger h1 with gradient wedge phrase. */}
          <header className="text-center">
            <p className="ui-caps-1 inline-flex items-center gap-1.5 text-[11px] text-[var(--accent-strong)]">
              <span className="landing-eyebrow-dot" aria-hidden />
              Pricing
            </p>
            <h1
              className="mx-auto mt-3 max-w-[22ch] text-balance text-[2.75rem] font-bold leading-[1.02] tracking-tight text-[var(--text-primary)] sm:text-[3.75rem] md:text-[4.5rem] lg:text-[5rem]"
              style={{ letterSpacing: "-0.025em" }}
            >
              Simple pricing for <GradientPhrase>contract tracking</GradientPhrase>.
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-balance text-[15px] leading-[1.6] text-[var(--text-secondary)] sm:text-[17px]">
              One plan. No seat upsell. Cancel anytime.
            </p>
          </header>

          {/* Sub-nav — sticky at lg+ for jump-to-section. */}
          <nav
            aria-label="Pricing sections"
            className="sticky top-0 z-20 mx-auto mt-10 hidden max-w-5xl items-center justify-center gap-1.5 rounded-full border border-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)] bg-[color:color-mix(in_oklab,var(--surface)_82%,transparent)] px-3 py-2 backdrop-blur-md lg:flex"
          >
            {SUB_NAV.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="inline-flex items-center rounded-full px-4 py-1.5 text-[14px] font-semibold tracking-tight text-[var(--text-secondary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_22%,transparent)] hover:text-[var(--text-primary)]"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Core plan card */}
          <section
            id="oblixa-core"
            aria-label="Oblixa Core plan"
            className="landing-card-premium relative mx-auto mt-10 max-w-5xl scroll-mt-32 overflow-hidden rounded-3xl border p-8 sm:mt-12 sm:p-12"
          >
            <span
              aria-hidden
              className="landing-corner-ring"
              style={{ top: "-2rem", right: "-2rem", width: "8rem", height: "8rem" }}
            />

            {/* Top band — stamp + big price + Annual/Monthly pill + CTAs +
                trial-includes strip, all centered and spanning the card width. */}
            <div className="relative text-center">
              <span
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em]"
                style={{
                  borderColor: TONE.cool.border,
                  background: TONE.cool.bg,
                  color: TONE.cool.color,
                }}
              >
                <Sparkles className="h-3 w-3" strokeWidth={1.85} aria-hidden />
                Oblixa Core
              </span>

              <div className="mt-6 flex items-baseline justify-center gap-2 text-[var(--text-primary)]">
                <span
                  className="text-[3.75rem] font-bold leading-none tracking-tight sm:text-[4.75rem] md:text-[5.5rem]"
                  style={{ fontVariantNumeric: "tabular-nums lining-nums slashed-zero", letterSpacing: "-0.03em" }}
                >
                  $249
                </span>
                <span className="text-[24px] font-medium leading-none text-[var(--text-secondary)] sm:text-[28px] md:text-[32px]">
                  /mo
                </span>
              </div>

              {/* Annual / Monthly pill — replaces the prior awkward billing
                  sentence with a divided chip pair. */}
              <div className="mt-5 flex justify-center">
                <div className="inline-flex divide-x divide-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)] rounded-md border border-[color:color-mix(in_oklab,var(--border-subtle)_45%,transparent)] text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                  <span className="px-3 py-1.5">
                    Annual <span className="tabular-nums text-[var(--text-secondary)]">$249/mo</span>
                  </span>
                  <span className="px-3 py-1.5">
                    Monthly <span className="tabular-nums text-[var(--text-secondary)]">$299/mo</span>
                  </span>
                </div>
              </div>

              <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/signup"
                  className="product-cta-halo ui-btn-primary inline-flex min-h-11 items-center gap-1.5 px-5 py-2.5 text-[14px] font-semibold"
                >
                  Start free trial
                  <ArrowRight className="h-4 w-4" strokeWidth={1.85} aria-hidden />
                </Link>
                <Link
                  href="/contact?interested=core"
                  prefetch={false}
                  className="ui-btn-ghost inline-flex min-h-11 items-center gap-1.5 px-4 py-2.5 text-[14px] font-semibold"
                >
                  Book setup call
                </Link>
              </div>

              {/* Trial-includes strip carries the no-credit-card claim. The
                  standalone "21-day free trial — no credit card required." line
                  was dropped (was redundant with this strip). */}
              <div className="mt-5 flex justify-center">
                <div className="inline-flex flex-wrap justify-center divide-x divide-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] rounded-md border border-[color:color-mix(in_oklab,var(--border-subtle)_50%,transparent)] text-[11.5px] font-semibold text-[var(--text-tertiary)]">
                  <span className="px-2.5 py-1.5">
                    <span className="tabular-nums text-[var(--text-secondary)]">21</span>-day trial
                  </span>
                  <span className="px-2.5 py-1.5">
                    <span className="mr-1.5 tabular-nums text-[var(--text-secondary)]">25</span>contracts
                  </span>
                  <span className="px-2.5 py-1.5">
                    <span className="mr-1.5 tabular-nums text-[var(--text-secondary)]">3</span>users
                  </span>
                  <span className="px-2.5 py-1.5">CSV export</span>
                  <span className="px-2.5 py-1.5">No credit card</span>
                </div>
              </div>
            </div>

            {/* Divider hairline */}
            <div
              aria-hidden
              className="my-8 h-px bg-gradient-to-r from-transparent via-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] to-transparent sm:my-10"
            />

            {/* Feature grid — replaces the prior caps-category-+-bullet stack.
                Each cell carries a tone-coded medallion + heading + bullet items. */}
            <div className="relative">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                Everything in Core
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {corePlanFeatureGroups.map((group) => {
                  const tone = TONE[group.tone];
                  const Icon = group.icon;
                  return (
                    <div
                      key={group.heading}
                      className="rounded-2xl border border-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)] bg-[color:color-mix(in_oklab,var(--surface)_85%,transparent)] p-5"
                    >
                      <span
                        aria-hidden
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border"
                        style={{ borderColor: tone.border, background: tone.bg, color: tone.color }}
                      >
                        <Icon className="h-4 w-4" strokeWidth={1.85} />
                      </span>
                      <p
                        className="mt-3 text-[11px] font-bold uppercase tracking-[0.18em]"
                        style={{ color: tone.color }}
                      >
                        {group.heading}
                      </p>
                      <ul className="mt-2 space-y-2">
                        {group.items.map((item) => (
                          <li
                            key={item}
                            className="flex items-start gap-2 text-[13.5px] leading-[1.5] text-[var(--text-secondary)]"
                          >
                            <Check
                              className="mt-0.5 h-4 w-4 shrink-0"
                              strokeWidth={1.85}
                              style={{ color: tone.color }}
                              aria-hidden
                            />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Founding + Pilot + Custom — 3-col grid at lg+, 1-col stack below.
              Custom is promoted from a separate orphan section to a peer card. */}
          <div className="mx-auto mt-6 grid max-w-6xl gap-4 sm:mt-8 lg:grid-cols-3">
            {/* Founding Customer — limited offer (amber-toned eyebrow). */}
            <section
              id="founding-customer"
              className="relative scroll-mt-32 overflow-hidden rounded-2xl border p-7 sm:p-8"
              style={{
                borderColor: "color-mix(in oklab, var(--accent) 38%, var(--border-subtle))",
                background:
                  "radial-gradient(ellipse 60% 50% at 100% 0%, color-mix(in oklab, var(--accent) 14%, transparent), transparent 70%), color-mix(in oklab, var(--accent-soft) 10%, var(--surface-raised))",
                boxShadow: "0 0 0 1px color-mix(in oklab, var(--accent) 18%, transparent)",
              }}
            >
              <span
                aria-hidden
                className="landing-corner-ring"
                style={{ top: "-2rem", right: "-2rem", width: "8rem", height: "8rem" }}
              />
              <div className="relative flex items-center gap-3">
                <span
                  aria-hidden
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border"
                  style={{ borderColor: TONE.cool.border, background: TONE.cool.bg, color: TONE.cool.color }}
                >
                  <Sparkles className="h-5 w-5" strokeWidth={1.85} />
                </span>
                <div>
                  <p
                    className="ui-caps-2 text-[10.5px] font-bold uppercase tracking-[0.18em]"
                    style={{ color: TONE.amber.color }}
                  >
                    Limited launch offer
                  </p>
                  <h2 className="text-[1.25rem] font-semibold tracking-tight text-[var(--text-primary)] sm:text-[1.4rem]">
                    Founding Customer
                  </h2>
                </div>
              </div>

              <p className="relative mt-4 inline-flex items-center gap-1.5 rounded-full border border-[color:color-mix(in_oklab,var(--accent)_34%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_46%,var(--surface-raised))] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--accent-strong)]">
                <Sparkles className="h-3 w-3" strokeWidth={1.85} aria-hidden />
                First 25 customers
              </p>

              {/* Price chip pair: $2,400 + SAVE $588 + FIRST YEAR caps. */}
              {/* Price + chip + caps stacked on their own rows so the chip
                  doesn't float at the price baseline. Matches Pilot card. */}
              <p
                className="relative mt-5 text-[2.75rem] font-bold leading-none tracking-tight text-[var(--text-primary)]"
                style={{ fontVariantNumeric: "tabular-nums lining-nums slashed-zero", letterSpacing: "-0.02em" }}
              >
                $2,400
              </p>
              <p
                className="relative mt-3 inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.16em]"
                style={{
                  borderColor: TONE.success.border,
                  background: TONE.success.bg,
                  color: TONE.success.color,
                }}
              >
                Save $588
              </p>
              <p className="relative mt-2 text-[10.5px] font-bold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
                First year
              </p>

              <ul className="relative mt-5 space-y-2">
                <li className="flex items-start gap-2 text-[13.5px] text-[var(--text-secondary)]">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-strong)]" strokeWidth={1.85} aria-hidden />
                  One setup call
                </li>
                <li className="flex items-start gap-2 text-[13.5px] text-[var(--text-secondary)]">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-strong)]" strokeWidth={1.85} aria-hidden />
                  Help mapping your spreadsheet into Oblixa
                </li>
                <li className="flex items-start gap-2 text-[13.5px] text-[var(--text-secondary)]">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-strong)]" strokeWidth={1.85} aria-hidden />
                  Cancel or export anytime
                </li>
              </ul>

              {/* Auto-renew footnote chip — promoted from a bullet into a
                  discrete low-contrast pill so it reads as a footnote, not a feature. */}
              <p className="relative mt-4 inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                <span aria-hidden className="h-1 w-1 rounded-full bg-[var(--text-tertiary)]" />
                Auto-renews <span className="tabular-nums">·</span> $2,988/yr
              </p>

              <div className="relative mt-6">
                <Link
                  href="/contact?interested=founding_customer"
                  prefetch={false}
                  className="ui-btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold"
                >
                  Claim founding spot
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                </Link>
              </div>
            </section>

            {/* Guided Pilot — warm-toned card. */}
            <section
              id="guided-pilot"
              className="landing-card-premium relative scroll-mt-32 overflow-hidden rounded-2xl border p-7 sm:p-8"
              style={{
                borderColor: "color-mix(in oklab, var(--accent-warm, var(--accent)) 24%, var(--border-subtle))",
              }}
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border"
                  style={{ borderColor: TONE.warm.border, background: TONE.warm.bg, color: TONE.warm.color }}
                >
                  <HandHeart className="h-5 w-5" strokeWidth={1.85} />
                </span>
                <div>
                  <h2 className="text-[1.25rem] font-semibold tracking-tight text-[var(--text-primary)] sm:text-[1.4rem]">
                    Guided Pilot
                  </h2>
                </div>
              </div>

              {/* Price + chip + caps stacked on their own rows so the wide
                  "Credited to Core" chip doesn't float at the price baseline. */}
              <p
                className="mt-5 text-[2.75rem] font-bold leading-none tracking-tight text-[var(--text-primary)]"
                style={{ fontVariantNumeric: "tabular-nums lining-nums slashed-zero", letterSpacing: "-0.02em" }}
              >
                $1,500
              </p>
              <p
                className="mt-3 inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.16em]"
                style={{
                  borderColor: TONE.warm.border,
                  background: TONE.warm.bg,
                  color: TONE.warm.color,
                }}
              >
                Credited to Core
              </p>
              <p className="mt-2 text-[10.5px] font-bold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
                60-day pilot
              </p>

              <ul className="mt-5 space-y-2">
                <li className="flex items-start gap-2 text-[13.5px] text-[var(--text-secondary)]">
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0"
                    strokeWidth={1.85}
                    style={{ color: TONE.warm.color }}
                    aria-hidden
                  />
                  Three setup sessions over the 60 days
                </li>
                <li className="flex items-start gap-2 text-[13.5px] text-[var(--text-secondary)]">
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0"
                    strokeWidth={1.85}
                    style={{ color: TONE.warm.color }}
                    aria-hidden
                  />
                  Kickoff call to map your contract set
                </li>
                <li className="flex items-start gap-2 text-[13.5px] text-[var(--text-secondary)]">
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0"
                    strokeWidth={1.85}
                    style={{ color: TONE.warm.color }}
                    aria-hidden
                  />
                  Pick the first 50 contracts together
                </li>
                <li className="flex items-start gap-2 text-[13.5px] text-[var(--text-secondary)]">
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0"
                    strokeWidth={1.85}
                    style={{ color: TONE.warm.color }}
                    aria-hidden
                  />
                  Owner and key-date definition
                </li>
                <li className="flex items-start gap-2 text-[13.5px] text-[var(--text-secondary)]">
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0"
                    strokeWidth={1.85}
                    style={{ color: TONE.warm.color }}
                    aria-hidden
                  />
                  First-reports review
                </li>
              </ul>

              <div className="mt-6">
                <Link
                  href="/contact?interested=guided_pilot"
                  prefetch={false}
                  className="ui-btn-secondary inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold"
                >
                  Book guided pilot
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                </Link>
              </div>
            </section>

            {/* Custom plans — third peer card, lighter chrome to read as
                "alternative option" not "third tier." */}
            <section
              id="custom-plans"
              className="relative scroll-mt-32 overflow-hidden rounded-2xl border border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-raised)_92%,transparent)] p-7 sm:p-8"
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-secondary)]"
                >
                  <Users className="h-5 w-5" strokeWidth={1.85} />
                </span>
                <div>
                  <h2 className="text-[1.25rem] font-semibold tracking-tight text-[var(--text-primary)] sm:text-[1.4rem]">
                    Custom plans
                  </h2>
                </div>
              </div>

              <p className="mt-5 text-[14px] leading-[1.55] text-[var(--text-secondary)]">
                Need portfolio operations, controls, or assurance workflows?
              </p>

              <ul className="mt-4 flex flex-col gap-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                <li>
                  <span className="tabular-nums text-[var(--accent-strong)]">500+</span> contracts
                </li>
                <li>
                  <span className="tabular-nums text-[var(--accent-strong)]">10+</span> team members
                </li>
                <li>
                  <span className="text-[var(--accent-strong)]">Custom</span> integrations or SSO
                </li>
              </ul>

              <div className="mt-6">
                <Link
                  href="/contact?interested=custom"
                  prefetch={false}
                  className="ui-btn-secondary inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold"
                >
                  Contact us
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                </Link>
              </div>
            </section>
          </div>

          {/* FAQ — tone-coded category labels + 2-col at lg+. The PRICING FAQ
              eyebrow was dropped (the h2 + category labels carry the section
              identity well enough). */}
          <section
            id="pricing-faq"
            aria-labelledby="pricing-faq-heading"
            className="mt-14 scroll-mt-32 sm:mt-16"
          >
            <header className="mx-auto max-w-2xl text-center">
              <h2
                id="pricing-faq-heading"
                className="text-[1.75rem] font-semibold tracking-tight text-[var(--text-primary)] sm:text-[2rem]"
              >
                Pricing questions
              </h2>
              <p className="mt-3 text-[14px] leading-[1.6] text-[var(--text-secondary)]">
                Everything you might want to know before you start the trial.
              </p>
            </header>
            <div className="mx-auto mt-8 max-w-5xl">
              {FAQ_GROUPS.map((group, gIdx) => {
                const tone = TONE[group.tone];
                return (
                  <div key={group.id} className={gIdx > 0 ? "mt-8" : ""}>
                    <p
                      className="text-[12px] font-bold uppercase tracking-[0.18em]"
                      style={{ color: tone.color }}
                    >
                      {group.label}
                    </p>
                    <div className="mt-3 grid gap-1.5 lg:grid-cols-2 lg:gap-2">
                      {group.items.map((item) => (
                        <details
                          key={item.id}
                          id={item.id}
                          className="group rounded-xl border border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] bg-[var(--surface-raised)] px-4 py-3 transition-colors hover:border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-strong))]"
                        >
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                            <h3 className="text-[14px] font-semibold leading-tight text-[var(--text-primary)]">
                              {item.question}
                            </h3>
                            <ArrowRight
                              className="h-3.5 w-3.5 shrink-0 rotate-90 text-[var(--text-tertiary)] transition-transform duration-[var(--ui-duration)] group-open:rotate-180"
                              strokeWidth={1.85}
                              aria-hidden
                            />
                          </summary>
                          <div className="mt-2 text-[13.5px] leading-[1.6] text-[var(--text-secondary)]">
                            {item.answer}
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Closing CTA — bigger h2 + gradient phrase + extra tertiary link +
              integrated disclaimer strip. */}
          <section className="relative mt-12 overflow-hidden rounded-3xl border landing-card-premium p-8 text-center sm:mt-16 sm:p-12">
            <span
              aria-hidden
              className="landing-corner-ring"
              style={{ top: "-2rem", right: "-2rem", width: "8rem", height: "8rem" }}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse 70% 50% at 50% 50%, color-mix(in oklab, var(--success-ink) 14%, transparent), transparent 70%)",
              }}
            />
            <div className="relative">
              <p className="ui-caps-1 inline-flex items-center gap-1.5 text-[11px] text-[var(--success-ink)]">
                <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--success-ink)]" />
                Ready to start
              </p>
              <h2
                className="mt-3 text-balance text-[2.25rem] font-bold leading-[1.05] tracking-tight text-[var(--text-primary)] sm:text-[2.75rem] md:text-[3.25rem]"
                style={{ letterSpacing: "-0.02em" }}
              >
                Start the <GradientPhrase>21-day trial</GradientPhrase>.
              </h2>
              <p className="mx-auto mt-3 max-w-md text-[14px] text-[var(--text-secondary)] sm:text-[15px]">
                No credit card required.
              </p>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/signup"
                  className="product-cta-halo ui-btn-primary inline-flex min-h-11 items-center gap-1.5 px-5 py-2.5 text-[14px] font-semibold"
                >
                  Start free trial
                  <ArrowRight className="h-4 w-4" strokeWidth={1.85} aria-hidden />
                </Link>
                <Link
                  href="/contact?interested=core"
                  prefetch={false}
                  className="ui-btn-ghost inline-flex min-h-11 items-center gap-1.5 px-4 py-2.5 text-[14px] font-semibold"
                >
                  Book setup call
                </Link>
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[12px] text-[var(--text-tertiary)]">
                <Link
                  href="/contact?interested=founding_customer"
                  prefetch={false}
                  className="ui-link inline-flex items-center gap-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  Talk to the founder
                  <ArrowUpRight className="h-3 w-3" strokeWidth={1.85} aria-hidden />
                </Link>
                <Link
                  href="#pricing-faq-heading"
                  className="ui-link inline-flex items-center gap-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  Read the FAQ
                  <ArrowUpRight className="h-3 w-3" strokeWidth={1.85} aria-hidden />
                </Link>
              </div>

              {/* Disclaimer strip — integrated into closing CTA (was orphaned
                  at the page bottom). */}
              <div className="mt-6 flex justify-center">
                <div className="inline-flex divide-x divide-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)] rounded-md border border-[color:color-mix(in_oklab,var(--border-subtle)_45%,transparent)] text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                  <span className="px-3 py-1.5">USD</span>
                  <span className="px-3 py-1.5">Excludes taxes</span>
                  <span className="px-3 py-1.5">Subject to change</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
