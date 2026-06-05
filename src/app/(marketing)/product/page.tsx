import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Database,
  FileSpreadsheet,
  FileText,
  ListChecks,
  ShieldCheck,
  TrendingUp,
  UploadCloud,
  UserCheck,
} from "lucide-react";
import { LegalPageJsonLd } from "@/components/landing/legal-page-json-ld";
import { JsonLdScript } from "@/components/landing/landing-json-ld";
import { ProductAnchorNav } from "@/components/landing/product-anchor-nav";
import { ProductMobileCta } from "@/components/landing/product-mobile-cta";
import { ActionChip } from "@/components/ui/action-chip";
import { KeyValueChip } from "@/components/ui/key-value-chip";
import { GradientPhrase } from "@/components/ui/gradient-phrase";
import {
  PHASES,
  PHASE_DESCRIPTIONS,
  PRODUCT_SECTIONS,
  TONE_TOKENS,
  type Phase,
  type ProductSection,
  type SectionIconName,
  type SectionTone,
} from "@/components/landing/product-sections-data";
import {
  DashboardOverviewPreview,
  EvidenceRequestPreview,
  ReportsExportPreview,
  ReviewFieldsPreview,
  UpcomingDatesPreview,
  WorkQueuePreview,
} from "@/components/landing/product-mocks";
import { getAppBaseUrlFromEnv } from "@/lib/app-url";

const title = "Product — Oblixa";
const description =
  "Oblixa replaces the contract tracking spreadsheet. Reviewed terms, key dates, owners, obligations, evidence, and reports — connected in one workspace.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/product" },
  openGraph: { title, description, url: "/product", type: "article" },
  twitter: { card: "summary_large_image", title, description },
};

const ICONS: Record<SectionIconName, typeof FileSpreadsheet> = {
  FileSpreadsheet,
  Database,
  FileText,
  CalendarClock,
  ListChecks,
  ShieldCheck,
  BarChart3,
};

const PHASE_TONE_TOKEN: Record<Phase["id"], string> = {
  setup: "var(--accent-strong)",
  "day-to-day": "var(--accent-warm, var(--accent))",
  output: "var(--success-ink)",
};

function toneStyle(tone: SectionTone) {
  return { ["--section-tone" as string]: TONE_TOKENS[tone] };
}

function phaseToneStyle(p: Phase["id"]) {
  return { ["--phase-tone" as string]: PHASE_TONE_TOKEN[p] };
}

function ProductHowToJsonLd() {
  const base = getAppBaseUrlFromEnv();
  const howTo = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to replace your contract tracking spreadsheet with Oblixa",
    description:
      "Move from a static contract spreadsheet to a workspace that tracks renewals, owners, obligations, evidence, and reports.",
    totalTime: "PT30M",
    step: [
      { "@type": "HowToStep", position: 1, name: "Upload signed contracts or import a spreadsheet", url: `${base}/product#upload` },
      { "@type": "HowToStep", position: 2, name: "Review key dates, terms, and obligations with source evidence", url: `${base}/product#review` },
      { "@type": "HowToStep", position: 3, name: "Assign owners, reminders, approvals, and work", url: `${base}/product#work` },
      { "@type": "HowToStep", position: 4, name: "Track renewals, evidence, exceptions, and reports", url: `${base}/product#reports` },
    ],
  };
  return <JsonLdScript payload={[howTo]} />;
}

/* ─── Hero ─────────────────────────────────────────────────────────────
   Tour-framed identity (the product positioning lives on the landing page).
   Shares the marketing chrome recipe with /pricing + /security: eyebrow-dot,
   GradientPhrase keyword, primary + ghost CTA cluster, product-top-hairline.
   ──────────────────────────────────────────────────────────────────── */
function Hero() {
  return (
    <header className="relative text-center">
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-56 w-[560px] -translate-x-1/2 -translate-y-12 rounded-full opacity-50 blur-3xl"
        style={{ background: "radial-gradient(ellipse 60% 60% at 50% 30%, color-mix(in oklab, var(--accent-strong) 10%, transparent), transparent 70%)" }}
      />
      <p className="product-hero-rise ui-caps-1 inline-flex items-center gap-1.5 text-[11px] text-[var(--accent-strong)]">
        <span className="landing-eyebrow-dot" aria-hidden />
        Product tour
      </p>
      <h1
        className="product-hero-h1 product-hero-rise mx-auto mt-3 max-w-[18ch] text-balance text-[2.25rem] font-bold leading-[1.05] tracking-tight text-[var(--text-primary)] sm:text-[3.25rem]"
        style={{ hangingPunctuation: "first allow-end last", letterSpacing: "-0.02em" }}
      >
        Here&rsquo;s how it{" "}
        <GradientPhrase>fits together.</GradientPhrase>
      </h1>
      <p className="product-hero-rise-2 mx-auto mt-4 max-w-[36rem] text-balance text-[15px] leading-[1.6] text-[var(--text-secondary)] sm:text-[16px]">
        Upload signed contracts, review the suggested fields, assign owners and dates, then track work, evidence, and reports.
      </p>
      {/* Hero CTA — product tour stays informational; conversion is access request. */}
      <div className="product-hero-rise-3 mt-7 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/request-access"
          className="product-cta-halo ui-btn-primary inline-flex min-h-10 items-center gap-1.5 px-4 py-2 text-[13px] font-semibold"
        >
          Request access
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
        </Link>
        <Link
          href="/pricing"
          className="ui-btn-ghost inline-flex min-h-10 items-center gap-1.5 px-3.5 py-2 text-[13px] font-semibold"
        >
          See pricing
        </Link>
      </div>

      {/* Dashboard preview — the shared product-mock frame (MockShell), so the
          hero's lead preview shares chrome, shadow, and caption vocabulary with
          the inter-section mocks instead of being a bespoke one-off. */}
      <div className="mx-auto mt-8 max-w-3xl text-left">
        <DashboardOverviewPreview />
      </div>
    </header>
  );
}

/* ─── Before / After ──────────────────────────────────────────────── */
function BeforeAfter() {
  return (
    <section
      aria-label="What teams replace"
      className="relative mt-10 grid gap-3 sm:grid-cols-[1fr_auto_1fr]"
    >
      <div className="product-before-card rounded-2xl border border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] bg-[var(--surface-raised)] p-4">
        <p className="ui-caps-2 text-[10.5px] text-[var(--text-tertiary)]">Before</p>
        <p className="mt-1 text-[15px] font-semibold text-[var(--text-primary)]">
          Contract tracking spreadsheet
        </p>
        <div className="mt-3 overflow-hidden rounded-md border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface)_88%,var(--surface-raised))]">
          <div className="grid grid-cols-[1fr_auto] gap-x-2 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            <span>Contract</span>
            <span>Owner</span>
          </div>
          {[
            { name: "Acme — MSA", owner: "—" },
            { name: "Initech — DPA", owner: "—" },
            { name: "Hooli — Lease", owner: "—" },
          ].map((row, i) => (
            <div
              key={row.name}
              className={`grid grid-cols-[1fr_auto] gap-x-2 border-t border-[var(--border-subtle)] px-2 py-1 text-[10.5px] ${i % 2 === 1 ? "bg-[color:color-mix(in_oklab,var(--surface-raised)_50%,transparent)]" : ""}`}
            >
              <span className="truncate text-[var(--text-secondary)]">{row.name}</span>
              <span className="font-mono text-[var(--text-tertiary)]">{row.owner}</span>
            </div>
          ))}
        </div>
        <ul className="mt-3 space-y-1.5 text-[13px] leading-[1.55] text-[var(--text-secondary)]">
          <li className="flex items-start gap-2">
            <CircleDot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" aria-hidden />
            Owners filled in once, never updated
          </li>
          <li className="flex items-start gap-2">
            <CircleDot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" aria-hidden />
            Renewal dates scattered across tabs
          </li>
          <li className="flex items-start gap-2">
            <CircleDot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" aria-hidden />
            No source of truth for clause text
          </li>
        </ul>
      </div>
      <div className="hidden items-center justify-center sm:flex">
        <ChevronRight className="h-5 w-5 text-[var(--text-tertiary)]" strokeWidth={1.85} aria-hidden />
      </div>
      <div
        className="product-after-card relative overflow-hidden rounded-2xl border p-4"
        style={{
          borderColor: "color-mix(in oklab, var(--accent) 28%, var(--border-subtle))",
          background:
            "radial-gradient(ellipse 70% 80% at 0% 0%, color-mix(in oklab, var(--accent) 10%, transparent), transparent 60%), color-mix(in oklab, var(--accent-soft) 6%, var(--surface-raised))",
        }}
      >
        <p className="ui-caps-2 text-[10.5px] text-[var(--accent-strong)]">After</p>
        <p className="mt-1 text-[15px] font-semibold text-[var(--text-primary)]">
          Oblixa contract tracking workspace
        </p>
        <div className="mt-3 overflow-hidden rounded-md border border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] bg-[var(--surface-raised)]">
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 bg-[color:color-mix(in_oklab,var(--accent-soft)_24%,var(--surface-raised))] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--accent-strong)]">
            <span>Contract</span>
            <span>Owner</span>
            <span>Renewal</span>
          </div>
          {[
            { name: "Acme — MSA", owner: "SO", date: "Apr 12" },
            { name: "Initech — DPA", owner: "MD", date: "May 20" },
            { name: "Hooli — Lease", owner: "TK", date: "Jun 02" },
          ].map((row) => (
            <div
              key={row.name}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-x-2 border-t border-[var(--border-subtle)] px-2 py-1 text-[10.5px]"
            >
              <span className="truncate text-[var(--text-primary)]">{row.name}</span>
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-contrast)_82%,var(--surface-raised))] font-mono text-[9.5px] font-bold text-[var(--text-secondary)]">
                {row.owner}
              </span>
              <span className="font-mono tabular-nums text-[var(--text-tertiary)]">{row.date}</span>
            </div>
          ))}
        </div>
        <ul className="mt-3 space-y-1.5 text-[13px] leading-[1.55] text-[var(--text-secondary)]">
          <li className="flex items-start gap-2">
            <UserCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent-strong)]" strokeWidth={2} aria-hidden />
            Named owners on every record, kept current
          </li>
          <li className="flex items-start gap-2">
            <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent-strong)]" strokeWidth={2} aria-hidden />
            Renewals and notice dates in a single timeline
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent-strong)]" strokeWidth={2} aria-hidden />
            Source snippets attached to every approved field
          </li>
        </ul>
      </div>
    </section>
  );
}

/* ─── Time to Value ───────────────────────────────────────────────── */
function TimeToValue() {
  const steps = [
    { label: "Day 1", body: "Upload your first contracts.", example: "5–10 vendor agreements", Icon: UploadCloud },
    { label: "Week 1", body: "Review key fields, assign owners.", example: "25 fields reviewed", Icon: UserCheck },
    { label: "Month 1", body: "Track renewals, produce reports.", example: "First renewal report exported", Icon: CalendarClock },
    { label: "Quarter 1", body: "Renewal pipeline visible.", example: "Notice windows on the calendar", Icon: TrendingUp },
  ];
  return (
    <section
      aria-label="Time to value"
      className="mt-10 rounded-2xl border border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] bg-[var(--surface-raised)] p-5 sm:p-6"
    >
      <p className="ui-caps-2 inline-flex items-center gap-1.5 text-[10.5px] text-[var(--accent-strong)]">
        <span className="landing-eyebrow-dot" aria-hidden />
        Time to value
      </p>
      <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s) => {
          const Icon = s.Icon;
          return (
            <li key={s.label} className="relative">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 min-w-[2.5rem] items-center justify-center gap-1 rounded-md border border-[color:color-mix(in_oklab,var(--accent)_30%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_42%,var(--surface-raised))] px-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.12em] tabular-nums text-[var(--accent-strong)]">
                  <Icon className="h-3 w-3" strokeWidth={2} aria-hidden />
                  {s.label}
                </span>
              </div>
              <p className="mt-2 text-[13.5px] leading-[1.55] text-[var(--text-secondary)]">
                {s.body}
              </p>
              <p className="mt-0.5 text-[12px] text-[var(--text-tertiary)]">
                e.g. {s.example}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* ─── Section card ─────────────────────────────────────────────────────
   Per §10.18: per-section tone is a restrained cue on the eyebrow + medallion
   only — the card surface (shared landing-card-premium recipe), rail, bullets,
   and metric chip stay neutral. The eyebrow inlines the section number as a
   weight-graduated caps prefix (no middle-dot). The "Next" wayfinding affordance
   sits inside the content column under the bullets, not in a detached footer band.
   ──────────────────────────────────────────────────────────────────── */
function SectionCard({
  section,
  nextSection,
  belowFold,
}: {
  section: ProductSection;
  nextSection?: ProductSection;
  belowFold?: boolean;
}) {
  const Icon = ICONS[section.iconName];
  const headingId = `${section.id}-h`;
  const number = section.number;
  return (
    <section
      id={section.id}
      aria-labelledby={headingId}
      tabIndex={-1}
      className={
        "product-section-card product-target-flash landing-card-premium group relative overflow-hidden rounded-2xl border " +
        (belowFold ? "product-cv-auto" : "")
      }
      style={{
        ...toneStyle(section.tone),
        scrollMarginTop: "124px",
      }}
    >
      <div className="grid gap-4 p-5 sm:gap-5 sm:p-6 lg:grid-cols-[auto_minmax(0,1fr)]">
        {/* Single visual identity: the tone-tinted medallion. The section number
            lives inline in the eyebrow as a weight-graduated caps prefix. */}
        <span
          aria-hidden
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-[var(--shadow-1)] sm:h-12 sm:w-12"
          style={{
            border: "1px solid color-mix(in oklab, var(--section-tone) 30%, var(--border-subtle))",
            background: "color-mix(in oklab, var(--section-tone) 16%, var(--surface-raised))",
            color: "var(--section-tone)",
          }}
        >
          <Icon className="h-5 w-5 sm:h-[1.375rem] sm:w-[1.375rem]" strokeWidth={1.85} />
        </span>
        <div className="min-w-0">
          {/* Eyebrow — number (heavier) + label (lighter), weight gradation, no dot. */}
          <p
            className="inline-flex items-baseline gap-1.5 text-[11px] leading-none"
            style={{ color: "var(--section-tone)" }}
          >
            <span
              className="ui-caps-1 tabular-nums"
              style={{ fontVariantNumeric: "tabular-nums lining-nums slashed-zero" }}
            >
              {number}
            </span>
            <span className="ui-caps-2">{section.eyebrow}</span>
          </p>
          <h3
            id={headingId}
            className="mt-2 text-[1.25rem] font-semibold leading-[1.25] tracking-tight text-[var(--text-primary)] sm:text-[1.5rem]"
          >
            {section.title}
          </h3>
          <p className="mt-2.5 max-w-2xl text-[14px] leading-[1.6] text-[var(--text-secondary)]">
            {section.message}
          </p>
          {section.metric ? (
            <div className="mt-3">
              <KeyValueChip label={section.metric.label} value={section.metric.value} />
            </div>
          ) : null}
          <ul className="mt-4 grid gap-x-4 gap-y-2 sm:grid-cols-2">
            {section.bullets.map((b) => (
              <li
                key={b}
                className="flex items-start gap-2 text-[13.5px] leading-[1.5] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] motion-reduce:transition-none"
              >
                {section.bulletVariant === "check" ? (
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-tertiary)]"
                    strokeWidth={2}
                    aria-hidden
                  />
                ) : (
                  <span
                    aria-hidden
                    className="mt-[0.4rem] inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--border-strong)]"
                  />
                )}
                {b}
              </li>
            ))}
          </ul>
          {/* Next-step wayfinding — kept inside the content column, under the
              bullets, so it reads as tour progression rather than a detached CTA. */}
          <div className="mt-5 flex items-center justify-end gap-2">
            {nextSection ? (
              <>
                <span className="ui-caps-2 text-[10px] leading-none text-[var(--text-tertiary)]">
                  Next
                </span>
                <ActionChip verb={nextSection.eyebrow} href={`#${nextSection.id}`} />
              </>
            ) : (
              <a
                href="#top"
                className="ui-caps-2 inline-flex items-center gap-1.5 text-[10.5px] text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-secondary)] motion-reduce:transition-none"
              >
                <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                Back to top
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Phase header ──────────────────────────────────────────────────────
   Clean separator + small phase caps eyebrow + h2 + one-line description.
   No band, no animated underline, no redundant "Sections X–Y" suffix.
   ──────────────────────────────────────────────────────────────────── */
function PhaseHeader({ phase }: { phase: Phase }) {
  return (
    <div className="relative pt-6 sm:pt-8" style={phaseToneStyle(phase.id)}>
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)]"
      />
      <p className="ui-caps-2 text-[10.5px]" style={{ color: "var(--phase-tone)" }}>
        Phase {phase.number}
      </p>
      <h2 className="mt-1.5 text-[1.4rem] font-semibold tracking-tight text-[var(--text-primary)] sm:text-[1.6rem]">
        {phase.label}
      </h2>
      <p className="mt-2 max-w-2xl text-[14px] leading-[1.55] text-[var(--text-secondary)]">
        {PHASE_DESCRIPTIONS[phase.id]}
      </p>
    </div>
  );
}

/* ─── Closing CTA ────────────────────────────────────────────────────── */
function ClosingCta() {
  return (
    <section className="relative mt-12 overflow-hidden rounded-2xl border landing-card-premium p-8 text-center sm:p-10">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 50%, color-mix(in oklab, var(--success-ink) 12%, transparent), transparent 70%)",
        }}
      />
      <div className="relative">
        <p className="ui-caps-1 inline-flex items-center gap-1.5 text-[11px] text-[var(--success-ink)]">
          <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--success-ink)]" />
          Start now
        </p>
        <h2 className="mt-3 text-balance text-[1.75rem] font-semibold tracking-tight text-[var(--text-primary)] sm:text-[2.125rem]">
          Start tracking your signed-contract follow-up this quarter.
        </h2>
        {/* Proof bar — CSS-divided cells (no text middle-dots). */}
        <div className="mx-auto mt-4 inline-flex divide-x divide-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] rounded-md border border-[color:color-mix(in_oklab,var(--border-subtle)_50%,transparent)] text-[11.5px] font-semibold text-[var(--text-tertiary)]">
          <span className="px-3 py-1.5">Small evaluation set</span>
          <span className="px-3 py-1.5">Source-backed review</span>
          <span className="px-3 py-1.5">CSV export</span>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/request-access"
            className="product-cta-halo ui-btn-primary inline-flex min-h-10 items-center gap-1.5 px-4 py-2 text-[13px] font-semibold"
          >
            Request access
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
          </Link>
        </div>
        {/* Tertiary actions — quiet ghost chips (no underlined prose links). */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/contact"
            prefetch={false}
            className="ui-btn-ghost inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold"
          >
            Contact Oblixa
            <ArrowUpRight className="h-3 w-3" strokeWidth={1.85} aria-hidden />
          </Link>
          <Link
            href="/pricing"
            prefetch={false}
            className="ui-btn-ghost inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold"
          >
            Pricing
            <ArrowUpRight className="h-3 w-3" strokeWidth={1.85} aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────────
   Calmer-cousin pass: max-w-6xl (parity with /pricing + /security), tighter
   vertical rhythm, a single softened luminous glow, and the two large
   decorative blur blobs removed (they fed the all-blue wash for negligible
   return — §11.30). Section identity comes from phase headers + per-card
   eyebrow/medallion tone, not a page-wide color field.
   ──────────────────────────────────────────────────────────────────── */
export default function ProductPage() {
  const setupSections = PRODUCT_SECTIONS.filter((s) => s.phaseId === "setup");

  const sectionAt = (id: string): ProductSection | undefined =>
    PRODUCT_SECTIONS.find((s) => s.id === id);

  function renderSection(s: ProductSection, opts?: { belowFold?: boolean }) {
    const idx = PRODUCT_SECTIONS.findIndex((x) => x.id === s.id);
    const next = idx >= 0 && idx + 1 < PRODUCT_SECTIONS.length ? PRODUCT_SECTIONS[idx + 1] : undefined;
    return (
      <SectionCard
        key={s.id}
        section={s}
        nextSection={next}
        belowFold={opts?.belowFold}
      />
    );
  }

  return (
    <>
      <LegalPageJsonLd path="/product" title={title} description={description} />
      <ProductHowToJsonLd />
      <main
        id="main-content"
        tabIndex={-1}
        className="landing-luminous relative isolate flex min-h-full flex-1 flex-col overflow-hidden outline-none"
      >
        <span id="top" aria-hidden className="absolute top-0" />
        <div aria-hidden className="landing-luminous__base" />
        <div aria-hidden className="landing-luminous__glow opacity-60" />
        <div aria-hidden className="landing-luminous__grid opacity-50" />
        <div aria-hidden className="product-top-hairline" />

        <div className="relative mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
          <Hero />
          <BeforeAfter />
          <TimeToValue />
          <ProductAnchorNav />

          {/* Sections grouped by phase. Phase 1 (entry) renders full-width;
              phases 2–3 pair each section with a preview mock at lg+ to break
              the centered-column rhythm and keep mocks from dominating width. */}
          <div className="relative mt-8 space-y-6 sm:space-y-8">
            <PhaseHeader phase={PHASES[0]} />
            {setupSections.map((s) => renderSection(s))}

            <PhaseHeader phase={PHASES[1]} />
            <div className="grid items-start gap-4 lg:grid-cols-[3fr_2fr] lg:gap-6">
              {sectionAt("review") ? renderSection(sectionAt("review")!, { belowFold: true }) : null}
              <ReviewFieldsPreview />
            </div>
            <div className="grid items-start gap-4 lg:grid-cols-[3fr_2fr] lg:gap-6">
              {sectionAt("dates") ? renderSection(sectionAt("dates")!, { belowFold: true }) : null}
              <UpcomingDatesPreview />
            </div>
            <div className="grid items-start gap-4 lg:grid-cols-[3fr_2fr] lg:gap-6">
              {sectionAt("work") ? renderSection(sectionAt("work")!, { belowFold: true }) : null}
              <WorkQueuePreview />
            </div>

            <PhaseHeader phase={PHASES[2]} />
            <div className="grid items-start gap-4 lg:grid-cols-[3fr_2fr] lg:gap-6">
              {sectionAt("evidence") ? renderSection(sectionAt("evidence")!, { belowFold: true }) : null}
              <EvidenceRequestPreview />
            </div>
            <div className="grid items-start gap-4 lg:grid-cols-[3fr_2fr] lg:gap-6">
              {sectionAt("reports") ? renderSection(sectionAt("reports")!, { belowFold: true }) : null}
              <ReportsExportPreview />
            </div>
          </div>

          <ClosingCta />
        </div>
        <ProductMobileCta />
      </main>
    </>
  );
}
