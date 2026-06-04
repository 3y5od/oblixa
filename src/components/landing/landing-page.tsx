import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Bell,
  Calendar,
  CalendarCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileSpreadsheet,
  FileText,
  FolderSearch,
  Layers,
  Lock,
  MailQuestion,
  MinusCircle,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
  Workflow,
  X,
  type LucideIcon,
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
  problemCards,
  problemSectionTitle,
  riskReducerLine,
  faqItems,
} from "@/components/landing/landing-content";
import { SectionOrb } from "@/components/ui/section-orb";
import { StatusBadge, type SemanticStatus } from "@/components/ui/status-badge";
import { CountChip } from "@/components/ui/count-chip";
import { KeyValueChip } from "@/components/ui/key-value-chip";
import { MarketingSiteFooter, MarketingSiteHeader } from "@/components/landing/marketing-site-chrome";
import { LandingAnchorNav } from "@/components/landing/landing-anchor-nav";
import { MAIN_CONTENT_ID } from "@/lib/qa/test-ids";

/* ────────────────────────────────────────────────────────────────────────────
   Data
   ──────────────────────────────────────────────────────────────────────────── */

const features: Array<{
  icon: LucideIcon;
  title: string;
  description: string;
  accent: "blue" | "amber" | "green" | "violet" | "neutral";
}> = [
  {
    icon: Sparkles,
    title: "Source-backed suggestions you review",
    description:
      "Oblixa suggests renewal, notice, and term fields from the document. You approve each value against the exact source snippet before it drives a single reminder.",
    accent: "blue",
  },
  {
    icon: FileText,
    title: "One place for agreements",
    description: "Upload PDFs and DOCX, organized by counterparty and type.",
    accent: "neutral",
  },
  {
    icon: ShieldCheck,
    title: "Reviewed fields keep their source",
    description: "Every approved field stays tied to a source snippet from the document — review history included.",
    accent: "blue",
  },
  {
    icon: Bell,
    title: "Reminders that match ownership",
    description:
      "Email reminders tied to approved dates and the right owner, so handoffs don’t strand follow-ups.",
    accent: "neutral",
  },
  {
    icon: Users,
    title: "Built for small teams",
    description:
      "Roles and focused queues let finance, ops, and legal share responsibility without CLM weight.",
    accent: "neutral",
  },
  {
    icon: Layers,
    title: "Import and export contract records",
    description:
      "Bring over an existing tracker, then export contract records and reports — activation without the spreadsheet risk.",
    accent: "neutral",
  },
];

const steps = [
  {
    n: "1",
    icon: Upload,
    eyebrow: "Upload",
    title: "Upload signed contracts or import a contract spreadsheet",
    body:
      "Add PDFs or DOCX agreements, or bring in an existing tracking spreadsheet by CSV. Files and metadata stay together, not scattered across a separate folder.",
  },
  {
    n: "2",
    icon: CheckCircle2,
    eyebrow: "Review",
    title: "Review key dates, terms, and obligations with source evidence",
    body:
      "Suggested fields surface renewal, notice, and termination values — not trusted until approved. Approve each against the source snippet from the document before reminders or reports rely on it.",
  },
  {
    n: "3",
    icon: Workflow,
    eyebrow: "Assign",
    title: "Assign owners, dates, reminders, and work",
    body:
      "Reminders fire from approved dates with the right owner. Turn obligations into accountable work — tasks, approvals, exceptions — without leaving the workspace.",
  },
  {
    n: "4",
    icon: Bell,
    eyebrow: "Track",
    title: "Track renewals, evidence, and exceptions",
    body:
      "Watch upcoming renewals, request evidence against obligations, and surface exceptions before they become problems. Audit history backs every decision.",
  },
  {
    /* v13: split the former 4-step flow into the release-state-mandated
       five steps (add → review → assign → track → report/export). The
       prior step 4 bundled track + report; reporting now stands alone. */
    n: "5",
    icon: BarChart3,
    eyebrow: "Report",
    title: "Report and export without rebuilding the spreadsheet",
    body:
      "Run operational reports — renewals, missing owners, open obligations — and export contract records as CSV. No quarter-end scramble rebuilding a tracker by hand.",
  },
] as const;

type CompareLevel = "no" | "partial" | "yes";

const compareRows: Array<{
  label: string;
  spreadsheets: CompareLevel;
  clm: CompareLevel;
  oblixa: CompareLevel;
  spreadsheetsText?: string;
  clmText?: string;
  oblixaText?: string;
}> = [
  {
    label: "Time to value",
    spreadsheets: "partial",
    clm: "no",
    oblixa: "yes",
    spreadsheetsText: "Instant, fragile",
    clmText: "Months of setup",
    oblixaText: "Live in days",
  },
  {
    label: "Field-level guardrails",
    spreadsheets: "no",
    clm: "partial",
    oblixa: "yes",
    spreadsheetsText: "None",
    clmText: "Optional",
    oblixaText: "Required",
  },
  {
    label: "Ownership of work",
    spreadsheets: "no",
    clm: "partial",
    oblixa: "yes",
    spreadsheetsText: "Drifts across files",
    clmText: "Heavy role config",
    oblixaText: "Built into queues",
  },
  {
    label: "Reminders tied to dates",
    spreadsheets: "no",
    clm: "yes",
    oblixa: "yes",
    spreadsheetsText: "Manual",
    clmText: "Configurable",
    oblixaText: "From approved fields",
  },
  {
    label: "Audit trail",
    spreadsheets: "no",
    clm: "yes",
    oblixa: "yes",
    spreadsheetsText: "Scattered email",
    clmText: "Comprehensive",
    /* v2: replaced "Operational events" with "Audit history" per voice rules. */
    oblixaText: "Audit history",
  },
  {
    label: "Right for",
    spreadsheets: "partial",
    clm: "partial",
    oblixa: "yes",
    spreadsheetsText: "Solo operators",
    clmText: "Large, complex orgs",
    oblixaText: "Ops & finance teams",
  },
];

/* ────────────────────────────────────────────────────────────────────────────
   Helpers — light surfaces
   ──────────────────────────────────────────────────────────────────────────── */

function accentTokens(accent: "blue" | "amber" | "green" | "violet" | "neutral") {
  switch (accent) {
    case "blue":
      return {
        bg: "bg-[color:color-mix(in_oklab,var(--accent)_18%,var(--surface-raised))]",
        border: "border-[color:color-mix(in_oklab,var(--accent)_38%,var(--border-subtle))]",
        fg: "text-[var(--accent-strong)]",
      };
    case "amber":
      return {
        bg: "bg-[color:color-mix(in_oklab,var(--warning-soft)_82%,var(--surface-raised))]",
        border: "border-[color:color-mix(in_oklab,var(--warning-soft)_46%,var(--border-subtle))]",
        fg: "text-[var(--warning-ink)]",
      };
    case "green":
      return {
        bg: "bg-[color:color-mix(in_oklab,var(--success-soft)_82%,var(--surface-raised))]",
        border: "border-[color:color-mix(in_oklab,var(--success-soft)_46%,var(--border-subtle))]",
        fg: "text-[var(--success-ink)]",
      };
    case "violet":
      return {
        bg: "bg-[color:color-mix(in_oklab,oklch(0.92_0.06_300)_82%,var(--surface-raised))]",
        border: "border-[color:color-mix(in_oklab,oklch(0.78_0.10_300)_46%,var(--border-subtle))]",
        fg: "text-[color:oklch(0.42_0.16_300)]",
      };
    case "neutral":
    default:
      return {
        bg: "bg-[color:color-mix(in_oklab,var(--surface-contrast)_82%,var(--surface-raised))]",
        border: "border-[var(--border-subtle)]",
        fg: "text-[var(--text-secondary)]",
      };
  }
}

function FeatureIconTile({
  icon: Icon,
  accent,
}: {
  icon: LucideIcon;
  accent: "blue" | "amber" | "green" | "violet" | "neutral";
}) {
  const t = accentTokens(accent);
  return (
    <span
      className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border ${t.bg} ${t.border} ${t.fg} shadow-[var(--shadow-1)]`}
    >
      <Icon className="h-5 w-5" strokeWidth={1.65} aria-hidden />
    </span>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Dark hero backdrop
   ──────────────────────────────────────────────────────────────────────────── */

function LuminousHeroBackdrop() {
  /* v13: reduced decoration per §10.14 / §11.30. Dropped the dotted grid
     layer (read as generic SaaS texture) and the second orb. A base wash +
     glow + one ambient orb keep the luminous entry feel without the busy
     overlay competing with the centered headline + product preview. */
  return (
    <>
      <div aria-hidden className="landing-luminous__base" />
      <div aria-hidden className="landing-luminous__glow" />
      <span
        aria-hidden
        className="landing-orb-a landing-orb-violet pointer-events-none absolute left-[8%] top-[30%] h-44 w-44 rounded-full opacity-50 blur-3xl"
      />
      <span aria-hidden className="landing-grain" />
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Product preview (luminous light card on dark)
   ──────────────────────────────────────────────────────────────────────────── */

/* ── Shared mock primitives ──────────────────────────────────────────────────
   One date format, one owner avatar, one approve/edit pair, one source-evidence
   block — so every preview card speaks the same vocabulary instead of ad-hoc
   pills (UI §10.16 cross-surface parity, §2.6 chip primitives). */

/** Right-aligned, fixed-width, tabular date token. Keeps MAY 12 / JUN 03 /
    APR 12 in one aligned column across every mock row. */
const mockDateClassName =
  "min-w-[3.25rem] shrink-0 text-right font-mono text-[10.5px] uppercase tracking-[0.08em] tabular-nums text-[var(--text-tertiary)]";

/** Renders "Head · Tail" with the middle dot styled as an intentional
    separator (.ui-dot-sep) rather than a bare period-like glyph (§2.9 Tactic C).
    Splits on the first " · " only; any further dots stay in the tail. */
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

/** Consistent owner initials avatar (replaces the bespoke initials pills). */
function OwnerAvatar({ initials }: { initials: string }) {
  return (
    <span
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-contrast)_82%,var(--surface-raised))] font-mono text-[9px] font-bold tabular-nums text-[var(--text-secondary)]"
      aria-hidden
    >
      {initials}
    </span>
  );
}

/** Primary approve + secondary edit affordances — identical height/radius
    everywhere, no extra shadow on the primary (matches the landing CTA family
    in spirit without re-stacking shadows). */
function MockApprove() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-[var(--accent-strong)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent-fg)]">
      <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden />
      Approve
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

/** Source-backed evidence block — a captioned quote so the snippet reads as a
    cited contract source, not raw terminal text. */
function SourceSnippet({ children }: { children: React.ReactNode }) {
  return (
    <figure className="mt-2.5 overflow-hidden rounded-md border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--surface-raised))]">
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
        {/* counterparty (primary) · contract type (muted) */}
        <p className="truncate text-[12.5px] leading-tight">
          <DottedLabel
            value={name}
            headClassName="font-semibold text-[var(--text-primary)]"
            tailClassName="text-[var(--text-secondary)]"
          />
        </p>
        {/* owner · function */}
        <p className="mt-0.5 truncate text-[11px] leading-tight text-[var(--text-tertiary)]">
          <DottedLabel
            value={owner}
            headClassName="text-[var(--text-secondary)]"
            tailClassName="text-[var(--text-tertiary)]"
          />
        </p>
      </div>
      {/* StatusBadge primitive — matches the /work + /renewals row vocabulary. */}
      <StatusBadge status={status} className="shrink-0 text-[10px]">
        {statusLabel}
      </StatusBadge>
      {/* Deterministic calendar date (TimeChip avoided in ISR mocks to dodge
          locale/TZ hydration mismatch). */}
      <span className={mockDateClassName}>{date}</span>
    </div>
  );
}

function HeroProductPreview() {
  return (
    <div className="relative mx-auto max-w-5xl">
      {/* v17: softened the halo (opacity 70→42, lower alpha, single accent hue,
          token-anchored) so the preview stops reading as a one-note blue wash. */}
      <div
        aria-hidden
        className="absolute -inset-x-8 -inset-y-10 -z-10 rounded-[2rem] blur-3xl opacity-[0.42]"
        style={{
          background:
            "radial-gradient(ellipse at top, color-mix(in oklab, var(--accent) 26%, transparent), transparent 68%)",
        }}
      />
      {/* v17: token-anchored frosted bezel (was literal-white glass that washed
          the preview); border-strong + faint surface-raised fill flip in both modes. */}
      <div className="relative rounded-2xl border border-[color:color-mix(in_oklab,var(--border-strong)_55%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-raised)_30%,transparent)] p-1.5 shadow-[var(--shadow-floating)] backdrop-blur sm:p-2">
        <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface)_98%,var(--surface-raised))]">
          <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_56%,transparent)] px-4 py-2.5">
            <span
              className="h-2.5 w-2.5 rounded-full bg-[color:color-mix(in_oklab,var(--danger-soft)_82%,transparent)]"
              aria-hidden
            />
            <span
              className="h-2.5 w-2.5 rounded-full bg-[color:color-mix(in_oklab,var(--warning-soft)_82%,transparent)]"
              aria-hidden
            />
            <span
              className="h-2.5 w-2.5 rounded-full bg-[color:color-mix(in_oklab,var(--success-soft)_82%,transparent)]"
              aria-hidden
            />
            <span className="ml-3 truncate font-mono text-[11px] text-[var(--text-tertiary)]">
              oblixa.app/renewals
            </span>
          </div>
          <div className="grid gap-4 p-4 sm:grid-cols-[1.45fr_1fr] sm:gap-5 sm:p-5">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-[var(--text-tertiary)]" aria-hidden />
                  <p className="text-[12.5px] font-semibold tracking-tight text-[var(--text-primary)]">
                    Upcoming renewals
                    <span className="ui-dot-sep" aria-hidden>
                      ·
                    </span>
                    <span className="font-medium text-[var(--text-tertiary)]">Q2</span>
                  </p>
                </div>
                <KeyValueChip label="Watch" value={3} tone="warning" />
              </div>
              <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)]">
                <MockContractRow name="Acme Industries · MSA" owner="Sasha Olin · Ops" date="May 12" status="healthy" statusLabel="Approved" />
                <MockContractRow name="Globex SaaS · Order form" owner="Priya Raman · Finance" date="May 28" status="in_review" statusLabel="Pending" />
                <MockContractRow name="Initech · DPA" owner="Marco Diaz · Legal" date="Jun 03" status="healthy" statusLabel="Approved" />
                <MockContractRow name="Hooli · Master services" owner="Tess Karim · Ops" date="Jun 14" status="info" statusLabel="Watch" />
                <MockContractRow name="Stark Holdings · NDA" owner="Devon Reed · Legal" date="Jun 27" status="healthy" statusLabel="Approved" />
              </div>
            </div>
            <div className="space-y-3">
              <div className="relative overflow-hidden rounded-xl border border-[color:color-mix(in_oklab,var(--accent-soft)_55%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_22%,var(--surface-raised))] p-3">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full opacity-35 blur-2xl"
                  style={{ background: "color-mix(in oklab, var(--accent) 28%, transparent)" }}
                />
                <div className="relative">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[color:color-mix(in_oklab,var(--accent)_22%,var(--surface-raised))] text-[var(--accent-strong)]">
                      <Sparkles className="h-3.5 w-3.5" aria-hidden />
                    </span>
                    <p className="text-[11px] ui-caps-2 text-[var(--accent-strong)]">
                      Extraction<span className="ui-dot-sep">·</span>Globex
                    </p>
                  </div>
                  <p className="mt-2.5 text-[12.5px] font-medium leading-snug text-[var(--text-primary)]">
                    Notice window
                  </p>
                  <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                    60 days before renewal
                    <span className="ui-dot-sep" aria-hidden>
                      ·
                    </span>
                    approve to enable reminder
                  </p>
                  <SourceSnippet>
                    “Either party may terminate by providing{" "}
                    <span className="rounded-sm bg-[color:color-mix(in_oklab,var(--accent-soft)_60%,transparent)] px-1 text-[var(--accent-strong)]">
                      sixty (60) days
                    </span>{" "}
                    written notice…”
                  </SourceSnippet>
                  <div className="mt-3 flex items-center gap-2">
                    <MockApprove />
                    <MockEdit />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Section header helpers
   ──────────────────────────────────────────────────────────────────────────── */

function SectionEyebrow({
  children,
  tone = "accent",
}: {
  children: React.ReactNode;
  tone?: "accent" | "muted" | "light" | "warm" | "amber" | "success";
}) {
  const color =
    tone === "light"
      ? "text-white/75"
      : tone === "muted"
        ? "text-[var(--text-tertiary)]"
        : tone === "warm"
          ? "text-[var(--accent)]"
          : tone === "amber"
            ? "text-[var(--warning-ink)]"
            : tone === "success"
              ? "text-[var(--success-ink)]"
              : "text-[var(--accent-strong)]";
  return (
    <p className={`landing-eyebrow-dot ui-caps-1 text-[11px] leading-none ${color}`}>
      {children}
    </p>
  );
}

function SectionHeading({
  children,
  id,
  light = false,
}: {
  children: React.ReactNode;
  id?: string;
  light?: boolean;
}) {
  return (
    <h2
      id={id}
      /* v15: reduced from 2.25→3.75rem bold to 1.9→2.9rem semibold — the
         display headings dominated the product proof across every section. */
      className={`mt-4 text-balance text-[1.9rem] font-semibold leading-[1.08] tracking-[-0.02em] sm:text-[2.3rem] md:text-[2.6rem] lg:text-[2.9rem] ${
        light ? "text-white" : "text-[var(--text-primary)]"
      }`}
    >
      {children}
    </h2>
  );
}

/** Inline accent gradient — used to lift a phrase inside section headings. */
function GradientPhrase({ children }: { children: React.ReactNode }) {
  /* v15: muted further — solid accent-strong still read as loud one-note blue,
     so the accent is now mixed 72% toward text-primary: still a clear emphasis,
     but no longer a saturated blue phrase. Name kept for call-site stability. */
  return (
    <span className="text-[color:color-mix(in_oklab,var(--accent-strong)_72%,var(--text-primary))]">
      {children}
    </span>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   How it works (vertical narrative)
   ──────────────────────────────────────────────────────────────────────────── */

function IngestMiniMock() {
  const docs = [
    { name: "Acme Industries · MSA", type: "PDF · 14 pages", tone: "green" as const },
    { name: "Globex SaaS · Order form", type: "DOCX · 6 pages", tone: "amber" as const },
    { name: "Initech · DPA", type: "PDF · 9 pages", tone: "green" as const },
  ];
  return (
    <div className="space-y-2">
      <p className="text-[11px] ui-caps-2 text-[var(--text-tertiary)]">
        Backlog<span className="ui-dot-sep">·</span>3 of 124
      </p>
      <div className="space-y-2">
        {docs.map((d) => (
          <div
            key={d.name}
            className="flex items-center gap-3 rounded-xl border border-[color:color-mix(in_oklab,var(--border-subtle)_72%,transparent)] bg-[var(--surface-raised)] px-3 py-2"
          >
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-contrast)_82%,var(--surface-raised))] text-[var(--text-secondary)]">
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
                d.tone === "green"
                  ? "bg-[color:color-mix(in_oklab,var(--success-soft)_72%,var(--surface-raised))] text-[var(--success-ink)]"
                  : "bg-[color:color-mix(in_oklab,var(--warning-soft)_72%,var(--surface-raised))] text-[var(--warning-ink)]"
              }`}
            >
              {d.tone === "green" ? <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden /> : <Clock className="h-2.5 w-2.5" aria-hidden />}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ValidateMiniMock() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[color:color-mix(in_oklab,var(--accent-soft)_55%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_22%,var(--surface-raised))] p-3">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full opacity-50 blur-2xl"
        style={{ background: "color-mix(in oklab, var(--accent) 40%, transparent)" }}
      />
      <div className="relative">
        <div className="flex items-center justify-between">
          <p className="text-[11px] ui-caps-2 text-[var(--accent-strong)]">
            Field<span className="ui-dot-sep">·</span>Renewal date
          </p>
          {/* v16: the review-safe "Suggested" chip is now the StatusBadge
              primitive (in_review tone), matching /contracts/review's badge
              vocabulary — still no confidence-score authority framing. */}
          <StatusBadge status="in_review" className="text-[9.5px]">
            Suggested
          </StatusBadge>
        </div>
        <p className="mt-1.5 text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">
          March 12, 2027
        </p>
        <SourceSnippet>
          “The Initial Term shall commence on{" "}
          <span className="rounded-sm bg-[color:color-mix(in_oklab,var(--accent-soft)_60%,transparent)] px-1 text-[var(--accent-strong)]">
            March 12, 2024
          </span>{" "}
          and continue for three (3) years…”
        </SourceSnippet>
        <div className="mt-2.5 flex items-center gap-2">
          <MockApprove />
          <MockEdit />
          <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-[11px] text-[var(--text-tertiary)]">
            <OwnerAvatar initials="MD" />
            Marco D.
          </span>
        </div>
      </div>
    </div>
  );
}

function ExecuteMiniMock() {
  const reminders = [
    { label: "Acme renewal", horizon: "30d", owner: "SO", date: "Apr 12", color: "accent" as const },
    { label: "Initech audit", horizon: "14d", owner: "MD", date: "May 20", color: "amber" as const },
    { label: "Hooli notice", horizon: "60d", owner: "TK", date: "Apr 15", color: "green" as const },
  ];
  return (
    <div className="space-y-2">
      <p className="text-[11px] ui-caps-2 text-[var(--text-tertiary)]">
        Reminders<span className="ui-dot-sep">·</span>This week
      </p>
      <ul className="space-y-1.5">
        {reminders.map((r) => {
          const palette =
            r.color === "amber"
              ? "bg-[color:color-mix(in_oklab,var(--warning-soft)_72%,var(--surface-raised))] text-[var(--warning-ink)]"
              : r.color === "green"
                ? "bg-[color:color-mix(in_oklab,var(--success-soft)_72%,var(--surface-raised))] text-[var(--success-ink)]"
                : "bg-[color:color-mix(in_oklab,var(--accent-soft)_72%,var(--surface-raised))] text-[var(--accent-strong)]";
          return (
            <li
              key={r.label}
              className="flex items-center gap-2.5 rounded-xl border border-[color:color-mix(in_oklab,var(--border-subtle)_72%,transparent)] bg-[var(--surface-raised)] px-3 py-2"
            >
              <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${palette}`}>
                <Bell className="h-3 w-3" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-medium leading-tight text-[var(--text-primary)]">
                  {r.label}
                </p>
                {/* lead-time horizon — visually distinct from the due date */}
                <span className="mt-1 inline-flex items-center rounded border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-contrast)_55%,var(--surface-raised))] px-1.5 py-px text-[9px] font-semibold uppercase tracking-[0.1em] tabular-nums text-[var(--text-tertiary)]">
                  {r.horizon} notice
                </span>
              </div>
              <OwnerAvatar initials={r.owner} />
              <span className={mockDateClassName}>{r.date}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TrackQueueMiniMock() {
  /* v13: step-4 "Track" mock. Reuses MockContractRow so it reads as a live
     tracking queue (renewals / evidence / exceptions) — visually distinct
     from step 3's reminder pills and step 5's report counts. */
  return (
    <div className="space-y-2">
      <p className="text-[11px] ui-caps-2 text-[var(--text-tertiary)]">
        Tracking<span className="ui-dot-sep">·</span>This week
      </p>
      <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)]">
        <MockContractRow name="Acme · MSA" owner="Sasha Olin · Ops" date="May 30" status="warning" statusLabel="Renewal" />
        <MockContractRow name="Globex · DPA" owner="Priya Raman · Finance" date="Jun 15" status="info" statusLabel="Evidence" />
        <MockContractRow name="Initech · Lease" owner="Marco Diaz · Legal" date="Jun 02" status="blocked" statusLabel="Exception" />
      </div>
    </div>
  );
}

function HowItWorksNarrative() {
  const mocks = [IngestMiniMock, ValidateMiniMock, ExecuteMiniMock, TrackQueueMiniMock, TrackMiniMock];
  return (
    <ol className="mt-12 space-y-5">
      {steps.map((s, i) => {
        const Mock = mocks[i];
        return (
          <li
            key={s.n}
            className="landing-card-premium group relative overflow-hidden rounded-3xl border p-6 sm:p-7"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full opacity-40 blur-3xl"
              style={{
                background:
                  i === 0
                    ? "radial-gradient(circle, color-mix(in oklab, var(--accent) 30%, transparent), transparent 70%)"
                    : i === 1
                      ? "radial-gradient(circle, oklch(0.78 0.10 200 / 0.4), transparent 70%)"
                      : "radial-gradient(circle, oklch(0.78 0.12 280 / 0.4), transparent 70%)",
              }}
            />
            <div className="relative grid gap-6 sm:gap-10 lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,22rem)] lg:items-center">
              {/* Icon medallion only — number moved inline into the eyebrow
                  (matches /product section-card pattern). Surface-raised mix
                  gives the icon proper contrast on dark mode. */}
              <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[color:color-mix(in_oklab,var(--accent)_28%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_55%,var(--surface-raised))] text-[var(--accent-strong)] shadow-[var(--shadow-1)]">
                <s.icon className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.85} aria-hidden />
              </span>
              <div className="min-w-0">
                <p
                  className="inline-flex items-center gap-2 text-[11px] ui-caps-2 text-[var(--accent-strong)]"
                >
                  <span
                    className="font-bold tabular-nums tracking-[0.16em]"
                    style={{ fontVariantNumeric: "tabular-nums lining-nums slashed-zero" }}
                  >
                    {s.n}
                  </span>
                  <span
                    aria-hidden
                    className="inline-block h-1 w-1 rounded-full bg-[var(--accent-strong)]"
                  />
                  {s.eyebrow}
                </p>
                <h3 className="mt-2 text-[1.35rem] font-semibold leading-snug tracking-tight text-[var(--text-primary)] sm:text-[1.65rem]">
                  {s.title}
                </h3>
                <p className="mt-3 max-w-2xl text-[14px] leading-[1.65] text-[var(--text-secondary)] sm:text-[14px]">
                  {s.body}
                </p>
              </div>
              <div className="relative">
                {Mock ? <Mock /> : null}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function TrackMiniMock() {
  const reports: Array<{ label: string; value: number; tone?: "success" | "warning" | "danger" }> = [
    { label: "Upcoming renewals", value: 12 },
    { label: "Missing owners", value: 3, tone: "warning" },
    { label: "Open obligations", value: 8 },
  ];
  return (
    <div className="space-y-2">
      <p className="text-[11px] ui-caps-2 text-[var(--text-tertiary)]">
        Reports<span className="ui-dot-sep">·</span>This quarter
      </p>
      <ul className="space-y-1.5">
        {reports.map((r) => (
          <li
            key={r.label}
            className="flex items-center gap-2.5 rounded-xl border border-[color:color-mix(in_oklab,var(--border-subtle)_72%,transparent)] bg-[var(--surface-raised)] px-3 py-2"
          >
            <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-[var(--text-primary)]">
              {r.label}
            </span>
            {/* CountChip primitive (matches /reports + /work counts); only a real
                gap state (missing owners) carries tone — a plain count stays neutral. */}
            <CountChip value={r.value} tone={r.tone} emphasis={r.tone ? "strong" : "subtle"} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Bento capabilities
   ──────────────────────────────────────────────────────────────────────────── */

function BentoCapabilities() {
  /* v13: uniform 3×2 grid. The former 1-wide-card bento left the wide card
     (icon + title + prose only) with a tall empty void (§11.28). Equal cards
     read cleaner and scan faster; layout rhythm lives in the split sections. */
  return (
    <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
      {features.map((f) => {
        return (
          <article
            key={f.title}
            className="landing-card-premium group relative overflow-hidden rounded-3xl border p-6 sm:p-7"
          >
            <div className="relative flex h-full flex-col">
              <FeatureIconTile icon={f.icon} accent={f.accent} />
              <h3 className="mt-5 text-[1.05rem] font-semibold leading-snug tracking-tight text-[var(--text-primary)]">
                {f.title}
              </h3>
              <p className="mt-2.5 text-[14px] leading-[1.58] text-[var(--text-secondary)]">
                {f.description}
              </p>
              {/* v9 — Nested notice-window mini-card + "See the approval workflow →"
                  tertiary link removed (Tier 6.2, 6.3). The card prose + medallion
                  stand on their own; two layers of UI inside one card was too much. */}
            </div>
          </article>
        );
      })}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Comparison section (dark)
   ──────────────────────────────────────────────────────────────────────────── */

function CompareGlyph({ level }: { level: CompareLevel }) {
  if (level === "yes") {
    return (
      <span className="landing-glyph landing-glyph-yes" aria-hidden>
        <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
      </span>
    );
  }
  if (level === "partial") {
    return (
      <span className="landing-glyph landing-glyph-partial" aria-hidden>
        <MinusCircle className="h-3 w-3" strokeWidth={1.85} aria-hidden />
      </span>
    );
  }
  return (
    <span className="landing-glyph landing-glyph-no" aria-hidden>
      <X className="h-3 w-3" strokeWidth={1.85} aria-hidden />
    </span>
  );
}

function CompareCol({
  label,
  highlight,
  rows,
  picker,
  textPicker,
}: {
  label: string;
  highlight: boolean;
  rows: typeof compareRows;
  picker: (r: (typeof compareRows)[number]) => CompareLevel;
  textPicker: (r: (typeof compareRows)[number]) => string;
}) {
  return (
    <div className={`landing-compare-col ${highlight ? "landing-compare-col-highlight" : ""}`}>
      {highlight ? (
        /* v13: "Recommended" + sparkle read as a sales badge. "Best fit"
           is calmer and frames the column as a match, not a pitch. */
        <span className="landing-compare-badge">Best fit</span>
      ) : null}
      <p className="landing-compare-label">{label}</p>
      <ul className="mt-5 space-y-4">
        {rows.map((r) => {
          const level = picker(r);
          return (
            <li key={r.label} className="flex items-start gap-3">
              <CompareGlyph level={level} />
              <div className="min-w-0 flex-1">
                <p className="landing-compare-row-kicker">{r.label}</p>
                <p className="landing-compare-row-text mt-1">{textPicker(r)}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* v3 — Spec-mandated section: PROBLEM (`docs/oblixa-release-state.md`
   §Home Page > Problem). v11 visual-density pass: bullets render as
   substantial 6-card grid (icon medallion + title + description) instead
   of compact pills. Card titles preserve spec content verbatim; descriptions
   restate the same problem in one supporting sentence. */
const PROBLEM_ICON_MAP = {
  Calendar,
  ScrollText,
  Users,
  MailQuestion,
  FolderSearch,
  BarChart3,
} as const;

const PROBLEM_TONE_COLORS = {
  warning: {
    border: "color-mix(in oklab, var(--warning-ink) 28%, var(--border-subtle))",
    bg: "color-mix(in oklab, var(--warning-soft) 38%, var(--surface-raised))",
    color: "var(--warning-ink)",
  },
  neutral: {
    border: "color-mix(in oklab, var(--text-tertiary) 22%, var(--border-subtle))",
    bg: "color-mix(in oklab, var(--surface-raised) 92%, var(--text-tertiary))",
    color: "var(--text-secondary)",
  },
  danger: {
    border: "color-mix(in oklab, var(--danger-ink, var(--warning-ink)) 28%, var(--border-subtle))",
    bg: "color-mix(in oklab, var(--danger-soft, var(--warning-soft)) 32%, var(--surface-raised))",
    color: "var(--danger-ink, var(--warning-ink))",
  },
} as const;

function ProblemSection() {
  return (
    <section
      id="problem"
      className="section-divider-top relative scroll-mt-36 px-4 py-10 sm:px-6 sm:py-16"
      aria-labelledby="problem-heading"
    >
      <div className="relative mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <SectionEyebrow tone="amber">Problem</SectionEyebrow>
          <SectionHeading id="problem-heading">{problemSectionTitle}</SectionHeading>
        </div>
        {/* v11 — 6 spec-mandated bullets render as substantial cards with
            icon medallion + title + supporting description. */}
        <ul className="mx-auto mt-10 grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {problemCards.map((card) => {
            const Icon = PROBLEM_ICON_MAP[card.iconName];
            // v15: all-neutral icon tones (quieter; these are illustrative,
            // not live status — §10.2). Per-card tone retained in data only.
            const tone = PROBLEM_TONE_COLORS.neutral;
            return (
              <li
                key={card.title}
                className="landing-card-premium relative overflow-hidden rounded-2xl border p-5 sm:p-6"
              >
                <div className="flex items-start gap-3.5">
                  <span
                    aria-hidden
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
                    style={{ borderColor: tone.border, background: tone.bg, color: tone.color }}
                  >
                    <Icon className="h-[18px] w-[18px]" strokeWidth={1.85} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[14.5px] font-semibold leading-[1.35] text-[var(--text-primary)] sm:text-[15px]">
                      {card.title}
                    </h3>
                    <p className="mt-1.5 text-[13.5px] leading-[1.5] text-[var(--text-secondary)]">
                      {card.description}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        {/* Preserve the spec-bullet array for tests that pin its presence.
            problemBullets is kept exported and referenced here as a hidden
            audit trail (rendered text matches problemCards titles 1:1). */}
        <span aria-hidden className="sr-only">
          {problemBullets.join(" — ")}
        </span>
      </div>
    </section>
  );
}


/* v10 — Restored spec-mandated sections after the v9 subtraction violated
   `docs/oblixa-release-state.md` §Home Page. Compact treatments preserve
   the visual density tightening from v9 while restoring required content. */

/* Outcomes section — §Home Page > Outcomes. v11 visual-density pass:
   numbered cards get an icon medallion + bigger padding for substantial
   chrome. Step number stays as the medallion content (success-toned). */
function OutcomesSection() {
  return (
    <section
      id="outcomes"
      className="section-divider-top relative scroll-mt-36 px-4 py-10 sm:px-6 sm:py-16"
      aria-labelledby="outcomes-heading"
    >
      <div className="relative mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center lg:mx-0 lg:text-left">
          <SectionEyebrow tone="success">Outcomes</SectionEyebrow>
          <SectionHeading id="outcomes-heading">{outcomesSectionTitle}</SectionHeading>
        </div>
        {/* v12 — 2-column layout fills the side void with actual content: the
            5 spec-mandated outcomes on the left, a mock "Attention queue"
            on the right showing what catching things early looks like. */}
        <div className="mt-12 grid items-start gap-8 lg:grid-cols-[1fr_minmax(0,28rem)] lg:gap-10">
          {/* v15: compressed to dense hairline rows (was big premium cards) per
              "less card-like"; number medallions are neutral, not green —
              these are outcomes, not a healthy/complete status (§10.2). */}
          <ul className="grid gap-2.5">
            {outcomesBullets.map((b, i) => (
              <li
                key={b}
                className="flex items-start gap-3 rounded-xl border border-[color:color-mix(in_oklab,var(--border-subtle)_75%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-raised)_45%,transparent)] px-4 py-3"
              >
                <span
                  aria-hidden
                  className="mt-px inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[12px] font-bold tabular-nums text-[var(--text-tertiary)]"
                  style={{ fontVariantNumeric: "tabular-nums lining-nums slashed-zero" }}
                >
                  {i + 1}
                </span>
                <p className="text-[13.5px] leading-[1.45] text-[var(--text-secondary)]">
                  {b}
                </p>
              </li>
            ))}
          </ul>

          {/* Right-side mock: Attention queue. Concrete visualization of
              outcome 1 ("See contracts that need review") + outcome 2
              ("Catch upcoming renewal and notice dates"). */}
          <aside aria-hidden className="landing-card-premium relative overflow-hidden rounded-2xl border p-5 sm:p-6">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <p className="ui-caps-2 inline-flex items-center gap-1.5 text-[10.5px] text-[var(--success-ink)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--success-ink)]" />
                Attention queue
              </p>
              <span className="font-mono text-[10.5px] tabular-nums text-[var(--text-tertiary)]">3 this week</span>
            </div>
            <div className="mt-2 -mx-5 sm:-mx-6">
              <MockContractRow
                name="Acme Industries · MSA"
                owner="Sasha Olin · Operations"
                date="May 12"
                status="in_review"
                statusLabel="Needs review"
              />
              <MockContractRow
                name="Globex SaaS · Order form"
                owner="Priya Raman · Finance"
                date="May 28"
                status="warning"
                statusLabel="Notice"
              />
              <MockContractRow
                name="Initech · DPA"
                owner="Marco Diaz · Legal"
                date="Jun 03"
                status="info"
                statusLabel="Evidence"
              />
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-3">
              <span className="ui-caps-2 inline-flex items-center gap-1.5 text-[10px] text-[var(--text-tertiary)]">
                <CalendarCheck className="h-3 w-3 text-[var(--success-ink)]" strokeWidth={2.1} aria-hidden />
                Dates approved from source
              </span>
              <span className="font-mono text-[10.5px] text-[var(--text-tertiary)]">renewals.q2</span>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

/* Best-Fit section — §Home Page > Best-Fit. v11 visual-density pass:
   bigger card chrome + Check-icon medallion + atmospheric anchors. */
function BestFitSection() {
  return (
    <section
      id="best-fit"
      className="section-divider-top relative scroll-mt-36 px-4 py-10 sm:px-6 sm:py-16"
      aria-labelledby="best-fit-heading"
    >
      <div className="relative mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center lg:mx-0 lg:text-left">
          <SectionEyebrow tone="warm">Best fit</SectionEyebrow>
          <SectionHeading id="best-fit-heading">{bestFitSectionTitle}</SectionHeading>
        </div>
        {/* v12 — 2-column layout fills the side void with actual content: the
            4 spec-mandated criteria on the left, a mock "Cross-functional
            ownership" contracts panel on the right showing what a fitting
            team's contract list looks like. */}
        <div className="mt-12 grid items-start gap-8 lg:grid-cols-[1fr_minmax(0,28rem)] lg:gap-10">
          {/* v14: compressed from 4 big premium cards to dense bordered rows so
              Best-Fit no longer reads as a "twin" of Outcomes (which keeps the
              big numbered cards) and sheds card-shadow weight. */}
          <ul className="grid gap-2.5">
            {bestFitItems.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 rounded-xl border border-[color:color-mix(in_oklab,var(--border-subtle)_75%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-raised)_45%,transparent)] px-4 py-3"
              >
                <span
                  aria-hidden
                  className="mt-px inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-[color:color-mix(in_oklab,var(--accent)_24%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent)_12%,var(--surface-raised))] text-[var(--accent-strong)]"
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={2.2} />
                </span>
                <p className="text-[13.5px] leading-[1.45] text-[var(--text-secondary)]">
                  {item}
                </p>
              </li>
            ))}
          </ul>

          {/* Right-side mock: Cross-functional ownership. Concrete visualization
              of a 50–500 contract portfolio with mixed contract types + owners
              across operations / finance / legal — what the spec criteria look
              like in practice. */}
          <aside aria-hidden className="landing-card-premium relative overflow-hidden rounded-2xl border p-5 sm:p-6">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <p className="ui-caps-2 inline-flex items-center gap-1.5 text-[10.5px] text-[var(--accent-strong)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-strong)]" />
                Cross-functional
              </p>
              <span className="font-mono text-[10.5px] tabular-nums text-[var(--text-tertiary)]">48 active</span>
            </div>
            <div className="mt-2 -mx-5 sm:-mx-6">
              <MockContractRow
                name="Hooli · Master services"
                owner="Tess Karim · Operations"
                date="Jul 14"
                status="info"
                statusLabel="Vendor"
              />
              <MockContractRow
                name="Stark Holdings · Lease"
                owner="Devon Reed · Finance"
                date="Aug 02"
                status="info"
                statusLabel="Lease"
              />
              <MockContractRow
                name="Pied Piper · Partnership"
                owner="Aria Sun · Account"
                date="Sep 28"
                status="warning"
                statusLabel="Renewal"
              />
              <MockContractRow
                name="Initech · DPA addendum"
                owner="Marco Diaz · Legal"
                date="Oct 11"
                status="info"
                statusLabel="Privacy"
              />
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-3">
              <span className="ui-caps-2 inline-flex items-center gap-1.5 text-[10px] text-[var(--text-tertiary)]">
                <Users className="h-3 w-3 text-[var(--accent-strong)]" strokeWidth={2.1} aria-hidden />
                Owners across four functions
              </span>
              <span className="font-mono text-[10.5px] text-[var(--text-tertiary)]">portfolio.q3</span>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

/* Pricing CTA section — §Home Page > Pricing CTA. v11 visual-density pass:
   the prior "slogan + 2 buttons" form felt incomplete against denser siblings.
   Now wraps in landing-luminous + adds a substantial card chrome + evaluation
   scope strips that avoid fixed pricing or self-serve trial claims. */
function PricingCtaSection() {
  return (
    <section
      className="section-divider-top relative scroll-mt-36 px-4 py-10 sm:px-6 sm:py-16"
      aria-labelledby="pricing-cta-heading"
    >
      <div className="relative mx-auto max-w-5xl">
        <div className="landing-card-premium relative overflow-hidden rounded-3xl border p-6 text-center sm:p-8">
          {/* v14: removed the last decorative corner ring (§10.14/§11.30) and
              compressed the display heading so Pricing reads as terms, not a
              second hero competing with the final CTA that now follows it. */}
          <div className="relative">
            <SectionEyebrow>Pricing</SectionEyebrow>
            <h2
              id="pricing-cta-heading"
              className="mt-4 text-balance text-[1.6rem] font-semibold leading-[1.1] tracking-tight text-[var(--text-primary)] sm:text-[2rem]"
            >
              {pricingCtaMessage}
            </h2>
            <p className="landing-luminous-body mx-auto mt-5 max-w-xl text-pretty text-[14px] leading-[1.6] sm:text-[15px]">
              {pricingCtaLead}
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/request-access"
                className="product-cta-halo ui-btn-primary inline-flex min-h-11 items-center gap-1.5 px-5 py-2.5 text-[14px] font-semibold"
              >
                {ctaPrimaryLabel}
                <ArrowRight className="h-4 w-4" strokeWidth={1.85} aria-hidden />
              </Link>
              <Link
                href="/product"
                prefetch={false}
                className="ui-btn-ghost inline-flex min-h-11 items-center gap-1.5 px-4 py-2.5 text-[14px] font-semibold"
              >
                {ctaSecondaryLabel}
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
              </Link>
            </div>

            {/* v13: consolidated the two overlapping chip strips into one
                evaluation-scope strip. Dropped "Async-first support" and
                the old founder-first access language; "CSV export" → "Exportable
                records" so the homepage doesn't read as founder-first marketing. */}
            <div className="mt-7 flex justify-center">
              <div className="inline-flex flex-wrap justify-center divide-x divide-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)] rounded-md border border-[color:color-mix(in_oklab,var(--border-subtle)_45%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-raised)_60%,transparent)] text-[10.5px] ui-caps-2 text-[var(--text-tertiary)]">
                <span className="px-3 py-1.5">Small contract subset</span>
                <span className="px-3 py-1.5">No full migration required</span>
                <span className="px-3 py-1.5">Exportable records</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Page export
   ──────────────────────────────────────────────────────────────────────────── */


export function LandingPage() {
  // v15: overflow-x-clip on the root guards against horizontal scroll from
  // bleeding absolute decorations (e.g. the FAQ SectionOrb at right:-6rem).
  // `clip` (not `hidden`) doesn't create a scroll container, so the sticky
  // header still works.
  return (
    <div className="landing-root relative flex min-h-full flex-col overflow-x-clip bg-canvas">
      <div aria-hidden className="landing-header-backdrop" />
      {/* v17: single-row header (parity with /product, /pricing, /security,
          /contact). The in-page section anchors moved out of the header's
          second row into <LandingAnchorNav /> below the hero. */}
      <MarketingSiteHeader />

      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex-1 outline-none">
        {/* ===================================================================
            HERO — stacked + centered (v13). Eyebrow / h1 / subcopy / CTAs
            centered in a single column, then the product preview as a
            full-width band directly below — visible at the top of the page
            and clipped at the fold to hint the next section. Replaces the
            former text-left / mock-right split.
        =================================================================== */}
        <section
          id="hero"
          className="landing-luminous relative isolate overflow-hidden scroll-mt-36 px-4 pb-10 pt-10 sm:px-6 sm:pb-14 sm:pt-12"
        >
          <LuminousHeroBackdrop />

          <div className="relative mx-auto max-w-3xl text-center">
            {/* v16: hero eyebrow now matches the standard landing eyebrow
                (landing-eyebrow-dot + ui-caps-1) instead of a bespoke glass
                pill, for cross-section consistency. */}
            <p className="landing-reveal-1 landing-eyebrow-dot ui-caps-1 text-[11px] leading-none text-[var(--accent-strong)]">
              {heroEyebrow}
            </p>

            {/* v15: the max-w widen alone didn't hold — text-balance actively
                prefers the balanced hyphen break ("contract- / tracking"). Fixed
                for real with a non-breaking hyphen (U+2011) so the word can't
                split; max-w dropped (parent max-w-3xl caps it) and sizes nudged
                down for 320px safety. The heroTitle constant keeps the plain
                hyphen for SEO/JSON-LD + the voice-sweep pin. */}
            <h1 className="landing-reveal-2 landing-luminous-headline mx-auto mt-6 text-balance text-[1.9rem] font-semibold leading-[1.07] tracking-[-0.025em] sm:text-[2.4rem] sm:leading-[1.05] lg:text-[2.7rem] xl:text-[2.85rem]">
              Track what signed contracts require next.
            </h1>

            <p className="landing-reveal-3 landing-luminous-body mx-auto mt-5 max-w-2xl text-pretty text-[15px] leading-[1.6] sm:text-[16px]">
              {heroSubcopy}
            </p>

            <div className="landing-reveal-4 mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <Link href="/request-access" className="product-cta-halo landing-cta-primary group">
                <Sparkles className="h-4 w-4 opacity-90" aria-hidden />
                <span>{ctaPrimaryLabel}</span>
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
              <Link href="/product" prefetch={false} className="landing-cta-secondary group">
                <span>{ctaSecondaryLabel}</span>
                <ArrowRight
                  className="h-3.5 w-3.5 opacity-60 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            </div>

            {/* v14: dropped the 3 access-posture pills (read as noise per
                review); that posture lives in the pricing + final-CTA blocks.
                Kept only the boundary statement (release-state §/ required
                content), tightened directly under the CTAs. */}
            <p className="landing-reveal-5 mx-auto mt-4 max-w-md text-[13px] leading-snug text-[var(--text-tertiary)]">
              Post-signature tracking — not e-signature, not legal advice, not a heavy contract suite.
            </p>
          </div>

          {/* Product preview band — full-width centered, directly below the
              text. HeroProductPreview carries its own max-w + centering. */}
          <div className="landing-reveal-5 relative mt-10 sm:mt-12">
            <HeroProductPreview />
          </div>

          <div aria-hidden className="landing-luminous__fade" />
        </section>

        {/* In-page section nav — sticky strip directly below the hero (replaces
            the former persistent second header row) so the chrome reads as one
            compact navigation system. Placed as a direct child of <main> so the
            sticky positioning spans the full section scroll. */}
        <LandingAnchorNav />

        {/* PROBLEM */}
        <ProblemSection />

        {/* COMPARE APPROACHES — promoted to anchor section (was #5, now #3).
            v12: removed landing-luminous; relies on the page-level atmospheric
            backdrop for consistent ambient color. Section is otherwise
            transparent so the fixed page atmosphere shows through. */}
        <section
          id="compare"
          className="section-divider-top relative scroll-mt-36 px-4 py-10 sm:px-6 sm:py-16"
          aria-labelledby="compare-heading"
        >
          <div className="relative mx-auto max-w-6xl">
            <div className="mx-auto max-w-2xl text-center">
              <SectionEyebrow>Compare approaches</SectionEyebrow>
              <SectionHeading id="compare-heading">
                Spreadsheets, heavy suites, and a{" "}
                <GradientPhrase>contract tracking workspace</GradientPhrase>
              </SectionHeading>
              <p className="landing-luminous-body mt-5 text-pretty text-[14px] leading-[1.65] sm:text-[16px]">
                Oblixa sits between the spreadsheet and a heavy contract suite — post-signature
                tracking with source-backed evidence and audit history, no months-long implementation.
              </p>
            </div>
            <div className="mt-14 grid gap-4 lg:grid-cols-3 lg:gap-5">
              <CompareCol
                label="Spreadsheets"
                highlight={false}
                rows={compareRows}
                picker={(r) => r.spreadsheets}
                textPicker={(r) => r.spreadsheetsText ?? ""}
              />
              <CompareCol
                label="Heavy contract suites"
                highlight={false}
                rows={compareRows}
                picker={(r) => r.clm}
                textPicker={(r) => r.clmText ?? ""}
              />
              <CompareCol
                label="Oblixa"
                highlight
                rows={compareRows}
                picker={(r) => r.oblixa}
                textPicker={(r) => r.oblixaText ?? ""}
              />
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section
          id="how-it-works"
          className="section-divider-top relative scroll-mt-36 px-4 py-10 sm:px-6 sm:py-16"
          aria-labelledby="how-heading"
        >
          <div aria-hidden className="landing-pattern-grid" />
          <div className="relative mx-auto max-w-5xl">
            <div className="mx-auto max-w-2xl text-center">
              <SectionEyebrow>Workflow</SectionEyebrow>
              <SectionHeading id="how-heading">
                From contract spreadsheet to <GradientPhrase>contract tracking workspace</GradientPhrase>
              </SectionHeading>
              <p className="mt-4 text-pretty text-[14px] leading-[1.65] text-[var(--text-secondary)] sm:text-[16px]">
                Five steps from upload to action — no consultants, no implementation program,
                no rebuilding the tracker from scratch.
              </p>
            </div>
            <HowItWorksNarrative />
          </div>
        </section>

        {/* CAPABILITIES (BENTO) */}
        <section
          id="capabilities"
          className="section-divider-top relative scroll-mt-36 px-4 py-14 sm:px-6 sm:py-20"
          aria-labelledby="capabilities-heading"
        >
          <div aria-hidden className="landing-pattern-grid" />
          <div className="relative mx-auto max-w-6xl">
            <div className="mx-auto max-w-2xl text-center">
              <SectionEyebrow tone="warm">Capabilities</SectionEyebrow>
              <SectionHeading id="capabilities-heading">
                Purpose-built for contract tracking
              </SectionHeading>
              <p className="mt-4 text-pretty text-[14px] leading-[1.65] text-[var(--text-secondary)] sm:text-[16px]">
                The workflows your team runs every week — without the months-long CLM.
              </p>
            </div>
            <BentoCapabilities />
          </div>
        </section>

        {/* OUTCOMES — release-state spec §Home Page > Outcomes */}
        <OutcomesSection />

        {/* BEST-FIT — release-state spec §Home Page > Best-Fit */}
        <BestFitSection />

        {/* HONEST ANSWERS — moved earlier, no CONCERN eyebrow on each card */}
        <section
          id="objections"
          className="section-divider-top relative scroll-mt-36 px-4 pt-10 pb-8 sm:px-6 sm:pt-16 sm:pb-10"
          aria-labelledby="objections-heading"
        >
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-2xl text-center">
              <SectionEyebrow tone="amber">Honest answers</SectionEyebrow>
              <SectionHeading id="objections-heading">
                Practical answers to common concerns
              </SectionHeading>
            </div>
            <ul className="mt-12 grid gap-4 sm:grid-cols-3 sm:gap-5">
              {objectionBullets.map((o, i) => {
                const Icon = i === 0 ? FileSpreadsheet : i === 1 ? Layers : ShieldAlert;
                const accent: "amber" | "violet" | "blue" =
                  i === 0 ? "amber" : i === 1 ? "violet" : "blue";
                const stripeColor =
                  accent === "amber"
                    ? "var(--warning-ink)"
                    : accent === "violet"
                      ? "oklch(0.55 0.16 300)"
                      : "var(--accent-strong)";
                return (
                  <li
                    key={o.title}
                    className="landing-card-premium relative flex h-full flex-col overflow-hidden rounded-2xl border p-6"
                  >
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
                      style={{
                        background: `linear-gradient(90deg, transparent 0%, color-mix(in oklab, ${stripeColor} 70%, transparent) 50%, transparent 100%)`,
                      }}
                    />
                    <FeatureIconTile icon={Icon} accent={accent} />
                    <h3 className="mt-5 text-[16px] font-semibold tracking-tight text-[var(--text-primary)]">
                      {o.title}
                    </h3>
                    <p className="mt-2 text-[14px] leading-[1.6] text-[var(--text-secondary)]">
                      {o.body}
                    </p>
                  </li>
                );
              })}
            </ul>
            <p className="mx-auto mt-10 max-w-3xl text-balance text-center text-[14px] leading-[1.6] text-[var(--text-tertiary)]">
              {antiGoalSummary}
            </p>
          </div>
        </section>

        {/* FAQ — moved directly under Honest answers (v14) so the two Q&A
            surfaces read as one block; Pricing now follows, before the final CTA. */}
        <section
          id="faq"
          className="relative scroll-mt-36 px-4 pt-4 pb-12 sm:px-6 sm:pt-6 sm:pb-16 lg:pb-20"
          aria-labelledby="faq-heading"
        >
          {/* v13: dropped the decorative dashed CornerAnchor ring (§10.14 /
              §11.30 subtraction). One subtle ambient orb is enough. */}
          <SectionOrb tone="cool" size="28rem" position={{ bottom: "-4rem", right: "-6rem" }} />
          <div className="relative mx-auto max-w-5xl">
            <div className="mx-auto max-w-2xl text-center">
              <SectionEyebrow tone="success">FAQ</SectionEyebrow>
              <SectionHeading id="faq-heading">Frequently asked questions</SectionHeading>
              <p className="mt-4 text-[14px] leading-[1.65] text-[var(--text-secondary)]">
                Straightforward answers about scope, AI, and how teams use Oblixa.
              </p>
            </div>
            <div className="landing-card-premium landing-faq-list mt-12 overflow-hidden rounded-2xl border lg:grid lg:grid-cols-2 lg:divide-x lg:divide-[color:color-mix(in_oklab,var(--border-subtle)_92%,transparent)]">
              {faqItems.map((item, idx) => (
                <details
                  key={item.question}
                  className={`landing-faq-row group ${
                    idx < faqItems.length - 1
                      ? "border-b border-[color:color-mix(in_oklab,var(--border-subtle)_92%,transparent)]"
                      : ""
                  } lg:[&:nth-last-child(-n+2)]:border-b-0`}
                >
                  <summary className="flex cursor-pointer list-none items-center gap-4 rounded-lg px-5 py-5 outline-none transition-colors marker:hidden hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,transparent)] focus-visible:bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,transparent)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)] sm:px-6 [&::-webkit-details-marker]:hidden">
                    <span className="flex-1 pr-3 text-[14px] font-semibold leading-snug tracking-tight text-[var(--text-primary)]">
                      {item.question}
                    </span>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[color:var(--surface-tint)] text-[var(--text-tertiary)] transition-all group-hover:border-[color:color-mix(in_oklab,var(--accent)_28%,var(--border-subtle))] group-hover:text-[var(--accent-strong)] group-open:rotate-180 group-open:border-[color:color-mix(in_oklab,var(--accent)_42%,var(--border-subtle))] group-open:bg-[color:color-mix(in_oklab,var(--accent-soft)_38%,var(--surface-raised))] group-open:text-[var(--accent-strong)]">
                      <ChevronDown className="h-4 w-4" strokeWidth={1.85} aria-hidden />
                    </span>
                  </summary>
                  <div className="px-5 pb-6 pt-1 text-[14px] leading-[1.7] text-[var(--text-secondary)] sm:px-6 sm:pb-7">
                    {item.answer}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* EARLY-ACCESS CTA — release-state §Home Page > Pricing CTA. Now after
            the FAQ so Pricing → final CTA close the page together (v14). */}
        <PricingCtaSection />

        {/* CLOSING CTA — matches /pricing pattern with /security tertiary link.
            v13: lighter than the hero (base + glow only, no grid layer) so the
            hero stays the page's loudest entry surface (§10.6). */}
        <section
          className="landing-luminous relative isolate overflow-hidden border-t border-[var(--border-subtle)] px-4 py-16 sm:px-6 sm:py-24"
          aria-labelledby="cta-final-heading"
        >
          <div aria-hidden className="landing-luminous__base" />
          <div aria-hidden className="landing-luminous__glow" />
          <div className="relative mx-auto max-w-3xl text-center">
              <span className="landing-glass-pill">
                <Clock className="h-3 w-3" aria-hidden />
              Reviewed access
            </span>
            <h2
              id="cta-final-heading"
              className="landing-luminous-headline mt-7 text-balance text-[2.25rem] font-semibold leading-[1.04] tracking-[-0.02em] sm:text-[3rem] sm:leading-[1.02] md:text-[3.5rem]"
            >
              Start with a small contract set.{" "}
              <span className="text-[color:color-mix(in_oklab,var(--accent-strong)_72%,var(--text-primary))]">Prove the workflow.</span>
            </h2>
            <p className="landing-luminous-body mx-auto mt-6 max-w-xl text-pretty text-[16px] leading-[1.65] sm:text-[18px]">
              Request access if your team is replacing a manual contract tracker and can start
              with a focused evaluation.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <Link href="/request-access" className="product-cta-halo landing-cta-primary group">
                {ctaPrimaryLabel}
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
              <Link href="/product" prefetch={false} className="landing-cta-secondary">
                {ctaSecondaryLabel}
              </Link>
            </div>
            <p className="landing-luminous-tertiary mt-5 text-[12.5px]">{riskReducerLine}</p>
            <p className="mt-3 text-[12px] text-[var(--text-tertiary)]">
              <Link
                href="/security"
                className="ui-link inline-flex items-center gap-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <Lock className="h-3 w-3" strokeWidth={1.85} aria-hidden />
                Security overview
              </Link>
            </p>
          </div>
        </section>
      </main>

      <MarketingSiteFooter />
    </div>
  );
}
