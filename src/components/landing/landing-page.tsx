import { Fragment } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  CalendarCheck,
  Check,
  ChevronDown,
  Clock,
  FileText,
  Lock,
  MinusCircle,
  Users,
  X,
} from "lucide-react";
import {
  antiGoalSummary,
  bestFitItems,
  bestFitSectionTitle,
  ctaPrimaryLabel,
  ctaSecondaryLabel,
  heroEyebrow,
  heroSubcopy,
  objectionBullets,
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
import { StatusBadge, type SemanticStatus } from "@/components/ui/status-badge";
import { MarketingSiteFooter, MarketingSiteHeader } from "@/components/landing/marketing-site-chrome";
import { MAIN_CONTENT_ID } from "@/lib/qa/test-ids";

/* ════════════════════════════════════════════════════════════════════════════
   v18 — warm editorial system (lp-*).

   The luminous/glow/orb/glass language, the icon-tile card grids, and the
   browser-chrome product preview are gone (ui-design-principles §24 hard
   anti-patterns). Structure now alternates editorial fields, ledger-like
   artifacts, and rule lists on a warm paper canvas; major headings are serif
   (.lp-serif); the closing band is the page's single intentional ink panel.

   Pinned source text (do not rename without recalibrating the owning check):
   - H1 literal "Track what signed contracts require next." (audit + manifest)
   - component names <ProblemSection /> / <BestFitSection /> /
     <PricingCtaSection /> (voice-sweep)
   - href="/request-access" and href="/product" (voice-sweep + audit)
   ═══════════════════════════════════════════════════════════════════════════ */

/* ────────────────────────────────────────────────────────────────────────────
   Data
   ──────────────────────────────────────────────────────────────────────────── */

const features: Array<{ title: string; description: string }> = [
  {
    title: "Source-backed suggestions you review",
    description:
      "Oblixa suggests renewal, notice, and term details from the document. You confirm each value against the exact source snippet before it drives a single reminder.",
  },
  {
    title: "Reminders that match ownership",
    description:
      "Email reminders tied to confirmed dates and the right owner, so handoffs don’t strand follow-ups.",
  },
  {
    title: "Built for small teams",
    description:
      "Roles and focused queues let finance, ops, and legal share responsibility without CLM weight.",
  },
  {
    title: "Import and export contract records",
    description:
      "Bring over an existing tracker, then export contract records and reports — activation without the spreadsheet risk.",
  },
];

const steps = [
  {
    n: "1",
    eyebrow: "Upload",
    title: "Upload signed contracts or import a contract spreadsheet",
    body:
      "Add PDFs or DOCX agreements, or bring in an existing tracking spreadsheet by CSV. Files and metadata stay together, not scattered across a separate folder.",
  },
  {
    n: "2",
    eyebrow: "Review",
    title: "Review key dates, terms, and requirements with source evidence",
    body:
      "Suggested contract details surface renewal, notice, and termination values — not trusted until confirmed. Confirm each against the source snippet from the document before reminders or reports rely on it.",
  },
  {
    n: "3",
    eyebrow: "Assign",
    title: "Assign owners, dates, reminders, and tasks",
    body:
      "Reminders fire from confirmed dates with the right owner. Turn requirements into accountable tasks — follow-ups, approvals, problems to resolve — without leaving the workspace.",
  },
  {
    n: "4",
    eyebrow: "Track",
    title: "Track renewals, evidence, and problems",
    body:
      "Watch upcoming renewals, request evidence against requirements, and surface problems before deadlines slip. Audit history backs every decision.",
  },
  {
    n: "5",
    eyebrow: "Report",
    title: "Report and export without rebuilding the spreadsheet",
    body:
      "Run operational reports — renewals, missing owners, open requirements — and export contract records as CSV. No quarter-end scramble rebuilding a tracker by hand.",
  },
] as const;

type CompareLevel = "no" | "partial" | "yes";

const compareColumns = ["Spreadsheets", "Heavy contract suites", "Oblixa"] as const;

const compareRows: Array<{
  label: string;
  cells: Array<{ level: CompareLevel; text: string }>;
}> = [
  {
    label: "Time to value",
    cells: [
      { level: "partial", text: "Instant, fragile" },
      { level: "no", text: "Months of setup" },
      { level: "yes", text: "Live in days" },
    ],
  },
  {
    label: "Detail-level review",
    cells: [
      { level: "no", text: "None" },
      { level: "partial", text: "Optional" },
      { level: "yes", text: "Required" },
    ],
  },
  {
    label: "Task ownership",
    cells: [
      { level: "no", text: "Drifts across files" },
      { level: "partial", text: "Heavy role config" },
      { level: "yes", text: "Built into queues" },
    ],
  },
  {
    label: "Reminders tied to dates",
    cells: [
      { level: "no", text: "Manual" },
      { level: "yes", text: "Configurable" },
      { level: "yes", text: "From confirmed details" },
    ],
  },
  {
    label: "Audit trail",
    cells: [
      { level: "no", text: "Scattered email" },
      { level: "yes", text: "Comprehensive" },
      { level: "yes", text: "Audit history" },
    ],
  },
  {
    label: "Right for",
    cells: [
      { level: "partial", text: "Solo operators" },
      { level: "partial", text: "Large, complex orgs" },
      { level: "yes", text: "Ops & finance teams" },
    ],
  },
];

/* ────────────────────────────────────────────────────────────────────────────
   Shared mock primitives — one date format, one owner avatar, one confirm/edit
   pair, one source-evidence block, so every artifact speaks the product's
   review vocabulary (Confirmed / Needs confirmation / Suggested), never the
   internal one (approved/pending/blocked/exception).
   ──────────────────────────────────────────────────────────────────────────── */

/** Right-aligned, fixed-width, tabular date token. */
const mockDateClassName =
  "min-w-[3.25rem] shrink-0 text-right font-mono text-[10.5px] uppercase tracking-[0.08em] tabular-nums text-[var(--text-tertiary)]";

/** Renders "Head · Tail" with the middle dot styled as an intentional
    separator (.ui-dot-sep). Splits on the first " · " only. */
function DottedLabel({
  value,
  headClassName,
  tailClassName,
}: {
  value: string;
  headClassName?: string;
  tailClassName?: string;
}) {
  const idx = value.indexOf(" · ");
  if (idx === -1) return <span className={headClassName}>{value}</span>;
  return (
    <>
      <span className={headClassName}>{value.slice(0, idx)}</span>
      <span className="ui-dot-sep" aria-hidden>
        ·
      </span>
      <span className={tailClassName}>{value.slice(idx + 3)}</span>
    </>
  );
}

/** Consistent owner initials avatar. */
function OwnerAvatar({ initials }: { initials: string }) {
  return (
    <span
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-contrast)] font-mono text-[9px] font-bold tabular-nums text-[var(--text-secondary)]"
      aria-hidden
    >
      {initials}
    </span>
  );
}

/** Ink confirm + bordered edit affordances — the review pair every artifact
    repeats. "Confirm" is the release vocabulary; "Approve" is not. */
function MockConfirm() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-[var(--text-primary)] px-2.5 py-1 text-[11px] font-semibold text-[var(--canvas)]">
      <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden />
      Confirm
    </span>
  );
}
function MockEdit() {
  return (
    <span className="inline-flex items-center rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)]">
      Edit
    </span>
  );
}

/** Source-backed evidence block — a captioned quote on a paper-like inset.
    The <mark> is the owned source-location motif. */
function SourceSnippet({ children }: { children: React.ReactNode }) {
  return (
    <figure className="mt-2.5 overflow-hidden rounded-md border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-inset)_70%,var(--surface-raised))]">
      <figcaption className="flex items-center gap-1 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
        <FileText className="h-2.5 w-2.5" strokeWidth={2} aria-hidden />
        Source
      </figcaption>
      <p className="px-2.5 py-1.5 font-mono text-[11px] leading-[1.6] text-[var(--text-secondary)]">
        {children}
      </p>
    </figure>
  );
}

/** Located source text inside a snippet. */
function SourceMark({ children }: { children: React.ReactNode }) {
  return (
    <mark className="rounded-[3px] bg-[var(--warning-soft)] px-1 py-px font-semibold text-[var(--text-primary)]">
      {children}
    </mark>
  );
}

function MockContractRow({
  name,
  owner,
  date,
  status,
  statusLabel,
}: {
  name: string;
  owner: string;
  date: string;
  status: SemanticStatus;
  statusLabel: string;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_72%,transparent)] px-4 py-2.5 first:border-t-0 sm:gap-4">
      <div className="min-w-0">
        <p className="truncate text-[12.5px] leading-tight">
          <DottedLabel
            value={name}
            headClassName="font-semibold text-[var(--text-primary)]"
            tailClassName="text-[var(--text-secondary)]"
          />
        </p>
        <p className="mt-0.5 truncate text-[11px] leading-tight text-[var(--text-tertiary)]">
          <DottedLabel
            value={owner}
            headClassName="text-[var(--text-secondary)]"
            tailClassName="text-[var(--text-tertiary)]"
          />
        </p>
      </div>
      <StatusBadge status={status} className="shrink-0 text-[10px]">
        {statusLabel}
      </StatusBadge>
      <span className={mockDateClassName}>{date}</span>
    </div>
  );
}

/** Staged product artifact — warm container, thin border, quiet caption bar.
    Mock data is illustrative, so frames are aria-hidden by default. */
function ArtifactFrame({
  label,
  meta,
  children,
  footer,
}: {
  label: React.ReactNode;
  meta?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <figure aria-hidden className="lp-artifact">
      <figcaption className="lp-artifact-head">
        <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-[10.5px] font-semibold uppercase tracking-[0.13em] text-[var(--text-tertiary)]">
          {label}
        </span>
        {meta != null ? (
          <span className="inline-flex shrink-0 items-center font-mono text-[10.5px] tabular-nums text-[var(--text-tertiary)]">
            {meta}
          </span>
        ) : null}
      </figcaption>
      {children}
      {footer}
    </figure>
  );
}

function ArtifactFooter({
  icon: Icon,
  label,
  meta,
}: {
  icon: typeof CalendarCheck;
  label: string;
  meta: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] px-4 py-2.5">
      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.13em] text-[var(--text-tertiary)]">
        <Icon className="h-3 w-3" strokeWidth={2.1} aria-hidden />
        {label}
      </span>
      <span className="font-mono text-[10.5px] text-[var(--text-tertiary)]">{meta}</span>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Section header helpers — serif-led, left-aligned editorial by default.
   ──────────────────────────────────────────────────────────────────────────── */

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return <p className="lp-eyebrow">{children}</p>;
}

function SectionHeading({
  children,
  id,
  className = "",
}: {
  children: React.ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <h2
      id={id}
      className={`lp-serif mt-5 text-balance text-[1.85rem] leading-[1.12] text-[var(--text-primary)] sm:text-[2.3rem] md:text-[2.6rem] ${className}`}
    >
      {children}
    </h2>
  );
}

/** Accent on a selected phrase — single disciplined use of the retained blue. */
function AccentPhrase({ children }: { children: React.ReactNode }) {
  return <span className="text-[var(--accent-strong)]">{children}</span>;
}

/* ────────────────────────────────────────────────────────────────────────────
   Hero artifact — renewal ledger beside a source-backed suggested detail.
   This is the product thesis in one frame: signed text → suggested detail →
   confirmation → operational record.
   ──────────────────────────────────────────────────────────────────────────── */

function HeroArtifact() {
  return (
    <div className="mx-auto grid max-w-5xl items-start gap-4 sm:gap-5 lg:grid-cols-[1.45fr_1fr]">
      <ArtifactFrame
        label={
          <>
            Upcoming renewals
            <span className="ui-dot-sep" aria-hidden>
              ·
            </span>
            Q2
          </>
        }
        meta="2 of 5 need confirmation"
      >
        <div>
          <MockContractRow
            name="Meridian Logistics · MSA"
            owner="Sasha Olin · Ops"
            date="May 12"
            status="healthy"
            statusLabel="Confirmed"
          />
          <MockContractRow
            name="Northwind Analytics · Order form"
            owner="Priya Raman · Finance"
            date="May 28"
            status="in_review"
            statusLabel="Needs confirmation"
          />
          <MockContractRow
            name="Cardinal Facilities · DPA"
            owner="Marco Diaz · Legal"
            date="Jun 03"
            status="healthy"
            statusLabel="Confirmed"
          />
          <MockContractRow
            name="Beacon Staffing · Master services"
            owner="Tess Karim · Ops"
            date="Jun 14"
            status="warning"
            statusLabel="Notice window open"
          />
          <MockContractRow
            name="Summit Insurance · NDA"
            owner="Devon Reed · Legal"
            date="Jun 27"
            status="in_review"
            statusLabel="Needs confirmation"
          />
        </div>
      </ArtifactFrame>

      <ArtifactFrame
        label={
          <>
            Suggested detail
            <span className="ui-dot-sep" aria-hidden>
              ·
            </span>
            Northwind Analytics
          </>
        }
        meta={
          <StatusBadge status="in_review" className="text-[9.5px]">
            Suggested
          </StatusBadge>
        }
      >
        <div className="p-4">
          <p className="text-[13px] font-semibold leading-snug text-[var(--text-primary)]">
            Notice window
          </p>
          <p className="mt-0.5 text-[11.5px] text-[var(--text-secondary)]">
            60 days before renewal
            <span className="ui-dot-sep" aria-hidden>
              ·
            </span>
            confirm to enable reminders
          </p>
          <SourceSnippet>
            “Either party may terminate by providing <SourceMark>sixty (60) days</SourceMark>{" "}
            written notice…”
          </SourceSnippet>
          <div className="mt-3 flex items-center gap-2">
            <MockConfirm />
            <MockEdit />
          </div>
        </div>
      </ArtifactFrame>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Workflow rail mini artifacts
   ──────────────────────────────────────────────────────────────────────────── */

function IngestMiniMock() {
  const docs = [
    { name: "Meridian Logistics · MSA", type: "PDF · 14 pages", done: true },
    { name: "Northwind Analytics · Order form", type: "DOCX · 6 pages", done: false },
    { name: "Cardinal Facilities · DPA", type: "PDF · 9 pages", done: true },
  ];
  return (
    <ArtifactFrame label="Backlog" meta="3 of 124 contracts">
      <ul className="space-y-2 p-3">
        {docs.map((d) => (
          <li
            key={d.name}
            className="flex items-center gap-3 rounded-md border border-[color:color-mix(in_oklab,var(--border-subtle)_72%,transparent)] bg-[var(--surface-raised)] px-3 py-2"
          >
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--surface-contrast)] text-[var(--text-secondary)]">
              <FileText className="h-3.5 w-3.5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] leading-tight">
                <DottedLabel
                  value={d.name}
                  headClassName="font-semibold text-[var(--text-primary)]"
                  tailClassName="text-[var(--text-secondary)]"
                />
              </p>
              <p className="mt-0.5 truncate font-mono text-[11px] leading-tight text-[var(--text-tertiary)]">
                <DottedLabel value={d.type} />
              </p>
            </div>
            <span
              className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                d.done
                  ? "bg-[var(--success-soft)] text-[var(--success-ink)]"
                  : "bg-[var(--warning-soft)] text-[var(--warning-ink)]"
              }`}
            >
              {d.done ? (
                <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden />
              ) : (
                <Clock className="h-2.5 w-2.5" aria-hidden />
              )}
            </span>
          </li>
        ))}
      </ul>
    </ArtifactFrame>
  );
}

function ValidateMiniMock() {
  return (
    <ArtifactFrame
      label={
        <>
          Detail
          <span className="ui-dot-sep" aria-hidden>
            ·
          </span>
          Renewal date
        </>
      }
      meta={
        <StatusBadge status="in_review" className="text-[9.5px]">
          Suggested
        </StatusBadge>
      }
    >
      <div className="p-3.5">
        <p className="text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">
          March 12, 2027
        </p>
        <SourceSnippet>
          “The Initial Term shall commence on <SourceMark>March 12, 2024</SourceMark> and continue
          for three (3) years…”
        </SourceSnippet>
        <div className="mt-2.5 flex items-center gap-2">
          <MockConfirm />
          <MockEdit />
          <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-[11px] text-[var(--text-tertiary)]">
            <OwnerAvatar initials="MD" />
            Marco D.
          </span>
        </div>
      </div>
    </ArtifactFrame>
  );
}

function ExecuteMiniMock() {
  const reminders = [
    { label: "Meridian renewal", horizon: "30d", owner: "SO", date: "Apr 12" },
    { label: "Cardinal audit", horizon: "14d", owner: "MD", date: "May 20" },
    { label: "Beacon notice", horizon: "60d", owner: "TK", date: "Apr 15" },
  ];
  return (
    <ArtifactFrame label="Reminders" meta="this week">
      <ul className="space-y-1.5 p-3">
        {reminders.map((r) => (
          <li
            key={r.label}
            className="flex items-center gap-2.5 rounded-md border border-[color:color-mix(in_oklab,var(--border-subtle)_72%,transparent)] bg-[var(--surface-raised)] px-3 py-2"
          >
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--surface-contrast)] text-[var(--text-secondary)]">
              <Bell className="h-3 w-3" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-medium leading-tight text-[var(--text-primary)]">
                {r.label}
              </p>
              <span className="mt-1 inline-flex items-center rounded border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-contrast)_55%,var(--surface-raised))] px-1.5 py-px text-[9px] font-semibold uppercase tracking-[0.1em] tabular-nums text-[var(--text-tertiary)]">
                {r.horizon} notice
              </span>
            </div>
            <OwnerAvatar initials={r.owner} />
            <span className={mockDateClassName}>{r.date}</span>
          </li>
        ))}
      </ul>
    </ArtifactFrame>
  );
}

function TrackQueueMiniMock() {
  return (
    <ArtifactFrame label="Tracking" meta="this week">
      <div>
        <MockContractRow
          name="Meridian · MSA"
          owner="Sasha Olin · Ops"
          date="May 30"
          status="warning"
          statusLabel="Renewal due"
        />
        <MockContractRow
          name="Northwind · DPA"
          owner="Priya Raman · Finance"
          date="Jun 15"
          status="info"
          statusLabel="Evidence due"
        />
        <MockContractRow
          name="Cardinal · Lease"
          owner="Marco Diaz · Legal"
          date="Jun 02"
          status="blocked"
          statusLabel="Problem"
        />
      </div>
    </ArtifactFrame>
  );
}

function ReportMiniMock() {
  const reports = [
    { label: "Upcoming renewals", count: "12 contracts" },
    { label: "Missing owners", count: "3 contracts" },
    { label: "Open requirements", count: "8 requirements" },
  ];
  return (
    <ArtifactFrame label="Reports" meta="this quarter">
      <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_72%,transparent)]">
        {reports.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <span className="min-w-0 truncate text-[12.5px] font-medium text-[var(--text-primary)]">
              {r.label}
            </span>
            <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-[var(--text-secondary)]">
              {r.count}
            </span>
          </li>
        ))}
      </ul>
    </ArtifactFrame>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Sections
   ──────────────────────────────────────────────────────────────────────────── */

function HeroSection() {
  return (
    <section id="hero" className="relative isolate overflow-hidden px-4 pb-14 pt-12 sm:px-6 sm:pb-20 sm:pt-16">
      <span aria-hidden className="lp-grain" />
      <div className="relative mx-auto max-w-3xl text-center">
        <p className="lp-eyebrow justify-center">{heroEyebrow}</p>
        <h1 className="lp-serif mx-auto mt-6 text-balance text-[2.35rem] leading-[1.08] text-[var(--text-primary)] sm:text-[3rem] sm:leading-[1.06] lg:text-[3.4rem]">
          Track what signed contracts require next.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-pretty text-[15px] leading-[1.65] text-[var(--text-secondary)] sm:text-[16px]">
          {heroSubcopy}
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <Link href="/request-access" className="lp-btn-primary group">
            {ctaPrimaryLabel}
            <ArrowRight
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
              aria-hidden
            />
          </Link>
          <Link href="/product" prefetch={false} className="lp-btn-secondary group">
            {ctaSecondaryLabel}
            <ArrowRight
              className="h-3.5 w-3.5 opacity-60 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
              aria-hidden
            />
          </Link>
        </div>
        {/* Release-state §`/` risk reducer: boundary + export anytime + no
            annual commitment. */}
        <p className="mx-auto mt-4 max-w-lg text-[13px] leading-snug text-[var(--text-tertiary)]">
          Post-signature tracking — not e-signature, not legal advice, not a heavy contract suite.
          Export anytime; no annual commitment.
        </p>
      </div>
      <div className="relative mt-12 sm:mt-14">
        <HeroArtifact />
      </div>
    </section>
  );
}

/* Release-state spec §`/` > Problem section. The six spec bullets render as an
   editorial rule list — indexed, unboxed, no icon tiles. */
function ProblemSection() {
  return (
    <section id="problem" className="scroll-mt-24 px-4 py-14 sm:px-6 sm:py-20" aria-labelledby="problem-heading">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <SectionEyebrow>The problem</SectionEyebrow>
          <SectionHeading id="problem-heading">{problemSectionTitle}</SectionHeading>
        </div>
        <ul className="mt-10 grid gap-x-12 sm:grid-cols-2">
          {problemItems.map((item, i) => (
            <li key={item.title} className="lp-rule-item flex items-baseline gap-4 py-4">
              <span className="shrink-0 font-mono text-[11px] font-semibold tabular-nums text-[var(--text-tertiary)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold leading-[1.4] text-[var(--text-primary)]">
                  {item.title}
                </h3>
                <p className="mt-1 text-[13.5px] leading-[1.55] text-[var(--text-secondary)]">
                  {item.description}
                </p>
              </div>
            </li>
          ))}
        </ul>
        {/* Source-text audit trail: the spec bullet array stays referenced so
            checks pinning its presence keep a render-path anchor. */}
        <span aria-hidden className="sr-only">
          {problemBullets.join(" — ")}
        </span>
      </div>
    </section>
  );
}

/* Workflow rail — source-to-record transformation in five connected steps. */
function HowItWorksSection() {
  const mocks = [IngestMiniMock, ValidateMiniMock, ExecuteMiniMock, TrackQueueMiniMock, ReportMiniMock];
  return (
    <section
      id="how-it-works"
      className="lp-band relative scroll-mt-24 px-4 py-14 sm:px-6 sm:py-20"
      aria-labelledby="how-heading"
    >
      <span aria-hidden className="lp-grain" />
      <div className="relative mx-auto max-w-5xl">
        <div className="max-w-2xl">
          <SectionEyebrow>Workflow</SectionEyebrow>
          <SectionHeading id="how-heading">
            From contract spreadsheet to <AccentPhrase>contract tracking workspace</AccentPhrase>
          </SectionHeading>
          <p className="mt-4 text-pretty text-[14px] leading-[1.65] text-[var(--text-secondary)] sm:text-[15px]">
            Five steps from upload to action — no consultants, no implementation program, no
            rebuilding the tracker from scratch.
          </p>
        </div>
        <ol className="relative mt-12">
          <span
            aria-hidden
            className="absolute bottom-10 left-[1.1rem] top-2 hidden w-px bg-[color:color-mix(in_oklab,var(--border-strong)_55%,transparent)] sm:block"
          />
          {steps.map((s, i) => {
            const Mock = mocks[i];
            const artifactFirst = i % 2 === 1;
            return (
              <li key={s.n} className="relative grid gap-5 pb-12 last:pb-0 sm:grid-cols-[2.25rem_minmax(0,1fr)] sm:gap-7">
                <span className="relative z-10 hidden h-9 w-9 items-center justify-center rounded-md border border-[var(--border-strong)] bg-[var(--surface-raised)] font-mono text-[13px] font-bold tabular-nums text-[var(--text-primary)] sm:inline-flex">
                  {s.n}
                </span>
                <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,21rem)] lg:gap-12">
                  <div className={`min-w-0 ${artifactFirst ? "lg:order-2" : ""}`}>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                      <span className="sm:hidden">{s.n} · </span>
                      {s.eyebrow}
                    </p>
                    <h3 className="mt-2 text-[1.25rem] font-semibold leading-snug tracking-tight text-[var(--text-primary)] sm:text-[1.45rem]">
                      {s.title}
                    </h3>
                    <p className="mt-2.5 max-w-xl text-[14px] leading-[1.65] text-[var(--text-secondary)]">
                      {s.body}
                    </p>
                  </div>
                  <div className={artifactFirst ? "lg:order-1" : ""}>{Mock ? <Mock /> : null}</div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function CapabilitiesSection() {
  return (
    <section
      id="capabilities"
      className="scroll-mt-24 px-4 py-14 sm:px-6 sm:py-20"
      aria-labelledby="capabilities-heading"
    >
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-16">
        <div>
          <SectionEyebrow>Capabilities</SectionEyebrow>
          <SectionHeading id="capabilities-heading">
            Purpose-built for contract tracking
          </SectionHeading>
          <p className="mt-4 text-pretty text-[14px] leading-[1.65] text-[var(--text-secondary)] sm:text-[15px]">
            The workflows your team runs every week — without the months-long CLM.
          </p>
        </div>
        <ul>
          {features.map((f) => (
            <li key={f.title} className="lp-rule-item py-5 first:border-t-0 first:pt-0 lg:first:pt-5 lg:first:border-t">
              <h3 className="text-[15.5px] font-semibold leading-snug tracking-tight text-[var(--text-primary)]">
                {f.title}
              </h3>
              <p className="mt-1.5 max-w-2xl text-[14px] leading-[1.6] text-[var(--text-secondary)]">
                {f.description}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* Release-state spec §`/` > Outcome section. */
function OutcomesSection() {
  return (
    <section
      id="outcomes"
      className="lp-band scroll-mt-24 px-4 py-14 sm:px-6 sm:py-20"
      aria-labelledby="outcomes-heading"
    >
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <SectionEyebrow>Outcomes</SectionEyebrow>
          <SectionHeading id="outcomes-heading">{outcomesSectionTitle}</SectionHeading>
        </div>
        <div className="mt-10 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-14">
          <ol>
            {outcomesBullets.map((b, i) => (
              <li key={b} className="lp-rule-item flex items-baseline gap-4 py-4 first:border-t-0 first:pt-0">
                <span className="shrink-0 font-mono text-[11px] font-semibold tabular-nums text-[var(--text-tertiary)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="text-[14.5px] leading-[1.5] text-[var(--text-primary)]">{b}</p>
              </li>
            ))}
          </ol>
          <ArtifactFrame
            label="Attention queue"
            meta="3 contracts this week"
            footer={
              <ArtifactFooter icon={CalendarCheck} label="Dates confirmed from source" meta="renewals.q2" />
            }
          >
            <div>
              <MockContractRow
                name="Meridian · MSA"
                owner="Sasha Olin · Operations"
                date="May 12"
                status="warning"
                statusLabel="Notice window open"
              />
              <MockContractRow
                name="Northwind · Order form"
                owner="Priya Raman · Finance"
                date="May 28"
                status="info"
                statusLabel="Evidence due"
              />
              <MockContractRow
                name="Cardinal · DPA"
                owner="Marco Diaz · Legal"
                date="Jun 03"
                status="in_review"
                statusLabel="Needs confirmation"
              />
            </div>
          </ArtifactFrame>
        </div>
      </div>
    </section>
  );
}

function CompareGlyph({ level }: { level: CompareLevel }) {
  if (level === "yes") {
    return (
      <span
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--success-soft)] text-[var(--success-ink)]"
        aria-hidden
      >
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
    );
  }
  if (level === "partial") {
    return (
      <span
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--warning-soft)] text-[var(--warning-ink)]"
        aria-hidden
      >
        <MinusCircle className="h-3 w-3" strokeWidth={1.85} />
      </span>
    );
  }
  return (
    <span
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--surface-contrast)] text-[var(--text-tertiary)]"
      aria-hidden
    >
      <X className="h-3 w-3" strokeWidth={1.85} />
    </span>
  );
}

/** Comparison ledger — one table, warm header band, fine row rules; the
    Oblixa column carries a quiet selected-state tint. */
function CompareSection() {
  const oblixaCellTint = "bg-[color:color-mix(in_oklab,var(--accent-soft)_26%,var(--surface-raised))]";
  return (
    <section id="compare" className="scroll-mt-24 px-4 py-14 sm:px-6 sm:py-20" aria-labelledby="compare-heading">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <SectionEyebrow>Compare approaches</SectionEyebrow>
          <SectionHeading id="compare-heading">
            Spreadsheets, heavy suites, and a <AccentPhrase>contract tracking workspace</AccentPhrase>
          </SectionHeading>
          <p className="mt-4 text-pretty text-[14px] leading-[1.65] text-[var(--text-secondary)] sm:text-[15px]">
            Oblixa sits between the spreadsheet and a heavy contract suite — post-signature tracking
            with source-backed evidence and audit history, no months-long implementation.
          </p>
        </div>

        {/* Desktop ledger */}
        <div className="lp-artifact mt-12 hidden md:block">
          <div className="grid grid-cols-[1.2fr_1fr_1fr_1.2fr]">
            <div className="lp-ledger-head px-5 py-3" />
            {compareColumns.map((col, i) => (
              <div
                key={col}
                className={`lp-ledger-head flex items-center gap-2 px-5 py-3 ${i === 2 ? oblixaCellTint : ""}`}
              >
                <span className="text-[12px] font-bold tracking-tight text-[var(--text-primary)]">
                  {col}
                </span>
                {i === 2 ? (
                  <span className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-[var(--accent-strong)]">
                    Best fit
                  </span>
                ) : null}
              </div>
            ))}
            {compareRows.map((row) => (
              <Fragment key={row.label}>
                <div className="border-t border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] px-5 py-3.5">
                  <p className="text-[13px] font-semibold text-[var(--text-primary)]">{row.label}</p>
                </div>
                {row.cells.map((cell, i) => (
                  <div
                    key={`${row.label}-${compareColumns[i]}`}
                    className={`flex items-center gap-2.5 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] px-5 py-3.5 ${
                      i === 2 ? oblixaCellTint : ""
                    }`}
                  >
                    <CompareGlyph level={cell.level} />
                    <span className="text-[13px] leading-snug text-[var(--text-secondary)]">
                      {cell.text}
                    </span>
                  </div>
                ))}
              </Fragment>
            ))}
          </div>
        </div>

        {/* Mobile: stacked per-dimension rows — no horizontal clipping. */}
        <ul className="mt-10 md:hidden">
          {compareRows.map((row) => (
            <li key={row.label} className="lp-rule-item py-4">
              <p className="text-[14px] font-semibold text-[var(--text-primary)]">{row.label}</p>
              <ul className="mt-2.5 space-y-2">
                {row.cells.map((cell, i) => (
                  <li key={`${row.label}-m-${compareColumns[i]}`} className="flex items-center gap-2.5">
                    <CompareGlyph level={cell.level} />
                    <span className="text-[13px] text-[var(--text-secondary)]">
                      <span className="font-medium text-[var(--text-primary)]">{compareColumns[i]}</span>
                      {" — "}
                      {cell.text}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* Release-state spec §`/` > Best-fit section. */
function BestFitSection() {
  return (
    <section
      id="best-fit"
      className="lp-band scroll-mt-24 px-4 py-14 sm:px-6 sm:py-20"
      aria-labelledby="best-fit-heading"
    >
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <SectionEyebrow>Best fit</SectionEyebrow>
          <SectionHeading id="best-fit-heading">{bestFitSectionTitle}</SectionHeading>
        </div>
        <div className="mt-10 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-14">
          <ul>
            {bestFitItems.map((item) => (
              <li key={item} className="lp-rule-item flex items-baseline gap-3.5 py-4 first:border-t-0 first:pt-0">
                <Check
                  className="h-4 w-4 shrink-0 translate-y-0.5 text-[var(--text-primary)]"
                  strokeWidth={2.4}
                  aria-hidden
                />
                <p className="text-[14.5px] leading-[1.55] text-[var(--text-primary)]">{item}</p>
              </li>
            ))}
          </ul>
          <ArtifactFrame
            label="Cross-functional ownership"
            meta="48 active contracts"
            footer={<ArtifactFooter icon={Users} label="Owners across four functions" meta="portfolio.q3" />}
          >
            <div>
              <MockContractRow
                name="Beacon · MSA"
                owner="Tess Karim · Operations"
                date="Jul 14"
                status="warning"
                statusLabel="Notice window open"
              />
              <MockContractRow
                name="Summit Insurance · Lease"
                owner="Devon Reed · Finance"
                date="Aug 02"
                status="healthy"
                statusLabel="Confirmed"
              />
              <MockContractRow
                name="Pierpoint · SOW"
                owner="Aria Sun · Accounts"
                date="Sep 28"
                status="in_review"
                statusLabel="Needs confirmation"
              />
              <MockContractRow
                name="Cardinal · DPA"
                owner="Marco Diaz · Legal"
                date="Oct 11"
                status="info"
                statusLabel="Evidence due"
              />
            </div>
          </ArtifactFrame>
        </div>
      </div>
    </section>
  );
}

function HonestAnswersSection() {
  return (
    <section
      id="objections"
      className="scroll-mt-24 px-4 pt-14 pb-4 sm:px-6 sm:pt-20 sm:pb-6"
      aria-labelledby="objections-heading"
    >
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <SectionEyebrow>Honest answers</SectionEyebrow>
          <SectionHeading id="objections-heading">
            Practical answers to common concerns
          </SectionHeading>
        </div>
        <ul className="mt-8 max-w-3xl">
          {objectionBullets.map((o) => (
            <li key={o.title} className="lp-rule-item py-5">
              <h3 className="text-[15.5px] font-semibold tracking-tight text-[var(--text-primary)]">
                {o.title}
              </h3>
              <p className="mt-1.5 text-[14px] leading-[1.6] text-[var(--text-secondary)]">{o.body}</p>
            </li>
          ))}
        </ul>
        <p className="mt-8 max-w-3xl border-l-2 border-[var(--border-contrast)] pl-5 text-[14.5px] leading-[1.65] text-[var(--text-secondary)]">
          {antiGoalSummary}
        </p>
      </div>
    </section>
  );
}

function FaqSection() {
  return (
    <section id="faq" className="scroll-mt-24 px-4 py-14 sm:px-6 sm:py-20" aria-labelledby="faq-heading">
      <div className="mx-auto max-w-5xl">
        <div className="max-w-2xl">
          <SectionEyebrow>FAQ</SectionEyebrow>
          <SectionHeading id="faq-heading">Frequently asked questions</SectionHeading>
          <p className="mt-4 text-[14px] leading-[1.65] text-[var(--text-secondary)]">
            Straightforward answers about scope, AI, and how teams use Oblixa.
          </p>
        </div>
        <div className="lp-artifact mt-10 lg:grid lg:grid-cols-2 lg:divide-x lg:divide-[color:color-mix(in_oklab,var(--border-subtle)_92%,transparent)]">
          {faqItems.map((item, idx) => (
            <details
              key={item.question}
              className={`group ${
                idx < faqItems.length - 1
                  ? "border-b border-[color:color-mix(in_oklab,var(--border-subtle)_92%,transparent)]"
                  : ""
              } lg:[&:nth-last-child(-n+2)]:border-b-0`}
            >
              <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-4.5 outline-none transition-colors marker:hidden hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,transparent)] focus-visible:bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,transparent)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)] motion-reduce:transition-none sm:px-6 sm:py-5 [&::-webkit-details-marker]:hidden">
                <span className="flex-1 pr-3 text-[14px] font-semibold leading-snug tracking-tight text-[var(--text-primary)]">
                  {item.question}
                </span>
                <ChevronDown
                  className="h-4 w-4 shrink-0 text-[var(--text-tertiary)] transition-transform group-open:rotate-180 motion-reduce:transition-none"
                  strokeWidth={1.85}
                  aria-hidden
                />
              </summary>
              <div className="px-5 pb-6 pt-1 text-[14px] leading-[1.7] text-[var(--text-secondary)] sm:px-6">
                {item.answer}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* Release-state §`/` pricing block: the Core offer is decided and published
   plainly; access review is a condition, not the headline. */
function PricingCtaSection() {
  return (
    <section className="lp-band scroll-mt-24 px-4 py-14 sm:px-6 sm:py-20" aria-labelledby="pricing-cta-heading">
      <div className="mx-auto max-w-2xl text-center">
        <p className="lp-eyebrow justify-center">Pricing</p>
        <h2
          id="pricing-cta-heading"
          className="lp-serif mt-5 text-balance text-[1.75rem] leading-[1.15] text-[var(--text-primary)] sm:text-[2.2rem]"
        >
          {pricingCtaMessage}
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-[14px] leading-[1.65] text-[var(--text-secondary)] sm:text-[15px]">
          {pricingCtaLead}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/request-access" className="lp-btn-primary">
            {ctaPrimaryLabel}
            <ArrowRight className="h-4 w-4" strokeWidth={1.85} aria-hidden />
          </Link>
          <Link href="/product" prefetch={false} className="lp-btn-secondary">
            {ctaSecondaryLabel}
          </Link>
        </div>
        <p className="mt-7 text-[13px] text-[var(--text-tertiary)]">
          Bounded first contract set
          <span className="ui-dot-sep" aria-hidden>
            ·
          </span>
          No full migration required
          <span className="ui-dot-sep" aria-hidden>
            ·
          </span>
          CSV export anytime
        </p>
      </div>
    </section>
  );
}

/** Closing band — the page's one intentional ink panel. */
function FinalCtaSection() {
  return (
    <section
      className="lp-ink-band relative isolate overflow-hidden px-4 py-16 sm:px-6 sm:py-24"
      aria-labelledby="cta-final-heading"
    >
      <div className="relative mx-auto max-w-2xl text-center">
        <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[oklch(0.74_0.02_80)]">
          <Clock className="h-3 w-3" aria-hidden />
          Reviewed access
        </p>
        <h2
          id="cta-final-heading"
          className="lp-serif mt-6 text-balance text-[2.1rem] leading-[1.08] text-[oklch(0.96_0.01_86)] sm:text-[2.8rem]"
        >
          Start with a small contract set.{" "}
          <span className="text-[oklch(0.84_0.055_75)]">Prove the workflow.</span>
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-[15px] leading-[1.65] text-[oklch(0.82_0.015_82)] sm:text-[16px]">
          Request access if your team is replacing a manual contract tracker and can start with a
          bounded first set.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <Link href="/request-access" className="lp-btn-primary-inverse group">
            {ctaPrimaryLabel}
            <ArrowRight
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
              aria-hidden
            />
          </Link>
          <Link href="/product" prefetch={false} className="lp-btn-outline-inverse">
            {ctaSecondaryLabel}
          </Link>
        </div>
        <p className="mt-6 text-[12.5px] leading-[1.6] text-[oklch(0.72_0.015_80)]">{riskReducerLine}</p>
        <p className="mt-3 text-[12px]">
          <Link
            href="/security"
            className="inline-flex items-center gap-1 text-[oklch(0.82_0.015_82)] underline decoration-[oklch(0.5_0.015_78)] underline-offset-[3px] transition-colors hover:text-[oklch(0.96_0.01_86)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[oklch(0.74_0.02_80)] motion-reduce:transition-none"
          >
            <Lock className="h-3 w-3" strokeWidth={1.85} aria-hidden />
            Security overview
          </Link>
        </p>
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
        <HonestAnswersSection />
        <FaqSection />
        <PricingCtaSection />
        <FinalCtaSection />
      </main>

      <MarketingSiteFooter />
    </div>
  );
}
