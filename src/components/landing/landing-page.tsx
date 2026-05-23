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
  PenLine,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
  Workflow,
  X,
  Zap,
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
  pricingCtaMessage,
  problemBullets,
  problemCards,
  problemSectionTitle,
  riskReducerLine,
  faqItems,
} from "@/components/landing/landing-content";
import { CornerAnchor } from "@/components/ui/corner-anchor";
import { SectionLocator } from "@/components/ui/section-locator";
import { SectionOrb } from "@/components/ui/section-orb";
import { MarketingSiteFooter, MarketingSiteHeader } from "@/components/landing/marketing-site-chrome";
import { MAIN_CONTENT_ID } from "@/lib/qa/test-ids";

/* ────────────────────────────────────────────────────────────────────────────
   Data
   ──────────────────────────────────────────────────────────────────────────── */

const features: Array<{
  icon: LucideIcon;
  title: string;
  description: string;
  span?: "wide";
  accent: "blue" | "amber" | "green" | "violet" | "neutral";
}> = [
  {
    icon: Sparkles,
    title: "AI extraction you approve",
    description:
      "Pull renewal, notice, and term fields from the document, then approve each value with the exact source snippet before it drives a single reminder.",
    span: "wide",
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
    title: "Source-backed fields you can trust",
    description: "Every approved field stays tied to a source snippet from the document — review history included.",
    accent: "green",
  },
  {
    icon: Bell,
    title: "Reminders that match ownership",
    description:
      "Email reminders tied to approved dates and the right owner, so handoffs don’t strand follow-ups.",
    accent: "amber",
  },
  {
    icon: Users,
    title: "Built for small teams",
    description:
      "Roles and focused queues let finance, ops, and legal share responsibility without CLM weight.",
    accent: "violet",
  },
  {
    icon: Layers,
    title: "Export and bulk import",
    description:
      "CSV export for reporting; bulk import when clearing a backlog—activation without the spreadsheet risk.",
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
      "Add PDFs or DOCX agreements, or bring in an existing tracking spreadsheet by CSV. Files and metadata stay together — no separate folder graveyard.",
  },
  {
    n: "2",
    icon: CheckCircle2,
    eyebrow: "Review",
    title: "Review key dates, terms, and obligations with source evidence",
    body:
      "Suggested extraction surfaces renewal, notice, and termination values. Approve each field against the source snippet from the document before reminders or reports rely on it.",
  },
  {
    n: "3",
    icon: Workflow,
    eyebrow: "Assign",
    title: "Assign owners, reminders, approvals, and work",
    body:
      "Reminders fire from approved dates with the right owner. Turn obligations into accountable work — tasks, approvals, exceptions — without leaving the workspace.",
  },
  {
    n: "4",
    icon: Bell,
    eyebrow: "Track",
    title: "Track renewals, evidence, exceptions, and reports",
    body:
      "Watch upcoming renewals, request evidence, surface exceptions, and export reports without rebuilding the spreadsheet. Audit history backs every decision.",
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
    clmText: "Large legal teams",
    oblixaText: "Ops & finance teams",
  },
];

/* ────────────────────────────────────────────────────────────────────────────
   Nav
   ──────────────────────────────────────────────────────────────────────────── */

const landingSectionNavClassName =
  "inline-flex min-h-9 items-center rounded-full px-2.5 py-1.5 text-sm font-medium text-[var(--text-secondary)] no-underline transition-colors first:pl-0 hover:bg-[color:color-mix(in_oklab,var(--surface-contrast)_66%,transparent)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--canvas)] sm:min-h-10 sm:px-3";

/* ────────────────────────────────────────────────────────────────────────────
   Helpers — light surfaces
   ──────────────────────────────────────────────────────────────────────────── */

function accentTokens(accent: "blue" | "amber" | "green" | "violet" | "neutral") {
  switch (accent) {
    case "blue":
      return {
        bg: "bg-[color:color-mix(in_oklab,var(--accent)_18%,white)]",
        border: "border-[color:color-mix(in_oklab,var(--accent)_38%,var(--border-subtle))]",
        fg: "text-[var(--accent-strong)]",
      };
    case "amber":
      return {
        bg: "bg-[color:color-mix(in_oklab,var(--warning-soft)_82%,white)]",
        border: "border-[color:color-mix(in_oklab,var(--warning-soft)_46%,var(--border-subtle))]",
        fg: "text-[var(--warning-ink)]",
      };
    case "green":
      return {
        bg: "bg-[color:color-mix(in_oklab,var(--success-soft)_82%,white)]",
        border: "border-[color:color-mix(in_oklab,var(--success-soft)_46%,var(--border-subtle))]",
        fg: "text-[var(--success-ink)]",
      };
    case "violet":
      return {
        bg: "bg-[color:color-mix(in_oklab,oklch(0.92_0.06_300)_82%,white)]",
        border: "border-[color:color-mix(in_oklab,oklch(0.78_0.10_300)_46%,var(--border-subtle))]",
        fg: "text-[color:oklch(0.42_0.16_300)]",
      };
    case "neutral":
    default:
      return {
        bg: "bg-[color:color-mix(in_oklab,var(--surface-contrast)_82%,white)]",
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
  return (
    <>
      <div aria-hidden className="landing-luminous__base" />
      <div aria-hidden className="landing-luminous__glow" />
      <div aria-hidden className="landing-luminous__grid" />
      <span
        aria-hidden
        className="landing-orb-a landing-orb-violet pointer-events-none absolute left-[8%] top-[28%] h-40 w-40 rounded-full opacity-60 blur-3xl"
      />
      <span
        aria-hidden
        className="landing-orb-b landing-orb-cyan pointer-events-none absolute right-[6%] top-[58%] h-52 w-52 rounded-full opacity-50 blur-3xl"
      />
      <span aria-hidden className="landing-grain" />
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Product preview (luminous light card on dark)
   ──────────────────────────────────────────────────────────────────────────── */

function MockContractRow({
  name,
  owner,
  date,
  status,
  tone,
}: {
  name: string;
  owner: string;
  date: string;
  status: string;
  tone: "approved" | "pending" | "watch";
}) {
  const pill =
    tone === "approved"
      ? "border-[color:color-mix(in_oklab,var(--success-soft)_50%,transparent)] bg-[color:color-mix(in_oklab,var(--success-soft)_72%,white)] text-[var(--success-ink)]"
      : tone === "pending"
        ? "border-[color:color-mix(in_oklab,var(--warning-soft)_52%,transparent)] bg-[color:color-mix(in_oklab,var(--warning-soft)_74%,white)] text-[var(--warning-ink)]"
        : "border-[color:color-mix(in_oklab,var(--accent-soft)_52%,transparent)] bg-[color:color-mix(in_oklab,var(--accent-soft)_74%,white)] text-[var(--accent-strong)]";
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-t border-[var(--border-subtle)] px-3.5 py-2.5 first:border-t-0 sm:gap-4 sm:px-4">
      <div className="min-w-0">
        <p className="truncate text-[12.5px] font-semibold text-[var(--text-primary)]">{name}</p>
        <p className="mt-0.5 truncate text-[11px] text-[var(--text-tertiary)]">{owner}</p>
      </div>
      <span
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] ${pill}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current/75" />
        {status}
      </span>
      <span className="shrink-0 text-[11px] tabular-nums text-[var(--text-secondary)]">{date}</span>
    </div>
  );
}

function HeroProductPreview() {
  return (
    <div className="relative mx-auto max-w-5xl">
      <div
        aria-hidden
        className="absolute -inset-x-10 -inset-y-12 -z-10 rounded-2xl blur-3xl opacity-70"
        style={{
          background:
            "radial-gradient(ellipse at top, oklch(0.65 0.18 268 / 0.55), oklch(0.55 0.18 290 / 0.35) 30%, transparent 70%)",
        }}
      />
      <div
        className="relative rounded-2xl border border-white/15 p-1.5 shadow-[var(--shadow-floating)] backdrop-blur sm:p-2"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.06) 100%)",
        }}
      >
        <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface)_98%,white)]">
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
              oblixa.app · /renewals
            </span>
          </div>
          <div className="grid gap-4 p-4 sm:grid-cols-[1.45fr_1fr] sm:gap-5 sm:p-5">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-[var(--text-tertiary)]" aria-hidden />
                  <p className="text-[12.5px] font-semibold tracking-tight text-[var(--text-primary)]">
                    Upcoming renewals · Q2
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:color-mix(in_oklab,var(--warning-soft)_46%,transparent)] bg-[color:color-mix(in_oklab,var(--warning-soft)_68%,white)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--warning-ink)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-current/75" />
                  3 watch
                </span>
              </div>
              <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)]">
                <MockContractRow name="Acme Industries · MSA" owner="Sasha Olin · Ops" date="May 12" status="approved" tone="approved" />
                <MockContractRow name="Globex SaaS · Order form" owner="Priya Raman · Finance" date="May 28" status="pending" tone="pending" />
                <MockContractRow name="Initech · DPA" owner="Marco Diaz · Legal" date="Jun 03" status="approved" tone="approved" />
                <MockContractRow name="Hooli · Master services" owner="Tess Karim · Ops" date="Jun 14" status="watch" tone="watch" />
                <MockContractRow name="Stark Holdings · NDA" owner="Devon Reed · Legal" date="Jun 27" status="approved" tone="approved" />
              </div>
            </div>
            <div className="space-y-3">
              <div className="relative overflow-hidden rounded-xl border border-[color:color-mix(in_oklab,var(--accent-soft)_55%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_22%,var(--surface-raised))] p-3">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full opacity-50 blur-2xl"
                  style={{ background: "color-mix(in oklab, var(--accent) 40%, transparent)" }}
                />
                <div className="relative">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[color:color-mix(in_oklab,var(--accent)_22%,white)] text-[var(--accent-strong)]">
                      <Sparkles className="h-3.5 w-3.5" aria-hidden />
                    </span>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-strong)]">
                      Extraction · Globex
                    </p>
                  </div>
                  <p className="mt-2.5 text-[12.5px] font-medium leading-snug text-[var(--text-primary)]">
                    Notice window
                  </p>
                  <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                    60 days before renewal · approve to enable reminder
                  </p>
                  <div className="mt-2.5 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2.5 py-1.5 font-mono text-[11px] leading-relaxed text-[var(--text-secondary)]">
                    “Either party may terminate by providing{" "}
                    <span className="rounded-sm bg-[color:color-mix(in_oklab,var(--accent-soft)_60%,transparent)] px-1 text-[var(--accent-strong)]">
                      sixty (60) days
                    </span>{" "}
                    written notice…”
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-md bg-[var(--accent-strong)] px-2.5 py-1 text-[11px] font-semibold text-white">
                      Approve
                    </span>
                    <span className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                      Edit
                    </span>
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
          ? "text-[var(--accent-warm,var(--accent))]"
          : tone === "amber"
            ? "text-[var(--warning-ink)]"
            : tone === "success"
              ? "text-[var(--success-ink)]"
              : "text-[var(--accent-strong)]";
  return (
    <p
      className={`landing-eyebrow-dot text-[11px] font-semibold uppercase tracking-[0.22em] ${color}`}
    >
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
      className={`mt-4 text-balance text-[2.25rem] font-bold leading-[1.06] tracking-[-0.02em] sm:text-[2.75rem] md:text-[3.25rem] lg:text-[3.75rem] ${
        light ? "text-white" : "text-[var(--text-primary)]"
      }`}
    >
      {children}
    </h2>
  );
}

/** Inline accent gradient — used to lift a phrase inside section headings. */
function GradientPhrase({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="bg-clip-text text-transparent"
      style={{
        backgroundImage:
          "linear-gradient(100deg, var(--accent) 0%, var(--accent-strong) 45%, color-mix(in oklab, var(--accent-strong) 50%, oklch(0.55 0.18 290)) 100%)",
      }}
    >
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
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
        Backlog · 3 of 124
      </p>
      <div className="space-y-2">
        {docs.map((d) => (
          <div
            key={d.name}
            className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-2"
          >
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-contrast)_82%,white)] text-[var(--text-secondary)]">
              <FileText className="h-3.5 w-3.5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-semibold text-[var(--text-primary)]">{d.name}</p>
              <p className="truncate font-mono text-[11px] text-[var(--text-tertiary)]">{d.type}</p>
            </div>
            <span
              className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                d.tone === "green"
                  ? "bg-[color:color-mix(in_oklab,var(--success-soft)_72%,white)] text-[var(--success-ink)]"
                  : "bg-[color:color-mix(in_oklab,var(--warning-soft)_72%,white)] text-[var(--warning-ink)]"
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-strong)]">
            Field · Renewal date
          </p>
          <span className="inline-flex items-center gap-1 rounded-full border border-[color:color-mix(in_oklab,var(--accent)_30%,var(--border-subtle))] bg-[var(--surface-raised)] px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-[var(--accent-strong)]">
            AI · 96%
          </span>
        </div>
        <p className="mt-1.5 text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">
          March 12, 2027
        </p>
        <div className="mt-2 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2.5 py-1.5 font-mono text-[11px] leading-relaxed text-[var(--text-secondary)]">
          “The Initial Term shall commence on{" "}
          <span className="rounded-sm bg-[color:color-mix(in_oklab,var(--accent-soft)_60%,transparent)] px-1 text-[var(--accent-strong)]">
            March 12, 2024
          </span>{" "}
          and continue for three (3) years…”
        </div>
        <div className="mt-2.5 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-[var(--accent-strong)] px-2.5 py-1 text-[11px] font-semibold text-white">
            <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden />
            Approve
          </span>
          <span className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)]">
            Edit
          </span>
          <span className="ml-auto font-mono text-[11px] text-[var(--text-tertiary)]">
            Marco D.
          </span>
        </div>
      </div>
    </div>
  );
}

function ExecuteMiniMock() {
  const reminders = [
    { name: "Acme renewal · 30d", owner: "SO", date: "Apr 12", color: "accent" as const },
    { name: "Initech audit · 14d", owner: "MD", date: "May 20", color: "amber" as const },
    { name: "Hooli notice · 60d", owner: "TK", date: "Apr 15", color: "green" as const },
  ];
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
        Reminders · This week
      </p>
      <ul className="space-y-1.5">
        {reminders.map((r) => {
          const palette =
            r.color === "amber"
              ? "bg-[color:color-mix(in_oklab,var(--warning-soft)_72%,white)] text-[var(--warning-ink)]"
              : r.color === "green"
                ? "bg-[color:color-mix(in_oklab,var(--success-soft)_72%,white)] text-[var(--success-ink)]"
                : "bg-[color:color-mix(in_oklab,var(--accent-soft)_72%,white)] text-[var(--accent-strong)]";
          return (
            <li
              key={r.name}
              className="flex items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-2"
            >
              <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${palette}`}>
                <Bell className="h-3 w-3" aria-hidden />
              </span>
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-[var(--text-primary)]">
                {r.name}
              </span>
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-contrast)_82%,white)] font-mono text-[9.5px] font-bold text-[var(--text-secondary)]">
                {r.owner}
              </span>
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--text-tertiary)]">
                {r.date}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function HowItWorksNarrative() {
  const mocks = [IngestMiniMock, ValidateMiniMock, ExecuteMiniMock, TrackMiniMock];
  return (
    <ol className="mt-14 space-y-6">
      {steps.map((s, i) => {
        const Mock = mocks[i];
        return (
          <li
            key={s.n}
            className="landing-card-premium group relative overflow-hidden rounded-3xl border p-6 sm:p-9"
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
                  className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]"
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
  const reports = [
    { label: "Upcoming renewals", count: "12", tone: "accent" as const },
    { label: "Missing owners", count: "3", tone: "amber" as const },
    { label: "Open obligations", count: "8", tone: "green" as const },
  ];
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
        Reports · This quarter
      </p>
      <ul className="space-y-1.5">
        {reports.map((r) => {
          const palette =
            r.tone === "amber"
              ? "bg-[color:color-mix(in_oklab,var(--warning-soft)_72%,white)] text-[var(--warning-ink)]"
              : r.tone === "green"
                ? "bg-[color:color-mix(in_oklab,var(--success-soft)_72%,white)] text-[var(--success-ink)]"
                : "bg-[color:color-mix(in_oklab,var(--accent-soft)_72%,white)] text-[var(--accent-strong)]";
          return (
            <li
              key={r.label}
              className="flex items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-2"
            >
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-[var(--text-primary)]">
                {r.label}
              </span>
              <span
                className={`inline-flex h-6 min-w-[2.25rem] items-center justify-center rounded-md px-1.5 font-mono text-[11px] font-bold tabular-nums ${palette}`}
              >
                {r.count}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Bento capabilities
   ──────────────────────────────────────────────────────────────────────────── */

function BentoCapabilities() {
  return (
    <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
      {features.map((f) => {
        const span = f.span === "wide" ? "sm:col-span-2 lg:col-span-2 lg:row-span-2" : "";
        const isWide = f.span === "wide";
        return (
          <article
            key={f.title}
            className={`landing-card-premium group relative overflow-hidden rounded-3xl border p-6 sm:p-7 ${span}`}
          >
            {isWide ? (
              <div
                aria-hidden
                className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-60 blur-3xl"
                style={{
                  background:
                    "radial-gradient(circle, color-mix(in oklab, var(--accent) 30%, transparent), transparent 70%)",
                }}
              />
            ) : null}
            <div className="relative flex h-full flex-col">
              <FeatureIconTile icon={f.icon} accent={f.accent} />
              <h3
                className={`mt-5 font-semibold tracking-tight text-[var(--text-primary)] ${
                  isWide ? "text-[1.35rem] leading-snug sm:text-[1.55rem]" : "text-[1.05rem] leading-snug"
                }`}
              >
                {f.title}
              </h3>
              <p
                className={`mt-2.5 text-[var(--text-secondary)] ${
                  isWide ? "max-w-md text-[14px] leading-[1.65]" : "text-[14px] leading-[1.58]"
                }`}
              >
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
      <span className="landing-glyph landing-glyph-yes" aria-label="yes">
        <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
      </span>
    );
  }
  if (level === "partial") {
    return (
      <span className="landing-glyph landing-glyph-partial" aria-label="partial">
        <MinusCircle className="h-3 w-3" strokeWidth={1.85} aria-hidden />
      </span>
    );
  }
  return (
    <span className="landing-glyph landing-glyph-no" aria-label="no">
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
        <span className="landing-compare-badge">
          <Sparkles className="h-3 w-3" aria-hidden />
          Recommended
        </span>
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
      className="section-divider-top relative scroll-mt-36 px-4 py-16 sm:px-6 sm:py-24"
      aria-labelledby="problem-heading"
    >
      <SectionLocator index={1} total={3} />
      <div className="relative mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <SectionEyebrow tone="amber">Problem</SectionEyebrow>
          <SectionHeading id="problem-heading">{problemSectionTitle}</SectionHeading>
        </div>
        {/* v11 — 6 spec-mandated bullets render as substantial cards with
            icon medallion + title + supporting description. */}
        <ul className="mx-auto mt-10 grid max-w-7xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {problemCards.map((card) => {
            const Icon = PROBLEM_ICON_MAP[card.iconName];
            const tone = PROBLEM_TONE_COLORS[card.tone];
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
      className="section-divider-top relative scroll-mt-36 px-4 py-16 sm:px-6 sm:py-24"
      aria-labelledby="outcomes-heading"
    >
      <SectionLocator index={2} total={3} />
      <div className="relative mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center lg:mx-0 lg:text-left">
          <SectionEyebrow tone="success">Outcomes</SectionEyebrow>
          <SectionHeading id="outcomes-heading">{outcomesSectionTitle}</SectionHeading>
        </div>
        {/* v12 — 2-column layout fills the side void with actual content: the
            5 spec-mandated outcomes on the left, a mock "Attention queue"
            on the right showing what catching things early looks like. */}
        <div className="mt-12 grid items-start gap-8 lg:grid-cols-[1fr_minmax(0,28rem)] lg:gap-10">
          <ul className="grid gap-4">
            {outcomesBullets.map((b, i) => (
              <li
                key={b}
                className="landing-card-premium relative overflow-hidden rounded-2xl border p-5 sm:p-6"
              >
                <div className="flex items-start gap-3.5">
                  <span
                    aria-hidden
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--success-ink)_28%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--success-soft)_38%,var(--surface-raised))] text-[13px] font-bold text-[var(--success-ink)]"
                    style={{ fontVariantNumeric: "tabular-nums lining-nums slashed-zero" }}
                  >
                    {i + 1}
                  </span>
                  <p className="text-[14.5px] font-medium leading-[1.45] text-[var(--text-secondary)] sm:text-[15px]">
                    {b}
                  </p>
                </div>
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
              <span className="font-mono text-[10.5px] text-[var(--text-tertiary)]">3 this week</span>
            </div>
            <div className="mt-2 -mx-5 sm:-mx-6">
              <MockContractRow
                name="Acme Industries · MSA"
                owner="Sasha Olin · Operations"
                date="May 12"
                status="Renewal"
                tone="pending"
              />
              <MockContractRow
                name="Globex SaaS · Order form"
                owner="Priya Raman · Finance"
                date="May 28"
                status="Notice"
                tone="watch"
              />
              <MockContractRow
                name="Initech · DPA"
                owner="Marco Diaz · Legal"
                date="Jun 03"
                status="Evidence"
                tone="approved"
              />
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-[var(--border-subtle)] pt-3">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
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
      className="section-divider-top relative scroll-mt-36 px-4 py-16 sm:px-6 sm:py-24"
      aria-labelledby="best-fit-heading"
    >
      <SectionLocator index={3} total={3} />
      <div className="relative mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center lg:mx-0 lg:text-left">
          <SectionEyebrow tone="warm">Best fit</SectionEyebrow>
          <SectionHeading id="best-fit-heading">{bestFitSectionTitle}</SectionHeading>
        </div>
        {/* v12 — 2-column layout fills the side void with actual content: the
            4 spec-mandated criteria on the left, a mock "Cross-functional
            ownership" contracts panel on the right showing what a fitting
            team's contract list looks like. */}
        <div className="mt-12 grid items-start gap-8 lg:grid-cols-[1fr_minmax(0,28rem)] lg:gap-10">
          <ul className="grid gap-4">
            {bestFitItems.map((item) => (
              <li
                key={item}
                className="landing-card-premium relative overflow-hidden rounded-2xl border p-5 sm:p-6"
              >
                <div className="flex items-start gap-3.5">
                  <span
                    aria-hidden
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--accent-warm,var(--accent))_28%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-warm,var(--accent))_14%,var(--surface-raised))] text-[var(--accent-warm,var(--accent-strong))]"
                  >
                    <Check className="h-[18px] w-[18px]" strokeWidth={2.1} />
                  </span>
                  <p className="text-[14.5px] font-medium leading-[1.5] text-[var(--text-secondary)] sm:text-[15px]">
                    {item}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          {/* Right-side mock: Cross-functional ownership. Concrete visualization
              of a 50–500 contract portfolio with mixed contract types + owners
              across operations / finance / legal — what the spec criteria look
              like in practice. */}
          <aside aria-hidden className="landing-card-premium relative overflow-hidden rounded-2xl border p-5 sm:p-6">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <p className="ui-caps-2 inline-flex items-center gap-1.5 text-[10.5px] text-[var(--accent-warm,var(--accent-strong))]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-warm,var(--accent-strong))]" />
                Cross-functional
              </p>
              <span className="font-mono text-[10.5px] text-[var(--text-tertiary)]">214 active</span>
            </div>
            <div className="mt-2 -mx-5 sm:-mx-6">
              <MockContractRow
                name="Hooli · Master services"
                owner="Tess Karim · Operations"
                date="Jul 14"
                status="Vendor"
                tone="approved"
              />
              <MockContractRow
                name="Stark Holdings · Lease"
                owner="Devon Reed · Finance"
                date="Aug 02"
                status="Lease"
                tone="watch"
              />
              <MockContractRow
                name="Pied Piper · Partnership"
                owner="Aria Sun · Account"
                date="Sep 28"
                status="Renewal"
                tone="pending"
              />
              <MockContractRow
                name="Initech · DPA addendum"
                owner="Marco Diaz · Legal"
                date="Oct 11"
                status="Compliance"
                tone="approved"
              />
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-[var(--border-subtle)] pt-3">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
                <Users className="h-3 w-3 text-[var(--accent-warm,var(--accent-strong))]" strokeWidth={2.1} aria-hidden />
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
   Now wraps in landing-luminous + adds a substantial card chrome + plan
   summary chip strip + trial-includes strip mirroring the pricing v10 pattern. */
function PricingCtaSection() {
  return (
    <section
      className="section-divider-top relative scroll-mt-36 px-4 py-16 sm:px-6 sm:py-24"
      aria-labelledby="pricing-cta-heading"
    >
      <div className="relative mx-auto max-w-5xl">
        <div className="landing-card-premium relative overflow-hidden rounded-3xl border p-8 text-center sm:p-12 lg:p-14">
          <span
            aria-hidden
            className="landing-corner-ring"
            style={{ top: "-2rem", right: "-2rem", width: "10rem", height: "10rem" }}
          />
          <span
            aria-hidden
            className="landing-corner-ring"
            style={{ bottom: "-2rem", left: "-2rem", width: "10rem", height: "10rem" }}
          />
          <div className="relative">
            <SectionEyebrow>Pricing</SectionEyebrow>
            <SectionHeading id="pricing-cta-heading">{pricingCtaMessage}</SectionHeading>

            {/* Plan summary chip strip — three concrete facts about Core. */}
            <div className="mt-7 flex justify-center">
              <div className="inline-flex flex-wrap justify-center divide-x divide-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] rounded-md border border-[color:color-mix(in_oklab,var(--border-subtle)_50%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-raised)_72%,transparent)] text-[11.5px] font-semibold text-[var(--text-tertiary)]">
                <span className="px-3 py-1.5">
                  <span className="tabular-nums text-[var(--text-secondary)]">$249</span>/mo
                </span>
                <span className="px-3 py-1.5">
                  <span className="tabular-nums text-[var(--text-secondary)]">500</span> contracts
                </span>
                <span className="px-3 py-1.5">
                  <span className="tabular-nums text-[var(--text-secondary)]">10</span> team members
                </span>
              </div>
            </div>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/signup"
                className="product-cta-halo ui-btn-primary inline-flex min-h-11 items-center gap-1.5 px-5 py-2.5 text-[14px] font-semibold"
              >
                {ctaPrimaryLabel}
                <ArrowRight className="h-4 w-4" strokeWidth={1.85} aria-hidden />
              </Link>
              <Link
                href="/pricing"
                prefetch={false}
                className="ui-btn-ghost inline-flex min-h-11 items-center gap-1.5 px-4 py-2.5 text-[14px] font-semibold"
              >
                View pricing
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
              </Link>
            </div>

            {/* Trial-includes strip mirrors the pricing v10 pattern. */}
            <div className="mt-6 flex justify-center">
              <div className="inline-flex flex-wrap justify-center divide-x divide-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)] rounded-md border border-[color:color-mix(in_oklab,var(--border-subtle)_45%,transparent)] text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                <span className="px-3 py-1.5">21-day trial</span>
                <span className="px-3 py-1.5">No credit card</span>
                <span className="px-3 py-1.5">CSV export</span>
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
  return (
    <div className="landing-root relative flex min-h-full flex-col bg-canvas">
      <div aria-hidden className="landing-header-backdrop" />
      <MarketingSiteHeader
        secondaryNav={
          <>
            <a href="#problem" className={landingSectionNavClassName}>
              Problem
            </a>
            <a href="#compare" className={landingSectionNavClassName}>
              Compare
            </a>
            <a href="#how-it-works" className={landingSectionNavClassName}>
              How it works
            </a>
            <a href="#capabilities" className={landingSectionNavClassName}>
              Capabilities
            </a>
            <a href="#objections" className={landingSectionNavClassName}>
              Honest answers
            </a>
            <a href="#faq" className={landingSectionNavClassName}>
              FAQ
            </a>
          </>
        }
      />

      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex-1 outline-none">
        {/* ===================================================================
            HERO — 2-col at lg+ (text left, mock right). Mobile stacks.
        =================================================================== */}
        <section
          id="hero"
          className="landing-luminous relative isolate overflow-hidden scroll-mt-36 px-4 pb-16 pt-14 sm:px-6 sm:pb-20 sm:pt-16"
        >
          <LuminousHeroBackdrop />

          <div className="relative mx-auto max-w-7xl">
            <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
              <div className="text-center lg:text-left">
                <span className="landing-reveal-1 landing-glass-pill">
                  <span className="relative flex h-1.5 w-1.5 items-center justify-center">
                    <span
                      className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70 motion-reduce:animate-none"
                      style={{ background: "var(--accent)" }}
                      aria-hidden
                    />
                    <span
                      className="relative inline-flex h-full w-full rounded-full"
                      style={{ background: "var(--accent-strong)" }}
                    />
                  </span>
                  {heroEyebrow}
                </span>

                <h1 className="landing-reveal-2 landing-luminous-headline mt-6 max-w-[18ch] text-balance text-[2.4rem] font-semibold leading-[1.04] tracking-[-0.025em] sm:text-[3.25rem] sm:leading-[1.02] lg:mx-0 lg:max-w-[14ch] lg:text-[3.75rem] xl:text-[4.25rem]">
                  Track renewals, obligations, and owners from{" "}
                  <span
                    className="bg-clip-text text-transparent"
                    style={{
                      backgroundImage:
                        "linear-gradient(100deg, var(--accent) 0%, var(--accent-strong) 38%, color-mix(in oklab, var(--accent-strong) 60%, oklch(0.55 0.18 290)) 78%, color-mix(in oklab, var(--accent-strong) 30%, oklch(0.65 0.18 290)) 100%)",
                    }}
                  >
                    signed contracts
                  </span>
                </h1>

                <p className="landing-reveal-3 landing-luminous-body mt-5 max-w-xl text-pretty text-[15px] leading-[1.6] sm:text-[16px] lg:mx-0">
                  {heroSubcopy}
                </p>

                <div className="landing-reveal-4 mt-7 flex flex-col items-center gap-3 sm:flex-row sm:gap-4 lg:items-start lg:justify-start">
                  <Link href="/signup" className="product-cta-halo landing-cta-primary group">
                    <Sparkles className="h-4 w-4 opacity-90" aria-hidden />
                    <span>{ctaPrimaryLabel}</span>
                    <ArrowRight
                      className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </Link>
                  <Link href="/login" prefetch={false} className="landing-cta-secondary group">
                    <span>{ctaSecondaryLabel}</span>
                    <ArrowRight
                      className="h-3.5 w-3.5 opacity-60 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </Link>
                </div>

                <p className="landing-reveal-5 landing-luminous-tertiary mt-4 text-[12.5px]">
                  {riskReducerLine}
                </p>
              </div>

              <div className="landing-reveal-5 relative">
                <HeroProductPreview />
              </div>
            </div>
          </div>

          <div aria-hidden className="landing-luminous__fade" />
        </section>

        {/* PROBLEM */}
        <ProblemSection />

        {/* COMPARE APPROACHES — promoted to anchor section (was #5, now #3).
            v12: removed landing-luminous; relies on the page-level atmospheric
            backdrop for consistent ambient color. Section is otherwise
            transparent so the fixed page atmosphere shows through. */}
        <section
          id="compare"
          className="section-divider-top relative scroll-mt-36 px-4 py-16 sm:px-6 sm:py-24"
          aria-labelledby="compare-heading"
        >
          <div className="relative mx-auto max-w-6xl">
            <div className="mx-auto max-w-2xl text-center">
              <SectionEyebrow>Compare approaches</SectionEyebrow>
              <SectionHeading id="compare-heading">
                Spreadsheets, full CLM, and a{" "}
                <GradientPhrase>contract tracking workspace</GradientPhrase>
              </SectionHeading>
              <p className="landing-luminous-body mt-5 text-pretty text-[14px] leading-[1.65] sm:text-[16px]">
                Oblixa sits between the spreadsheet and a full CLM — post-signature tracking with
                source-backed evidence and audit history, no months-long implementation.
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
                label="Full CLM suite"
                highlight={false}
                rows={compareRows}
                picker={(r) => r.clm}
                textPicker={(r) => r.clmText ?? ""}
              />
              <CompareCol
                label="Oblixa · Contract tracking"
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
          className="section-divider-top relative scroll-mt-36 px-4 py-16 sm:px-6 sm:py-24"
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
                Four steps from upload to action — no consultants, no implementation program,
                no spreadsheet roulette.
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
          className="section-divider-top relative scroll-mt-36 px-4 py-14 sm:px-6 sm:py-16"
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
                    className="landing-card-premium relative overflow-hidden rounded-2xl border p-6"
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

        {/* PRICING CTA — release-state spec §Home Page > Pricing CTA.
            Replaces the v9 ad-hoc mid-page CTA strip with the spec-mandated
            "Start by replacing the spreadsheet" message + Start free trial
            + View pricing buttons. */}
        <PricingCtaSection />

        {/* FAQ — 2-col at lg+ */}
        <section
          id="faq"
          className="section-divider-top relative scroll-mt-36 px-4 py-16 sm:px-6 sm:py-20 lg:py-24"
          aria-labelledby="faq-heading"
        >
          <CornerAnchor size="section" position="top-left" />
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
                  <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-5 transition-colors marker:hidden hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_38%,transparent)] sm:px-6 [&::-webkit-details-marker]:hidden">
                    <span className="flex-1 pr-3 text-[14px] font-semibold leading-snug tracking-tight text-[var(--text-primary)]">
                      {item.question}
                    </span>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[color:var(--surface-tint)] text-[var(--text-tertiary)] transition-all group-open:rotate-180 group-open:border-[color:color-mix(in_oklab,var(--accent)_42%,var(--border-subtle))] group-open:bg-[color:color-mix(in_oklab,var(--accent-soft)_38%,white)] group-open:text-[var(--accent-strong)]">
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

        {/* CLOSING CTA — matches /pricing pattern with /security tertiary link */}
        <section
          className="landing-luminous relative isolate overflow-hidden border-t border-[var(--border-subtle)] px-4 py-16 sm:px-6 sm:py-24"
          aria-labelledby="cta-final-heading"
        >
          <div aria-hidden className="landing-luminous__base" />
          <div aria-hidden className="landing-luminous__glow" />
          <div aria-hidden className="landing-luminous__grid" />
          <div className="relative mx-auto max-w-3xl text-center">
            <span className="landing-glass-pill">
              <Clock className="h-3 w-3" aria-hidden />
              Ready in minutes
            </span>
            <h2
              id="cta-final-heading"
              className="landing-luminous-headline mt-7 text-balance text-[2.25rem] font-semibold leading-[1.04] tracking-[-0.02em] sm:text-[3rem] sm:leading-[1.02] md:text-[3.5rem]"
            >
              Start with one workspace.{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    "linear-gradient(100deg, var(--accent) 0%, var(--accent-strong) 50%, color-mix(in oklab, var(--accent-strong) 50%, oklch(0.55 0.18 290)) 100%)",
                }}
              >
                Prove the workflow.
              </span>
            </h2>
            <p className="landing-luminous-body mx-auto mt-6 max-w-xl text-pretty text-[16px] leading-[1.65] sm:text-[18px]">
              Upload a contract, validate the fields that matter, and assign owners for the next
              milestones.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <Link href="/signup" className="product-cta-halo landing-cta-primary group">
                {ctaPrimaryLabel}
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
              <Link href="/login" prefetch={false} className="landing-cta-secondary">
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

/* unused import guard — keeps `Zap` and `PenLine` available for future iconography swaps */
export const __landingIconRegistry = { Zap, PenLine } as const;
