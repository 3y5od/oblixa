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
  PlayCircle,
  ShieldCheck,
  TrendingUp,
  UploadCloud,
  UserCheck,
} from "lucide-react";
import { LegalPageJsonLd } from "@/components/landing/legal-page-json-ld";
import { JsonLdScript } from "@/components/landing/landing-json-ld";
import { ProductAnchorNav } from "@/components/landing/product-anchor-nav";
import { ProductMobileCta } from "@/components/landing/product-mobile-cta";
import {
  OUTCOMES,
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
   v7 subtraction: dropped lead-in tag (T27.14), dropped 4-cell micro-stats
   row (T27.16), dropped triple-chevron stack (T27.17), tightened gaps
   (T27.15), font-weight 660 → 700 (T27.18), scroll cue sentence case (T27.2).
   ──────────────────────────────────────────────────────────────────── */
function Hero() {
  return (
    <header className="relative text-center">
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-64 w-[640px] -translate-x-1/2 -translate-y-12 rounded-full opacity-60 blur-3xl"
        style={{ background: "radial-gradient(ellipse 60% 60% at 50% 30%, color-mix(in oklab, var(--accent-strong) 12%, transparent), transparent 70%)" }}
      />
      <p className="product-hero-rise ui-caps-1 inline-flex items-center gap-1.5 text-[11px] text-[var(--accent-strong)]">
        <span className="landing-eyebrow-dot" aria-hidden />
        Product tour
      </p>
      {/* Tour-framed h1 — the product positioning lives on the landing page;
          this h1 sets the page's job, not the product's. */}
      <h1
        className="product-hero-h1 product-hero-rise mx-auto mt-3 max-w-[18ch] text-balance text-[2.25rem] font-bold leading-[1.05] tracking-tight text-[var(--text-primary)] sm:text-[3.25rem]"
        style={{ hangingPunctuation: "first allow-end last", letterSpacing: "-0.02em" }}
      >
        Here&rsquo;s how it{" "}
        <span className="product-hero-h1-grad">fits together.</span>
      </h1>
      <p className="product-hero-rise-2 mx-auto mt-4 max-w-[36rem] text-balance text-[15px] leading-[1.6] text-[var(--text-secondary)] sm:text-[16px]">
        Seven sections cover the whole journey. Jump to one with the nav below, or read straight through.
      </p>
      {/* Hero CTA — registration component ("Start free trial") and trial
          disclaimer dropped. /product is an informational tour; conversion
          lives on /pricing. Hero pivots to the next-step actions: see pricing,
          or book a setup call for a guided walkthrough. */}
      <div className="product-hero-rise-3 mt-7 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/pricing"
          className="product-cta-halo ui-btn-primary inline-flex min-h-10 items-center gap-1.5 px-4 py-2 text-[13px] font-semibold"
        >
          View pricing
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
        </Link>
        <Link
          href="/contact?interested=core"
          prefetch={false}
          className="ui-btn-ghost inline-flex min-h-10 items-center gap-1.5 px-3.5 py-2 text-[13px] font-semibold"
        >
          Book setup call
        </Link>
      </div>

      {/* Video placeholder card */}
      <Link
        href="/contact?interested=core"
        prefetch={false}
        aria-label="Watch a 90-second tour (opens contact form to request demo)"
        className="group relative mx-auto mt-10 block max-w-2xl overflow-hidden rounded-3xl border border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-raised)_94%,transparent)] shadow-[var(--shadow-1)] transition-shadow hover:shadow-[0_24px_60px_-20px_color-mix(in_oklab,var(--accent-strong)_22%,transparent)] motion-reduce:transition-none"
      >
        {/* v7 T28.2: browser chrome 3 dots removed; only the URL + duration badge stay. */}
        <div className="product-browser-chrome">
          <span className="truncate font-mono text-[10px] text-[var(--text-tertiary)]">
            oblixa.com/dashboard
          </span>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[color:color-mix(in_oklab,var(--accent-soft)_42%,var(--surface-raised))] px-2 py-0.5 font-mono text-[9.5px] font-bold tracking-[0.12em] text-[var(--accent-strong)]">
            90 SEC
          </span>
        </div>
        <div className="relative aspect-[16/9]">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 50% 50%, color-mix(in oklab, var(--accent) 16%, transparent), transparent 70%)",
            }}
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <span className="product-video-play-halo relative inline-flex items-center justify-center">
              <PlayCircle
                className="relative z-10 h-16 w-16 text-[var(--accent-strong)] transition-transform group-hover:scale-110 motion-reduce:transition-none"
                strokeWidth={1.5}
                aria-hidden
              />
            </span>
            <span className="mt-2 text-[14px] font-semibold text-[var(--text-primary)]">
              Watch a 90-second tour
            </span>
            <span className="text-[11px] text-[var(--text-tertiary)]">
              Request a walkthrough →
            </span>
          </div>
        </div>
      </Link>
    </header>
  );
}

/* ─── Outcomes strip ──────────────────────────────────────────────── */
function OutcomesStrip() {
  const SECTION_BULLET_COUNTS: Record<string, number> = {
    renewals: 5,
    work: 6,
    evidence: 4,
    reports: 7,
  };
  return (
    <section
      aria-label="What teams use Oblixa for"
      className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
    >
      {OUTCOMES.map((o) => {
        const Icon = ICONS[o.iconName];
        return (
          <a
            key={o.id}
            href={o.anchor}
            className="group relative overflow-hidden rounded-2xl border p-4 transition-all hover:-translate-y-px motion-reduce:hover:translate-y-0 motion-reduce:transition-none"
            style={{
              ...toneStyle(o.tone),
              borderColor: "color-mix(in oklab, var(--section-tone) 24%, var(--border-subtle))",
              background: "color-mix(in oklab, var(--section-tone) 6%, var(--surface-raised))",
            }}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity group-hover:opacity-100 motion-reduce:transition-none"
              style={{ background: "radial-gradient(circle, color-mix(in oklab, var(--section-tone) 30%, transparent), transparent 70%)" }}
            />
            <div className="flex items-start justify-between">
              <span
                aria-hidden
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl"
                style={{
                  background: "color-mix(in oklab, var(--section-tone) 18%, var(--surface-raised))",
                  color: "var(--section-tone)",
                }}
              >
                <Icon className="h-4 w-4" strokeWidth={1.85} aria-hidden />
              </span>
              <span
                aria-hidden
                className="inline-flex h-5 min-w-[1.5rem] items-center justify-center rounded-md px-1 font-mono text-[10px] font-bold tabular-nums"
                style={{
                  background: "color-mix(in oklab, var(--section-tone) 12%, var(--surface-raised))",
                  color: "var(--section-tone)",
                }}
              >
                {SECTION_BULLET_COUNTS[o.id]}
              </span>
            </div>
            <p className="mt-3 text-[13.5px] font-semibold text-[var(--text-primary)]">
              {o.label}
            </p>
            <p className="mt-0.5 text-[11.5px] text-[var(--text-tertiary)]">
              {o.subtitle}
            </p>
          </a>
        );
      })}
    </section>
  );
}

/* ─── Before / After ──────────────────────────────────────────────── */
function BeforeAfter() {
  return (
    <section
      aria-label="What teams replace"
      className="relative mt-10 grid gap-3 sm:grid-cols-[1fr_auto_1fr]"
    >
      <div className="product-before-card rounded-2xl border border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] bg-[var(--surface-raised)] p-5">
        {/* v7 T27.19: both eyebrows dotless for parity. */}
        <p className="ui-caps-2 text-[10.5px] text-[var(--text-tertiary)]">Before</p>
        <p className="mt-1 text-[15px] font-semibold text-[var(--text-primary)]">
          Contract tracking spreadsheet
        </p>
        <div className="mt-3 overflow-hidden rounded-md border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface)_88%,white)]">
          <div className="grid grid-cols-[1fr_auto] gap-x-2 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            <span>Contract</span>
            <span>Owner</span>
          </div>
          {[
            { name: "Acme — MSA", owner: "?" },
            { name: "Initech — DPA", owner: "?" },
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
        <span
          aria-hidden
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:color-mix(in_oklab,var(--accent)_28%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_38%,var(--surface-raised))] text-[var(--accent-strong)] shadow-[var(--shadow-1)]"
        >
          <ChevronRight className="h-5 w-5" strokeWidth={2} />
        </span>
      </div>
      <div
        className="product-after-card relative overflow-hidden rounded-2xl border p-5"
        style={{
          borderColor: "color-mix(in oklab, var(--accent) 28%, var(--border-subtle))",
          background:
            "radial-gradient(ellipse 70% 80% at 0% 0%, color-mix(in oklab, var(--accent) 10%, transparent), transparent 60%), color-mix(in oklab, var(--accent-soft) 6%, var(--surface-raised))",
        }}
      >
        {/* v7 T27.19: dotless to match BEFORE. */}
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
              <span className="inline-flex h-4 min-w-[1.25rem] items-center justify-center rounded-full bg-[color:color-mix(in_oklab,var(--accent-soft)_60%,white)] px-1 font-mono text-[8.5px] font-bold text-[var(--accent-strong)]">
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
            Renewals and notice dates in a single calendar
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
        {steps.map((s, i) => {
          const Icon = s.Icon;
          return (
            <li key={s.label} className="relative">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 min-w-[2.5rem] items-center justify-center gap-1 rounded-md border border-[color:color-mix(in_oklab,var(--accent)_30%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_42%,var(--surface-raised))] px-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.12em] tabular-nums text-[var(--accent-strong)]">
                  <Icon className="h-3 w-3" strokeWidth={2} aria-hidden />
                  {s.label}
                </span>
                {i < steps.length - 1 ? (
                  <span aria-hidden className="product-ttv-progress-line hidden flex-1 sm:inline-block" />
                ) : null}
              </div>
              <p className="mt-2 text-[13.5px] leading-[1.55] text-[var(--text-secondary)]">
                {s.body}
              </p>
              {/* v7 T27.1: example data sentence case (was CAPS). */}
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
   v7 subtraction applied:
   - T28.1 decoration SVG NO LONGER rendered
   - T27.4  context strip caps line REMOVED
   - T28.5  inline trial CTAs REMOVED from per-section bodies
   - T27.13 drop cap REMOVED (no more `.product-drop-cap` class)
   - T28.3  display numeral 2.75rem 700 → 2rem 600
   - T28.6  eyebrow → h3 gap mt-2 → mt-1.5
   - T28.4  badge stamp KEPT (owns top-right uncontested now)
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
        "product-section-card product-target-flash landing-card-premium group relative overflow-hidden rounded-3xl border-l-4 transition-all hover:-translate-y-0.5 hover:border-[color:color-mix(in_oklab,var(--section-tone)_36%,var(--border-strong))] active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0 " +
        (belowFold ? "product-cv-auto" : "")
      }
      style={{
        ...toneStyle(section.tone),
        scrollMarginTop: "96px",
        borderLeftColor: "var(--section-tone)",
        background: "color-mix(in oklab, var(--section-tone) 5%, var(--surface-raised))",
      }}
    >
      {/* Timeline node at lg+ — structural anchor for the journey */}
      <span aria-hidden className="product-timeline-node hidden lg:inline-flex">
        {number}
      </span>
      {/* Subtle dot grid overlay */}
      <span aria-hidden className="product-section-dot-grid pointer-events-none absolute inset-0" />
      {/* Tone-tinted radial orb in top-right */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-60 blur-3xl"
        style={{
          background: "radial-gradient(circle, color-mix(in oklab, var(--section-tone) 22%, transparent), transparent 70%)",
        }}
      />
      {/* Badge stamp — top-right, single source of section identity (decoration SVG removed) */}
      <span
        aria-hidden
        className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em]"
        style={{
          borderColor: "color-mix(in oklab, var(--section-tone) 28%, var(--border-subtle))",
          background: "color-mix(in oklab, var(--section-tone) 14%, var(--surface-raised))",
          color: "var(--section-tone)",
        }}
      >
        {section.badge}
      </span>
      <div className="relative grid gap-5 p-6 sm:gap-6 sm:p-9 lg:grid-cols-[auto_minmax(0,1fr)]">
        {/* Single visual identity: the medallion icon. The section number now
            lives inline in the eyebrow as a tabular-nums prefix — no more
            awkward "number above icon" stack. */}
        <span
          aria-hidden
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl sm:h-14 sm:w-14"
          style={{
            border: "2px solid color-mix(in oklab, var(--section-tone) 20%, var(--border-subtle))",
            background: "color-mix(in oklab, var(--section-tone) 14%, var(--surface-raised))",
            color: "var(--section-tone)",
            boxShadow: "inset 0 1px 0 0 color-mix(in oklab, white 6%, transparent)",
          }}
        >
          <Icon className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.85} />
        </span>
        <div className="min-w-0">
          <p
            className="ui-caps-1 inline-flex items-center gap-2 text-[11px]"
            style={{ color: "var(--section-tone)" }}
          >
            <span
              className="font-bold tabular-nums tracking-[0.16em]"
              style={{ fontVariantNumeric: "tabular-nums lining-nums slashed-zero" }}
            >
              {number}
            </span>
            <span
              aria-hidden
              className="inline-block h-1 w-1 rounded-full"
              style={{ background: "var(--section-tone)" }}
            />
            {section.eyebrow}
          </p>
          {/* v7 T28.6: tighter eyebrow → h3 gap (mt-2 → mt-1.5). */}
          {/* v7 T26.2: h3 (not h2) — nested inside phase h2 for heading hierarchy. */}
          <h3
            id={headingId}
            className="mt-1.5 text-[1.5rem] font-semibold leading-[1.2] tracking-tight text-[var(--text-primary)] sm:text-[1.875rem]"
          >
            {section.title}
          </h3>
          {/* v7 T27.4: context strip caps line REMOVED. */}
          <p className="mt-3 text-[15px] leading-[1.65] text-[var(--text-secondary)]">
            {section.message}
          </p>
          {section.microStat ? (
            <p className="mt-3 inline-flex items-center gap-2 rounded-md border border-[color:color-mix(in_oklab,var(--section-tone)_18%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--section-tone)_6%,var(--surface-raised))] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)]">
              <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--section-tone)" }} />
              {section.microStat}
            </p>
          ) : null}
          <ul className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-2">
            {section.bullets.map((b, i) => {
              const isFirstBullet = i === 0;
              return (
                <li
                  key={b}
                  className={
                    "flex items-start gap-2 leading-[1.55] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] motion-reduce:transition-none " +
                    (isFirstBullet ? "text-[15px] font-medium" : "text-[14px]")
                  }
                >
                  {section.bulletVariant === "check" ? (
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 shrink-0"
                      style={{ color: "var(--section-tone)" }}
                      strokeWidth={2}
                      aria-hidden
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="product-bullet-gradient mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                    />
                  )}
                  {b}
                </li>
              );
            })}
          </ul>
          {/* v7 T28.5: per-section inline trial CTAs REMOVED. */}
        </div>
      </div>
      {/* Footer band */}
      {nextSection ? (
        <a
          href={`#${nextSection.id}`}
          className="relative flex items-center justify-between gap-3 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_50%,transparent)] px-7 py-3 text-[12px] transition-colors hover:bg-[color:color-mix(in_oklab,var(--section-tone)_5%,transparent)] motion-reduce:transition-none sm:px-9"
        >
          <span className="font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
            Next
          </span>
          <span className="inline-flex items-center gap-1.5 text-[var(--text-secondary)]">
            {nextSection.eyebrow}
            <ArrowRight
              className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
              strokeWidth={1.85}
              aria-hidden
            />
          </span>
        </a>
      ) : (
        <a
          href="#top"
          className="relative flex items-center justify-end gap-1.5 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_50%,transparent)] px-7 py-3 text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-secondary)] motion-reduce:transition-none sm:px-9"
        >
          <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
          Back to top
        </a>
      )}
    </section>
  );
}

/* ─── Phase header (round-2 redesign) ───────────────────────────────────
   The previous header was a baseline-shared row of [Phase 01 caps] [Title]
   [Sections 01–02 caps] sitting on a half-tinted band with an underline
   animation — read as ugly and over-styled. New shape: a clean separator,
   small phase caps eyebrow, h2 title, and a one-line description. No band,
   no animated underline, no redundant "Sections X–Y" suffix.
   ──────────────────────────────────────────────────────────────────── */
function PhaseHeader({ phase }: { phase: Phase }) {
  return (
    <div className="relative pt-8 sm:pt-12" style={phaseToneStyle(phase.id)}>
      {/* Top separator — thin, full-width, decorative */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)]"
      />
      <p
        className="ui-caps-2 text-[10.5px]"
        style={{ color: "var(--phase-tone)" }}
      >
        Phase {phase.number}
      </p>
      <h2 className="mt-1.5 text-[1.5rem] font-semibold tracking-tight text-[var(--text-primary)] sm:text-[1.75rem]">
        {phase.label}
      </h2>
      <p className="mt-2 max-w-2xl text-[14px] leading-[1.55] text-[var(--text-secondary)]">
        {PHASE_DESCRIPTIONS[phase.id]}
      </p>
    </div>
  );
}

/* ─── Closing CTA ──────────────────────────────────────────────────────
   v7 subtraction:
   - T27.5  "END OF TOUR · 7/7" caps line REMOVED
   - T28.10 bottom-left 2nd corner ring REMOVED
   - T27.29 reduced to 2 CTAs; "Or talk to founder" demoted below microcopy
   - T27.30 7-dot recap bumped (1.5px → 2.5px, opacity 70% → 90%)
   - T27.6  proof microbar reduced tracking + sentence case
   ──────────────────────────────────────────────────────────────────── */
function ClosingCta() {
  return (
    <section className="relative mt-16 overflow-hidden rounded-3xl border landing-card-premium p-8 text-center sm:mt-20 sm:p-12">
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
          Ready to replace the spreadsheet
        </p>
        <h2 className="mt-3 text-balance text-[1.75rem] font-semibold tracking-tight text-[var(--text-primary)] sm:text-[2.125rem]">
          Replace the spreadsheet this quarter.
        </h2>
        {/* Proof bar — CSS-divided cells (no text middle-dots).
            Reads as a structured 4-cell strip, not a comma-noise list. */}
        <div className="mx-auto mt-4 inline-flex divide-x divide-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] rounded-md border border-[color:color-mix(in_oklab,var(--border-subtle)_50%,transparent)] text-[11.5px] font-semibold text-[var(--text-tertiary)]">
          <span className="px-3 py-1.5"><span className="tabular-nums text-[var(--text-secondary)]">21</span>-day trial</span>
          <span className="px-3 py-1.5"><span className="tabular-nums text-[var(--text-secondary)]">25</span> contracts</span>
          <span className="px-3 py-1.5"><span className="tabular-nums text-[var(--text-secondary)]">3</span> users</span>
          <span className="px-3 py-1.5">CSV export</span>
        </div>
        {/* v7 T27.30: 7-dot recap visual weight bump. */}
        <div className="mt-4 flex items-center justify-center gap-2" aria-hidden>
          {PRODUCT_SECTIONS.map((s) => (
            <span
              key={s.id}
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: `color-mix(in oklab, ${TONE_TOKENS[s.tone]} 90%, transparent)` }}
            />
          ))}
        </div>
        {/* Closing CTA — registration component + trial disclaimer dropped.
            /product points to /pricing where the actual conversion funnel
            lives (with its own Start free trial CTA). Secondary path: book a
            setup call. */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/pricing"
            className="product-cta-halo ui-btn-primary inline-flex min-h-10 items-center gap-1.5 px-4 py-2 text-[13px] font-semibold"
          >
            View pricing
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
          </Link>
          <Link
            href="/contact?interested=core"
            prefetch={false}
            className="ui-btn-ghost inline-flex min-h-10 items-center gap-1.5 px-3.5 py-2 text-[13px] font-semibold"
          >
            Book setup call
          </Link>
        </div>
        {/* Tertiary actions stacked vertically — no middle-dot separator. */}
        <div className="mt-4 flex flex-col items-center gap-1 text-[12px] text-[var(--text-tertiary)]">
          <Link
            href="/contact?interested=founding_customer"
            prefetch={false}
            className="ui-link inline-flex items-center gap-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            Or talk to founder
            <ArrowUpRight className="h-3 w-3" strokeWidth={1.85} aria-hidden />
          </Link>
          <Link
            href="/pricing#pricing-faq-heading"
            prefetch={false}
            className="ui-link inline-flex items-center gap-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            Or skim the pricing FAQ
            <ArrowUpRight className="h-3 w-3" strokeWidth={1.85} aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────────
   v7 page-level subtraction:
   - T28.8 aurora top bar REMOVED
   - T28.7 phase-tone columns at far edges REMOVED
   - T28.9 atmospheric blobs hidden < md (kept lg+ for depth)
   - T27.10 pull quotes REMOVED entirely
   - T27.26 phase header → first section gap bumped
   - T27.25 section ↔ mock connector inserted
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
        <div aria-hidden className="landing-luminous__glow" />
        <div aria-hidden className="landing-luminous__grid" />
        {/* v7 T28.8: aurora bar removed. Accent gradient hairline alone. */}
        <div aria-hidden className="product-top-hairline" />
        {/* v7 T28.7: phase-tone columns removed. */}
        {/* v7 T28.9: atmospheric blobs hidden < md. */}
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

        <div className="relative mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
          <Hero />
          <BeforeAfter />
          <TimeToValue />
          <OutcomesStrip />
          <ProductAnchorNav />

          {/* Sections grouped by phase + vertical timeline rail (lg+).
              Tighter vertical spacing (sm:space-y-8) — the wider canvas + lighter
              phase headers reduce the need for big gaps. */}
          <div className="relative mt-8 space-y-6 sm:space-y-8">
            <span aria-hidden className="product-timeline-rail" />

            <PhaseHeader phase={PHASES[0]} />
            {setupSections.map((s) => renderSection(s))}

            <PhaseHeader phase={PHASES[1]} />
            {/* Section + mock pairs render as 2-col grid at lg+ to break the
                centered-column rhythm and stop mocks from dominating full width. */}
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
            {/* §6 evidence has no mock — full width. §7 reports pairs with the export mock. */}
            {sectionAt("evidence") ? renderSection(sectionAt("evidence")!, { belowFold: true }) : null}
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
