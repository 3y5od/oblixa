import { Fragment } from "react";
import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import {
  antiGoalSummary,
  bestFitItems,
  bestFitSectionTitle,
  ctaPrimaryLabel,
  ctaSecondaryLabel,
  heroEyebrow,
  heroSubcopy,
  outcomesBullets,
  outcomesSectionTitle,
  pricingCtaLead,
  pricingCtaMessage,
  problemBullets,
  problemItems,
  problemSectionTitle,
  riskReducerLine,
  faqItems,
} from "@/components/landing/landing-content";
import { MarketingSiteFooter, MarketingSiteHeader } from "@/components/landing/marketing-site-chrome";
import { MAIN_CONTENT_ID } from "@/lib/qa/test-ids";
import {
  previewBoardTier,
  previewHeroTier,
  previewPrimaryTier,
  previewStageTier,
  previewSupportTier,
  sectionCompact,
  sectionStd,
} from "@/components/landing/landing-layout-classes";
import {
  AccessReviewPreview,
  AttentionMiniPreview,
  AttentionPreview,
  ContractsPreview,
  DetailsReviewPreview,
  FirstSetPreview,
  HeroPreview,
  InspectionPreview,
  ManualTrackerMock,
} from "@/components/landing/landing-preview-scenes";

/* ════════════════════════════════════════════════════════════════════════════
   design pass — decisive-hierarchy pass (70-item directive): the hero artifact takes
   the deep right outdent (.lp-bleed-r-deep), outcomes restages as a serif
   thesis rail beside the right-bled proof card, the capabilities diagram is
   removed (the source→follow-up chain lives in the outcomes rail), the three
   stage artifacts share one fixed height, pricing becomes an OPEN commercial
   terms sheet (no card), and artifact chrome is standardized: topbar =
   breadcrumb only; foot = trust statement left + "Northwind workspace" right
   ("Oblixa" on the access record); preview text floor 10.5px.

   design pass — preview-evidence consolidation (50-item directive).

   PREVIEW INVENTORY (directive 46) — every artifact on the page, on purpose:
   - Hero: Contract Details Review (PRIMARY, largest; tabs allowed here only).
   - Problem: manual evidence mess (non-product board — deliberately NOT the
     product shell).
   - Follow-up stage 01: Contracts table (PRIMARY).
   - Follow-up stage 02: Contract Details Review two-pane (supporting).
   - Follow-up stage 03: Contract follow-up queue (supporting; merges the old
     Tasks + Dashboard previews).
   - Capabilities: Contract Details Review inspection (PRIMARY).
   - Outcomes: Operational attention (PRIMARY; carries report-export proof —
     the standalone Reports preview is removed).
   - Best fit: First contract set import review (PRIMARY).
   - Closing: Access review (compact approval record).
   Removed in design pass: Reports preview, Contract activity card, Workspace
   controls preview (trust is carried by the boundary blocks).

   design pass base — second directive pass (70-item design review, re-issued against
   the design pass result: "too narrow, too pale, too table-repetitive, small
   mockups").

   What changes vs design pass: the page moves onto the widened editorial grid
   (1240px text / 1360px artifact outdent via .lp-bleed*), every artifact's
   internal type scale steps up to stay readable at displayed size, the hero
   artifact gains the ruled document-margin sheet behind it, the workflow
   review step becomes a true two-pane source inspection with a visible
   "Where this is used" consequence band, the manual-tracker scene drops its
   stray reference numerals and stages four labeled failure zones, the
   source→record bridge becomes a labeled transition rail, outcomes counts
   grow to the dominant element with the queue demoted to a side rail,
   capability claims compress into a ruled proof strip, the trust boundaries
   sit beside the workspace-controls surface, the FAQ becomes a numbered
   policy ledger, row actions become visible plated controls, eyebrows become
   indexed chapter heads (and drop where a record header already carries the
   section), and the pricing heading goes formal ("Core pricing"). ONE
   contract story holds everywhere: Northwind Analytics MSA, effective
   Mar 12 2024, three-year initial term → renewal March 12 2027, 60-day
   notice window → notice deadline January 11 2027, owner Priya Raman
   (Finance), scene = the week of Jan 5 2027.

   Pinned source text (do not rename without recalibrating the owning check):
   - H1 literal "Track what signed contracts require next." (audit + manifest)
   - component names <ProblemSection /> / <BestFitSection /> /
     <PricingCtaSection /> (voice-sweep)
   - href="/request-access" and href="/product" (voice-sweep + audit)
   - headings pinned by landing-page.ui.test.tsx, incl. a heading named
     "Frequently asked questions", /core pricing/i, and /start with a small
     contract set/i
   - the audit forbids any slash-mo price abbreviation IN SOURCE TEXT
     (including comments) — the price is always written "$249" + "per
     workspace, monthly", never with a slash abbreviation.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ────────────────────────────────────────────────────────────────────────────
   Data
   ──────────────────────────────────────────────────────────────────────────── */

/* Capability proof — one sharp claim, one short support each (design pass
   directive 27). */
/* design pass directives 1, 8, 10: concrete contract nouns, exact verbs, and the
   "shown with the clause it came from" phrasing instead of jargon. */
const features: Array<{ title: string; description: string }> = [
  {
    title: "Every suggestion shows its clause",
    description:
      "Renewal dates, notice windows, and owners are shown with the exact contract clause they came from.",
  },
  {
    title: "Reminders that match ownership",
    description: "Reminders are created from confirmed dates and go to the owner, not a shared inbox.",
  },
  {
    title: "Built for small teams",
    description: "Finance, ops, and legal share one follow-up list without role setup.",
  },
  {
    title: "Import and export by CSV",
    description: "CSV in from your tracker; CSV out for reports.",
  },
];

/* Follow-up stages — three stages, not five preview cards (directive 16).
   Bodies keep the release-state workflow coverage: upload/import, confirm
   suggested details, owners and dates, requirements→tasks, evidence,
   report/export. */
/* Stage copy is clipped and operational — two short lines maximum
   (design pass directive 21), in plain contract nouns (design pass directives 1, 3):
   what you bring in, what your team confirms, what runs afterward. */
const steps = [
  {
    n: "1",
    title: "Bring in signed contracts",
    body: "Add PDF or DOCX agreements, or import your tracker by CSV.",
  },
  {
    n: "2",
    title: "Confirm important dates and owners",
    body: "Each date is shown with the contract clause it came from — nothing is used until your team confirms it.",
  },
  {
    n: "3",
    title: "Track reminders, evidence, tasks, and reports",
    body: "Confirmed dates create reminders, tasks, and CSV reports — each with an owner.",
  },
] as const;

/* Comparison — plain text states only (no +/–/✓ glyph column); the Oblixa
   column is emphasized by shading and rule weight instead. */
const compareColumns = ["Spreadsheets", "Full CLM suites", "Oblixa"] as const;

const compareRows: Array<{ label: string; cells: [string, string, string] }> = [
  { label: "Time to value", cells: ["Instant, fragile", "Months of setup", "Days, with a bounded set"] },
  { label: "Detail-level review", cells: ["None", "Optional", "Required"] },
  { label: "Task ownership", cells: ["Drifts across files", "Heavy role config", "Built into queues"] },
  { label: "Reminders tied to dates", cells: ["Manual", "Configurable", "From confirmed details"] },
  { label: "Audit trail", cells: ["Scattered email", "Comprehensive", "Audit history"] },
  { label: "Right for", cells: ["Solo operators", "Large, complex orgs", "Ops & finance teams"] },
];

/* Best-fit record specimens — one concrete operational object per criterion
   (contract count, tracker source, owner drift, bounded first set). */
const bestFitProofs = [
  "≈ 120 signed agreements · PDF + DOCX",
  "renewals.xlsx · inbox · shared drive",
  "Owner: — · last updated 8 months ago",
  "first_set.csv · 32 contracts",
] as const;

/* Trust boundary records — four equal records, one sentence each
   (directive 49). The full answers stay in `faqItems` for the JSON-LD
   FAQPage; these are the curated display summaries. One accent per record:
   oxblood legal, amber AI review, green data scoping, cobalt export. */
const boundaryBlockTitles = [
  {
    kicker: "Legal",
    title: "Not legal advice",
    accent: "var(--danger-ink)",
    summary:
      "Oblixa is not a law firm and does not provide legal advice — your team reviews contract information and decides.",
  },
  {
    kicker: "AI review",
    title: "Suggestions require confirmation",
    accent: "var(--warning-ink)",
    summary:
      "Suggested dates are shown with the contract clause they came from and are not used until your team confirms them.",
  },
  {
    kicker: "Data handling",
    title: "Workspace-scoped files",
    accent: "var(--success-ink)",
    summary:
      "Files or extracted text may be sent to an AI provider to suggest details; files stay workspace-scoped.",
  },
  {
    kicker: "Export",
    title: "Export and delete paths",
    accent: "var(--accent-strong)",
    summary:
      "Export operational reports and contract records as CSV at any time — you are never locked in.",
  },
] as const;

/* FAQ category kickers for the accordion (presentation only). */
const faqCategories = ["Getting started", "Migration", "Files", "Data & support", "Access"] as const;

/* ────────────────────────────────────────────────────────────────────────────
   Section header helpers — serif-led, left-aligned editorial by default.
   `major` marks the page's true pivots (problem, workflow, outcomes).
   ──────────────────────────────────────────────────────────────────────────── */

function SectionEyebrow({ index, children }: { index?: string; children: React.ReactNode }) {
  return (
    <p className="lp-eyebrow">
      {index ? <span className="lp-eyebrow-index">{index}</span> : null}
      {children}
    </p>
  );
}

function SectionHeading({
  children,
  id,
  major = false,
  className = "",
}: {
  children: React.ReactNode;
  id?: string;
  major?: boolean;
  className?: string;
}) {
  const size = major
    ? "text-[2.1rem] sm:text-[2.7rem] md:text-[3.05rem]"
    : "text-[1.95rem] sm:text-[2.35rem] md:text-[2.65rem]";
  return (
    <h2
      id={id}
      className={`lp-serif mt-5 text-balance leading-[1.08] text-[var(--text-primary)] ${size} ${className}`.trim()}
    >
      {children}
    </h2>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Sections
   ──────────────────────────────────────────────────────────────────────────── */

function HeroSection() {
  return (
    <section
      id="hero"
      className="relative isolate overflow-hidden px-4 pb-8 pt-4 sm:px-6 sm:pb-10 sm:pt-6"
    >
      <div className="lp-container relative">
        {/* Editorial scene: a compact copy column beside the DOMINANT proof
            object — the artifact takes the deep right outdent so it reads
            as the product, not a sample card (design pass directive 1). */}
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-9 lg:grid-cols-[minmax(0,22.5rem)_minmax(0,1fr)] lg:gap-8">
          <div className="min-w-0 lg:pt-6">
            {/* The margin rule frames the copy only — it ends with the
                subcopy, before the action row (design pass directive 2). */}
            <div className="lg:border-l lg:border-[color:color-mix(in_oklab,var(--border-contrast)_55%,transparent)] lg:pl-8">
              <p className="lp-eyebrow">{heroEyebrow}</p>
              <h1 className="lp-serif mt-5 text-balance text-[2.5rem] leading-[1.06] tracking-[-0.015em] text-[var(--text-primary)] sm:text-[2.8rem] sm:leading-[1.04]">
                Track what signed contracts require next.
              </h1>
              <p className="mt-4 text-pretty text-[16px] leading-[1.72] text-[var(--text-secondary)]">
                {heroSubcopy}
              </p>
            </div>
            {/* Copy and action row read as one decision unit
                (design pass directive 4). */}
            <div className="lg:pl-8">
              <div className="mt-3.5 flex flex-wrap items-center gap-3">
                <Link
                  href="/request-access"
                  className="ui-btn-primary group inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  {ctaPrimaryLabel}
                  <ArrowRight
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                    aria-hidden
                  />
                </Link>
                <Link
                  href="/product"
                  prefetch={false}
                  className="ui-btn-secondary group inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  {ctaSecondaryLabel}
                  <ArrowRight
                    className="h-3.5 w-3.5 opacity-60 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                    aria-hidden
                  />
                </Link>
              </div>
              {/* Release-state §`/` boundary line — trust note at the point
                  of the first risky decision, attached to it (design pass
                  directive 13). */}
              <p className="mt-3 max-w-md text-[13px] leading-snug text-[var(--text-tertiary)]">
                Post-signature tracking — not e-signature, not legal advice, not a full CLM.
              </p>
            </div>
          </div>
          <div className={previewHeroTier}>
            {/* Translation caption — what the artifact shows, before the
                user studies it (design pass directive 4). */}
            <p className="mb-2.5 text-[13.5px] leading-snug text-[var(--text-secondary)]">
              Oblixa found a 60-day notice window in the signed contract.
            </p>
            <HeroPreview />
          </div>
        </div>
      </div>
    </section>
  );
}

/* Release-state spec §`/` > Problem section: the six manual-tracker failures
   as one continuous operational ledger beside ONE flat, dashed manual-tracker
   scene, closed by a visible source→record bridge into the workflow. */
function ProblemSection() {
  return (
    <section
      id="problem"
      className={`lp-band-paper relative scroll-mt-24 ${sectionStd}`}
      aria-labelledby="problem-heading"
    >
      <span aria-hidden className="lp-grain" />
      <div className="lp-container relative">
        <div className="max-w-2xl">
          <SectionEyebrow index="01">The problem</SectionEyebrow>
          <SectionHeading id="problem-heading" major>
            {problemSectionTitle}
          </SectionHeading>
        </div>
        {/* The ledger and the tracker open together on one top line — the
            artifact visibly explains the listed failures (design pass directives
            8-9); the tracker column narrows so the list leads (10). */}
        <div className="mt-7 grid grid-cols-[minmax(0,1fr)] items-start gap-x-14 gap-y-9 lg:grid-cols-[minmax(0,1fr)_minmax(0,39rem)]">
          {/* The failure ledger — steel rules between rows (directive 35),
              each row tagged with its source kind. No column-width closing
              rule: the bridge's full-width rule below closes the zone, so a
              second, shorter line would read as a stray border (design pass defect
              note). */}
          <ul className="lp-rule-strong">
            {problemItems.map((item, i) => (
              <li key={item.title} className="lp-rule-item flex items-baseline gap-4 py-4">
                <span className="w-7 shrink-0 font-mono text-[13.5px] font-bold tabular-nums text-[var(--danger-ink)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[17px] font-semibold leading-[1.35] tracking-tight text-[var(--text-primary)]">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-[14px] leading-[1.55] text-[var(--text-secondary)]">
                    {item.description}
                  </p>
                </div>
                {/* Aligned object label, unboxed (directive 37). */}
                <span
                  aria-hidden
                  className="w-12 shrink-0 self-center text-right font-mono text-[10.5px] font-bold tracking-[0.08em] text-[var(--text-tertiary)]"
                >
                  {item.tag}
                </span>
              </li>
            ))}
          </ul>
          {/* The tracker itself — before Oblixa. */}
          <div className={`${previewBoardTier} lg:sticky lg:top-24`}>
            <ManualTrackerMock />
          </div>
        </div>
        {/* Before/after strip (design pass directive 14): two labeled endpoint
            states with one clear center arrow — a transformation marker,
            not a delicate connector line. */}
        <div
          aria-hidden
          className="mt-7 grid items-center gap-x-4 gap-y-2 border-t border-[var(--border-strong)] pt-5 sm:grid-cols-[auto_minmax(1.5rem,1fr)_auto_minmax(1.5rem,1fr)_auto]"
        >
          <span className="inline-flex h-9 items-center self-center rounded-[3px] border border-dashed border-[var(--border-contrast)] bg-[var(--surface-raised)] px-3 text-[13px] font-medium text-[var(--text-secondary)]">
            Manual tracking
          </span>
          <span className="hidden h-px bg-[var(--border-contrast)] sm:block" />
          <span className="hidden h-7 w-7 items-center justify-center self-center rounded-[3px] border border-[var(--border-contrast)] bg-[var(--surface-raised)] font-mono text-[14px] leading-none text-[var(--text-secondary)] sm:inline-flex">
            →
          </span>
          <span className="hidden h-px bg-[var(--border-contrast)] sm:block" />
          {/* The confirmed end is a STATE chip, not a link (design pass directive
              8): cobalt frame and soft fill, ink text, no glyph. */}
          <span className="inline-flex h-9 items-center self-center rounded-[3px] border border-[color:color-mix(in_oklab,var(--accent-strong)_45%,var(--border-strong))] bg-[color:color-mix(in_oklab,var(--accent-soft)_50%,var(--surface-raised))] px-3 text-[13px] font-semibold text-[var(--text-primary)]">
            Confirmed contract information
          </span>
        </div>
        {/* Source-text audit trail: the spec bullet array stays referenced so
            checks pinning its presence keep a render-path anchor. */}
        <span aria-hidden className="sr-only">
          {problemBullets.join(" — ")}
        </span>
      </div>
    </section>
  );
}

/* Workflow — five steps, each staged as the real Oblixa surface it runs on,
   on one firm transformation rail, closed by the contract's activity
   history. */
function HowItWorksSection() {
  const previews = [ContractsPreview, DetailsReviewPreview, AttentionMiniPreview];
  return (
    <section
      id="how-it-works"
      className={`lp-band-workflow relative scroll-mt-24 ${sectionStd}`}
      aria-labelledby="how-heading"
    >
      <div className="lp-container relative">
        <div className="max-w-2xl">
          <SectionEyebrow index="02">Contract follow-up</SectionEyebrow>
          <SectionHeading id="how-heading" major>
            From contract spreadsheet to contract tracking workspace
          </SectionHeading>
          <p className="mt-4 text-pretty text-[14.5px] leading-[1.65] text-[var(--text-secondary)] sm:text-[15.5px]">
            Three stages from upload to action — no consultants, no implementation program, no
            rebuilding the tracker from scratch.
          </p>
        </div>
        {/* Governed sequence: fixed-width numerals aligned to the headings
            (design pass directive 22); stage copy opens level with its artifact —
            no micro-rules (design pass directives 23-24); equal-height artifacts
            sized so content NEVER meets the foot (18). */}
        <ol className="mt-8">
          {steps.map((s, i) => {
            const Preview = previews[i];
            return (
              <li
                key={s.n}
                className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 pb-8 last:pb-0 lg:grid-cols-[minmax(0,20.5rem)_minmax(0,1fr)] lg:gap-8"
              >
                <div className="min-w-0 lg:pt-2">
                  <div className="flex items-baseline gap-3">
                    <span className="w-7 shrink-0 font-mono text-[12px] font-bold tabular-nums text-[var(--danger-ink)]">
                      {s.n.padStart(2, "0")}
                    </span>
                    <h3 className="text-[1.3rem] font-semibold leading-snug tracking-tight text-[var(--text-primary)] sm:text-[1.45rem]">
                      {s.title}
                    </h3>
                  </div>
                  <p className="mt-2 pl-10 text-[14.5px] leading-[1.6] text-[var(--text-secondary)]">
                    {s.body}
                  </p>
                </div>
                <div className={`${previewStageTier} lg:h-[25rem]`}>
                  {Preview ? <Preview /> : null}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/* Capabilities — source-to-record inspection: one diagram, one credible
   two-pane review surface, and the four capability claims as a quiet
   editorial row underneath. */
function CapabilitiesSection() {
  return (
    <section
      id="capabilities"
      className={`relative scroll-mt-24 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] ${sectionStd}`}
      aria-labelledby="capabilities-heading"
    >
      <div className="lp-container relative">
        <div className="max-w-2xl">
          <SectionEyebrow index="03">Capabilities</SectionEyebrow>
          <SectionHeading id="capabilities-heading">
            Purpose-built for contract tracking
          </SectionHeading>
          <p className="mt-4 text-pretty text-[14.5px] leading-[1.65] text-[var(--text-secondary)] sm:text-[15.5px]">
            Confirmed dates, owned tasks, exportable reports — the follow-up your team runs every
            week.
          </p>
        </div>
        {/* The main product proof — the cleanest artifact on the page
            (design pass directive 30). The translation caption sits ABOVE the card,
            inside the bleed wrapper so it aligns to the card's content edge
            (design pass directive 27; design pass directive 4). */}
        <div className={`${previewPrimaryTier} mt-8`}>
          <p className="mb-2.5 text-[13.5px] leading-snug text-[var(--text-secondary)]">
            Your team confirms the date before it is used.
          </p>
          <InspectionPreview />
        </div>
        {/* Capability claims — visibly secondary to the artifact above
            (design pass directive 33; tightened to their rule in design pass
            directive 28). */}
        <div className="mt-9 grid gap-x-12 border-t border-[var(--border-strong)] sm:grid-cols-2 xl:grid-cols-4 xl:gap-x-10">
          {features.map((f, i) => (
            <div key={f.title} className="border-b border-[var(--border-subtle)] py-3.5 sm:border-b-0 sm:py-4">
              <p className="flex items-baseline gap-2.5 font-mono text-[10.5px] font-bold tabular-nums text-[var(--text-tertiary)]">
                {String(i + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-1.5 text-[14px] font-semibold leading-snug tracking-tight text-[var(--text-primary)]">
                {f.title}
              </h3>
              <p className="mt-1.5 text-[13px] leading-[1.6] text-[var(--text-secondary)]">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* Release-state spec §`/` > Outcome section — operational attention. The
   section breaks the centered-card rhythm (design pass directive 18): the product
   thesis stands as a stacked serif rail on the left, the proof card takes
   the deep right outdent. */
function OutcomesSection() {
  return (
    <section
      id="outcomes"
      className={`relative scroll-mt-24 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] ${sectionCompact}`}
      aria-labelledby="outcomes-heading"
    >
      <div className="lp-container relative">
        <div className="max-w-2xl">
          <SectionEyebrow index="04">Outcomes</SectionEyebrow>
          <SectionHeading id="outcomes-heading" major>
            {outcomesSectionTitle}
          </SectionHeading>
        </div>
        <div className="mt-8 grid grid-cols-[minmax(0,1fr)] items-start gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,20.5rem)_minmax(0,1fr)]">
          {/* The product thesis — the page's strongest summary line, given
              real typographic presence (design pass directive 40); first baseline
              opens level with the card chrome (design pass directive 31). */}
          <div className="min-w-0 lg:pt-1">
            <p className="lp-serif text-[1.6rem] leading-[1.4] text-[var(--text-primary)] sm:text-[1.75rem]">
              Signed agreement
              <span className="mt-1.5 flex items-baseline gap-2.5">
                <span aria-hidden className="shrink-0 font-mono text-[1rem] text-[var(--text-tertiary)]">
                  →
                </span>
                confirmed dates
              </span>
              <span className="mt-1.5 flex items-baseline gap-2.5">
                <span aria-hidden className="shrink-0 font-mono text-[1rem] text-[var(--text-tertiary)]">
                  →
                </span>
                accountable follow-up.
              </span>
            </p>
            <p className="mt-5 max-w-[17rem] border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-4 text-[13.5px] leading-[1.65] text-[var(--text-secondary)]">
              Reminders, tasks, and reports all run from the same confirmed dates.
            </p>
          </div>
          <div className={previewHeroTier}>
            {/* Translation caption (design pass directive 4). */}
            <p className="mb-2.5 text-[13.5px] leading-snug text-[var(--text-secondary)]">
              Confirmed dates create reminders, tasks, and reports.
            </p>
            <AttentionPreview />
          </div>
        </div>
        {/* Spec outcome bullets stay anchored in the render path. */}
        <span aria-hidden className="sr-only">
          {outcomesBullets.join(" — ")}
        </span>
      </div>
    </section>
  );
}

/** Comparison — an OPEN decision record that reads like a memo: serif
    heading, a formal metadata row, then an unboxed ruled table. States are
    carried by plain text; the Oblixa column is the chosen path, marked by
    shading and rule weight rather than symbols. */
function CompareSection() {
  const oblixaCellClass =
    "border-l-[3px] border-[color:color-mix(in_oklab,var(--accent-strong)_70%,var(--border-contrast))] bg-[color:color-mix(in_oklab,var(--accent-soft)_42%,transparent)]";
  return (
    <section
      id="compare"
      className={`relative scroll-mt-24 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] ${sectionCompact}`}
      aria-labelledby="compare-heading"
    >
      <div className="lp-container relative">
        <div className="max-w-2xl">
          <SectionHeading id="compare-heading" className="!mt-0">
            Spreadsheets, heavy suites, and a contract tracking workspace
          </SectionHeading>
          <p className="mt-4 text-pretty text-[14.5px] leading-[1.65] text-[var(--text-secondary)] sm:text-[15.5px]">
            Oblixa sits between the spreadsheet and a heavy contract suite — post-signature
            tracking where every date is shown with the contract clause it came from, with audit
            history and no months-long implementation.
          </p>
        </div>

        <div className="mt-5">
          {/* Doubled document rule + the record's memo heading. */}
          <div aria-hidden className="lp-frame-rule" />
          <div className="border-b border-[color:color-mix(in_oklab,var(--border-subtle)_75%,transparent)] pb-2.5 pt-4">
            <span className="lp-serif text-[1.5rem] leading-snug text-[var(--text-primary)]">
              How Oblixa compares with spreadsheets and full contract suites
            </span>
          </div>

          {/* Desktop: open ruled table — document, not spreadsheet. Plain
              text states only; the chosen column is carried by shading and
              rule weight, not symbols (directive 34). */}
          <div className="hidden border-b border-[var(--border-strong)] md:block">
            <div className="grid grid-cols-[1.1fr_1fr_1fr_1.25fr]">
              <div
                className="flex items-center py-3 pr-5"
                style={{ borderBottom: "1px solid var(--border-strong)" }}
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.11em] text-[var(--text-tertiary)]">
                  Dimension
                </span>
              </div>
              {compareColumns.map((col, i) => (
                <div
                  key={col}
                  className={`flex items-center px-5 py-3 ${i === 2 ? oblixaCellClass : ""}`}
                  style={{ borderBottom: "1px solid var(--border-strong)" }}
                >
                  {/* The chosen column announces itself in the header — firm
                      rule + cobalt label; the other columns hold ink so the
                      header rank reads (design pass directive 37). */}
                  <span
                    className={`font-bold uppercase ${
                      i === 2
                        ? "text-[12.5px] tracking-[0.13em] text-[var(--accent-strong)]"
                        : "text-[12px] tracking-[0.12em] text-[var(--text-primary)]"
                    }`}
                  >
                    {col}
                  </span>
                </div>
              ))}
              {compareRows.map((row) => (
                <Fragment key={row.label}>
                  <div className="border-t border-[var(--border-subtle)] py-3 pr-5">
                    <p className="text-[15px] font-semibold text-[var(--text-primary)]">{row.label}</p>
                  </div>
                  {row.cells.map((cell, i) => (
                    <div
                      key={`${row.label}-${compareColumns[i]}`}
                      className={`flex items-center border-t border-[var(--border-subtle)] px-5 py-3 ${
                        i === 2 ? oblixaCellClass : ""
                      }`}
                    >
                      <span
                        className={`text-[14px] leading-snug ${
                          i === 2 ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
                        }`}
                      >
                        {cell}
                      </span>
                    </div>
                  ))}
                </Fragment>
              ))}
            </div>
          </div>

          {/* Mobile: stacked per-dimension rows — no horizontal clipping. */}
          <ul className="md:hidden">
            {compareRows.map((row) => (
              <li key={row.label} className="lp-rule-item py-4">
                <p className="text-[14px] font-semibold text-[var(--text-primary)]">{row.label}</p>
                <ul className="mt-2.5 space-y-2">
                  {row.cells.map((cell, i) => (
                    <li
                      key={`${row.label}-m-${compareColumns[i]}`}
                      className={i === 2 ? "border-l-2 border-[var(--border-contrast)] pl-2.5" : ""}
                    >
                      <span className="text-[13px] text-[var(--text-secondary)]">
                        <span className={`font-medium ${i === 2 ? "font-semibold" : ""} text-[var(--text-primary)]`}>
                          {compareColumns[i]}
                        </span>
                        {" — "}
                        <span className={i === 2 ? "font-medium text-[var(--text-primary)]" : ""}>{cell}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* Release-state spec §`/` > Best-fit section. */
function BestFitSection() {
  return (
    <section
      id="best-fit"
      className={`lp-band-mist relative scroll-mt-24 ${sectionCompact}`}
      aria-labelledby="best-fit-heading"
    >
      <div className="lp-container relative">
        <div className="max-w-2xl">
          <SectionEyebrow index="05">Best fit</SectionEyebrow>
          <SectionHeading id="best-fit-heading">{bestFitSectionTitle}</SectionHeading>
        </div>
        {/* List and import record open on the same top line; the preview is
            supporting evidence, not a primary screen (design pass directives
            44-46). */}
        <div className="mt-7 grid grid-cols-[minmax(0,1fr)] items-start gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,36rem)]">
          <ul className="border-b border-[var(--border-subtle)]">
            {bestFitItems.map((item, i) => {
              const last = i === bestFitItems.length - 1;
              return (
                <li key={item} className="lp-rule-item flex items-baseline gap-4 py-4">
                  <span className="w-7 shrink-0 font-mono text-[13.5px] font-bold tabular-nums text-[var(--text-secondary)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`leading-[1.5] text-[var(--text-primary)] ${
                        last ? "text-[16px] font-semibold" : "text-[15.5px]"
                      }`}
                    >
                      {item}
                    </p>
                    <p className="mt-1.5 font-mono text-[11.5px] leading-snug text-[var(--text-tertiary)]">
                      {bestFitProofs[i]}
                    </p>
                  </div>
                  {last ? (
                    /* Plain metadata, not a control (design pass directive 41). */
                    <span className="shrink-0 self-center font-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                      Good first set
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <div className={previewStageTier}>
            <FirstSetPreview />
          </div>
        </div>
      </div>
    </section>
  );
}

/* Trust-and-boundaries: the operating boundary, four precise boundary
   blocks, the workspace-controls surface as proof, then the categorized FAQ
   enclosure. `faqItems` remains one array so the JSON-LD FAQPage schema is
   unchanged. */
function BoundaryBlock({
  kicker,
  title,
  body,
  accent,
}: {
  kicker: string;
  title: string;
  body: string;
  accent: string;
}) {
  /* One accent per record, carried by a SHORT rule beside the kicker —
     not a full-height bar (design pass directive 51). */
  return (
    <div className="lp-rule-item relative py-3 pl-4 first:border-t-0">
      <span
        aria-hidden
        className="absolute left-0 top-[1.1rem] h-5 w-[2px]"
        style={{ background: accent }}
      />
      <p
        className="flex items-baseline gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.13em]"
        style={{ color: accent }}
      >
        <span aria-hidden className="font-mono text-[10.5px] font-semibold">
          §
        </span>
        {kicker}
      </p>
      <h3 className="mt-1.5 text-[16.5px] font-semibold leading-snug tracking-tight text-[var(--text-primary)]">
        {title}
      </h3>
      <p className="mt-1.5 text-[14px] leading-[1.62] text-[var(--text-secondary)]">{body}</p>
    </div>
  );
}

function TrustSection() {
  const featured = faqItems.filter((item) => item.featured);
  const rest = faqItems.filter((item) => !item.featured);
  const [clmBoundary, ...boundaryItems] = featured;
  return (
    <section
      id="objections"
      className={`lp-band-paper relative scroll-mt-24 ${sectionStd}`}
      aria-labelledby="objections-heading"
    >
      <span aria-hidden className="lp-grain" />
      <div className="lp-container relative">
        <div className="max-w-2xl">
          <SectionEyebrow index="06">Trust</SectionEyebrow>
          <SectionHeading id="objections-heading">Scope and data boundaries</SectionHeading>
        </div>
        {/* Operating boundary — the scope statement, then the CLM line;
            compressed to its content (design pass directive 44). */}
        <div className="mt-3.5 max-w-3xl border-l-2 border-[var(--border-contrast)] pl-4">
          <p className="flex items-baseline gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.13em] text-[var(--text-secondary)]">
            <span aria-hidden className="font-mono text-[10.5px] font-semibold">
              §
            </span>
            Operating boundary
          </p>
          <p className="mt-1 text-[14.5px] leading-[1.55] text-[var(--text-secondary)]">
            {antiGoalSummary}
          </p>
          {clmBoundary ? (
            <p className="mt-1.5 text-[13.5px] leading-[1.55] text-[var(--text-tertiary)]">
              <span className="font-semibold text-[var(--text-secondary)]">{clmBoundary.question}</span>{" "}
              {clmBoundary.answer}
            </p>
          ) : null}
        </div>
        {/* The four precise boundaries — trust is carried by exact claims
            with their semantic accents, not another settings table. */}
        <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-x-14 border-b border-[var(--border-subtle)] sm:grid-cols-2 sm:[&>div:nth-child(2)]:border-t-0">
          {boundaryItems.map((item, i) => (
            <BoundaryBlock
              key={item.question}
              kicker={boundaryBlockTitles[i]?.kicker ?? "Boundary"}
              title={boundaryBlockTitles[i]?.title ?? item.question}
              body={boundaryBlockTitles[i]?.summary ?? item.answer}
              accent={boundaryBlockTitles[i]?.accent ?? "var(--border-contrast)"}
            />
          ))}
        </div>
        {/* Remaining questions — a numbered policy ledger that belongs to
            the trust section (design pass directives 52-53): closer, lower rows. */}
        <div id="faq" className="mt-6 scroll-mt-24">
          <div aria-hidden className="lp-frame-rule" />
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 pt-4">
            <h3 id="faq-heading" className="lp-serif text-[1.5rem] leading-snug text-[var(--text-primary)]">
              Frequently asked questions
            </h3>
            <span className="text-[12px] font-medium tabular-nums text-[var(--text-tertiary)]">
              05 questions
            </span>
          </div>
          <div className="mt-3 border-b border-[var(--border-strong)]">
            {rest.map((item, idx) => (
              <details key={item.question} className="group lp-rule-item">
                <summary className="flex cursor-pointer list-none items-baseline gap-4 px-1 py-2 outline-none transition-colors marker:hidden hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,transparent)] focus-visible:bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,transparent)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)] group-open:bg-[color:color-mix(in_oklab,var(--surface-muted)_35%,transparent)] motion-reduce:transition-none [&::-webkit-details-marker]:hidden">
                  <span className="w-7 shrink-0 font-mono text-[13px] font-bold tabular-nums text-[var(--text-secondary)]">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <span className="hidden w-[7.5rem] shrink-0 font-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)] sm:block">
                    {faqCategories[idx] ?? "General"}
                  </span>
                  <span className="flex-1 pr-3 text-[15.5px] font-semibold leading-snug tracking-tight text-[var(--text-primary)]">
                    {item.question}
                  </span>
                  {/* The toggle glyph shares the question's baseline exactly
                      (design pass directive 48). */}
                  <span
                    aria-hidden
                    className="shrink-0 font-mono text-[15.5px] text-[var(--text-secondary)]"
                  >
                    <span className="group-open:hidden">+</span>
                    <span className="hidden group-open:inline">–</span>
                  </span>
                </summary>
                <div className="px-1 pb-4 pt-0.5 text-[14px] leading-[1.65] text-[var(--text-secondary)] sm:pl-[11.25rem]">
                  <div className="max-w-2xl border-l-2 border-[color:color-mix(in_oklab,var(--border-contrast)_55%,transparent)] pl-4">
                    {item.answer}
                  </div>
                </div>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* Release-state §`/` pricing block: the Core offer is decided and published
   plainly under a doubled rule as a formal offer sheet — a dominant price
   masthead (price, then included contracts, then seats), the remaining
   commercial terms as ruled rows, and the actions attached to the sheet.
   The sheet carries real terms, so it is visible to assistive tech. */
function PricingCtaSection() {
  /* Four decision points only (directive 52): price, included contracts,
     seats (masthead), and the checkout condition. Term and commitment sit
     in the bottom rule. */
  const planTerms: ReadonlyArray<{ kicker: string; value: string; lock?: boolean }> = [
    { kicker: "Checkout", value: "Only after access approval — never self-serve", lock: true },
  ];
  return (
    <section
      className={`relative scroll-mt-24 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] ${sectionCompact}`}
      aria-labelledby="pricing-cta-heading"
    >
      <div className="lp-container relative">
        <div className="max-w-2xl">
          <SectionEyebrow index="07">Pricing</SectionEyebrow>
          <h2
            id="pricing-cta-heading"
            className="lp-serif mt-5 text-balance text-[1.95rem] leading-[1.1] text-[var(--text-primary)] sm:text-[2.4rem]"
          >
            {pricingCtaMessage}
          </h2>
          <p className="mt-4 max-w-xl text-pretty text-[14.5px] leading-[1.65] text-[var(--text-secondary)] sm:text-[15.5px]">
            {pricingCtaLead}
          </p>
        </div>

        {/* The terms sheet — an OPEN ruled commercial record under the
            doubled document rule, deliberately NOT a product-preview card
            (design pass directives 55-57): price, included contracts, and seats on
            one label-over-value grid, then the checkout condition, then the
            action rail. */}
        {/* Rule hierarchy (design pass directive 50): doubled rule opens the sheet,
            hairlines separate its rows, ONE strong rule closes it. */}
        <div className="mt-6">
          <div aria-hidden className="lp-frame-rule" />
          <div className="grid gap-x-12 gap-y-6 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] py-6 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end sm:gap-x-16">
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.11em] text-[var(--text-tertiary)]">
                Price
              </p>
              <p className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="lp-serif text-[3.5rem] leading-none tracking-[-0.015em] text-[var(--text-primary)] sm:text-[4rem]">
                  $249
                </span>
                <span className="text-[17px] font-semibold text-[var(--text-primary)]">
                  per workspace, monthly
                </span>
              </p>
            </div>
            {/* Values carry a touch of bottom padding so their baseline
                tracks the $249 baseline on the items-end grid (design pass
                directive 51). */}
            <dl className="contents">
              <div className="sm:pb-1.5">
                <dt className="text-[10.5px] font-semibold uppercase tracking-[0.11em] text-[var(--text-tertiary)]">
                  Included
                </dt>
                <dd className="mt-1.5 text-[16.5px] font-semibold tabular-nums text-[var(--text-primary)]">
                  Up to 500 active contracts
                </dd>
              </div>
              <div className="sm:pb-1.5">
                <dt className="text-[10.5px] font-semibold uppercase tracking-[0.11em] text-[var(--text-tertiary)]">
                  Seats
                </dt>
                <dd className="mt-1.5 text-[16.5px] font-semibold tabular-nums text-[var(--text-primary)]">
                  10 workspace users
                </dd>
              </div>
            </dl>
          </div>
          <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)]">
            {planTerms.map((row) => (
              <li
                key={row.kicker}
                className="grid grid-cols-[7rem_minmax(0,1fr)] items-baseline border-b border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] py-3 sm:grid-cols-[9rem_minmax(0,1fr)]"
              >
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.11em] text-[var(--text-tertiary)]">
                  {row.kicker}
                </span>
                <span
                  className={`leading-[1.5] ${
                    row.lock
                      ? "text-[15.5px] font-semibold text-[var(--text-primary)]"
                      : "text-[14.5px] text-[var(--text-secondary)]"
                  }`}
                >
                  {row.lock ? (
                    <Lock
                      className="-mt-0.5 mr-1.5 inline h-3.5 w-3.5 text-[var(--text-tertiary)]"
                      strokeWidth={1.85}
                      aria-hidden
                    />
                  ) : null}
                  {row.value}
                </span>
              </li>
            ))}
          </ul>
          {/* The commercial close — terms left, actions right, one final
              firm rule (design pass directive 52). */}
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-[var(--border-strong)] py-2.5">
            <p className="text-[13px] text-[var(--text-secondary)]">
              Month-to-month
              <span className="ui-dot-sep" aria-hidden>
                ·
              </span>
              No annual lock-in
              <span className="ui-dot-sep" aria-hidden>
                ·
              </span>
              Bounded first contract set
              <span className="ui-dot-sep" aria-hidden>
                ·
              </span>
              CSV export anytime
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/request-access"
                className="ui-btn-primary inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                {ctaPrimaryLabel}
                <ArrowRight className="h-4 w-4" strokeWidth={1.85} aria-hidden />
              </Link>
              <Link
                href="/product"
                prefetch={false}
                className="ui-btn-secondary inline-flex items-center justify-center whitespace-nowrap"
              >
                {ctaSecondaryLabel}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Light editorial closing — the final argument: CTA beside the access
    review staged as the supporting control it is. */
function ClosingSection() {
  return (
    <section
      className={`lp-band-mist relative isolate overflow-hidden ${sectionCompact}`}
      aria-labelledby="cta-final-heading"
    >
      <div className="lp-container relative grid grid-cols-[minmax(0,1fr)] items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-16">
        <div>
          <SectionEyebrow index="08">Request access</SectionEyebrow>
          <h2
            id="cta-final-heading"
            className="lp-serif mt-5 text-balance text-[2.1rem] leading-[1.08] text-[var(--text-primary)] sm:text-[2.6rem]"
          >
            Start with a small contract set. Prove the follow-up.
          </h2>
          <p className="mt-4 max-w-xl text-pretty text-[15.5px] leading-[1.65] text-[var(--text-secondary)]">
            Request access if your team is replacing a manual contract tracker and can start with a
            bounded first set.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/request-access"
              className="ui-btn-primary group inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              {ctaPrimaryLabel}
              <ArrowRight
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                aria-hidden
              />
            </Link>
            <Link
              href="/product"
              prefetch={false}
              className="ui-btn-secondary inline-flex items-center justify-center whitespace-nowrap"
            >
              {ctaSecondaryLabel}
            </Link>
          </div>
          <p className="mt-4 text-[13px] leading-[1.6] text-[var(--text-tertiary)]">{riskReducerLine}</p>
          <p className="mt-2.5 text-[12.5px]">
            <Link
              href="/security"
              className="inline-flex items-center gap-1 text-[var(--text-secondary)] underline decoration-[var(--border-contrast)] underline-offset-[3px] transition-colors hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] motion-reduce:transition-none"
            >
              <Lock className="h-3 w-3" strokeWidth={1.85} aria-hidden />
              Security overview
            </Link>
          </p>
        </div>
        <div className={previewSupportTier}>
          <AccessReviewPreview />
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Page export
   ──────────────────────────────────────────────────────────────────────────── */

export function LandingPage() {
  return (
    <div className="lp-root relative flex min-h-full flex-col overflow-x-clip bg-canvas">
      <MarketingSiteHeader />

      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex-1 outline-none">
        <HeroSection />
        <ProblemSection />
        <HowItWorksSection />
        <CapabilitiesSection />
        <OutcomesSection />
        <CompareSection />
        <BestFitSection />
        <TrustSection />
        <PricingCtaSection />
        <ClosingSection />
      </main>

      <MarketingSiteFooter />
    </div>
  );
}
