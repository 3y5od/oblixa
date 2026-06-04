import Link from "next/link";
import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  Calendar,
  CalendarClock,
  Check,
  CheckSquare,
  ChevronRight,
  CircleAlert,
  FileSpreadsheet,
  Files,
  FileText,
  Inbox,
  ListChecks,
  ShieldAlert,
  ShieldCheck,
  UploadCloud,
  Users,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { ActionChip } from "@/components/ui/action-chip";
import { ActivityFeed, type ActivityFeedItem } from "@/components/ui/activity-feed";
import { CountChip } from "@/components/ui/count-chip";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { FieldChip } from "@/components/ui/field-chip";
import { KeyValueChip } from "@/components/ui/key-value-chip";
import { StatusBadge, type SemanticStatus } from "@/components/ui/status-badge";
import type { StatTone } from "@/components/ui/stat-cell";
import { TimeChip } from "@/components/ui/time-chip";
import { CAPS_VERBS } from "@/lib/ui-copy";
import {
  DASHBOARD_PRIMARY_CTA,
  DASHBOARD_SECONDARY_CTA,
  DASHBOARD_TITLE,
} from "@/lib/dashboard/spec-strings";
import { getCoreDashboardVisiblePartialErrors } from "@/lib/dashboard/core-dashboard-model";
import type {
  CoreDashboardActivityRow,
  CoreDashboardDataGapRow,
  CoreDashboardDeadlineRow,
  CoreDashboardImportStatus,
  CoreDashboardModel,
  CoreDashboardReviewRow,
  CoreDashboardSection,
  CoreDashboardTopCard,
  CoreDashboardWorkRow,
  DashboardSectionKey,
  DashboardTopCardKey,
} from "@/lib/dashboard/core-dashboard-model";

const SECTION_ICONS: Record<DashboardSectionKey, typeof CheckSquare> = {
  review_queue: CheckSquare,
  upcoming_deadlines: CalendarClock,
  work_needing_action: ListChecks,
  data_gaps: Inbox,
  recent_activity: FileText,
};

// Distinct unit label per card so the count reads as structured metric
// anatomy (dot + label / number / unit) instead of a bare numeral. No two
// cards share a unit — the scan path stays differentiated.
const TOP_CARD_UNIT: Record<DashboardTopCardKey, string> = {
  needs_review: "TO REVIEW",
  upcoming_deadlines: "DUE SOON",
  blocked_work: "BLOCKED",
  missing_owners: "UNOWNED",
  open_exceptions: "OPEN",
  evidence_requested: "REQUESTED",
};

// Per-card semantic tone (release UI spec §Metric Strip): danger for genuine
// blockage (blocked work, open exceptions); warning for time-pressure and an
// actionable data gap (upcoming deadlines, missing owners); accent for the two
// interactive queues the user works straight through (needs review, evidence
// requested). Zero counts override to success ink — see cardInk.
const CARD_TONE_INK: Record<DashboardTopCardKey, string> = {
  needs_review: "var(--accent-strong)",
  upcoming_deadlines: "var(--warning-ink)",
  blocked_work: "var(--danger-ink)",
  missing_owners: "var(--warning-ink)",
  open_exceptions: "var(--danger-ink)",
  evidence_requested: "var(--accent-strong)",
};

// Each active cell renders a tone-tinted icon medallion immediately left of the
// number so the stat reads as a mini-KPI cell with a fixed visual anchor
// (§11.17) instead of a floating numeral. Zero cells swap this for the success
// Check medallion (§2.11) — so every cell always fills the same 24px slot.
const TOP_CARD_ICON: Record<DashboardTopCardKey, LucideIcon> = {
  needs_review: CheckSquare,
  upcoming_deadlines: CalendarClock,
  blocked_work: Ban,
  missing_owners: UserX,
  open_exceptions: AlertTriangle,
  evidence_requested: ShieldAlert,
};

function cardInk(card: CoreDashboardTopCard): string {
  // Zero counts read as full success ink so the cell affirms "all clear"
  // rather than fading into the surface.
  if (card.count === 0) return "var(--success-ink)";
  return CARD_TONE_INK[card.key] ?? "var(--text-primary)";
}

function statusForWork(row: CoreDashboardWorkRow): SemanticStatus {
  if (row.status === "blocked") return "blocked";
  if (row.dueState === "overdue") return "overdue";
  if (row.status === "waiting") return "warning";
  if (row.status === "done") return "healthy";
  // `in_progress` reads as active work — accent-blue. `open` reads as
  // queued / not-yet-started — neutral grey. The earlier mapping put both
  // on `in_review` (accent-blue) so the user couldn't tell at scan time
  // whether a task had been picked up yet.
  if (row.status === "in_progress") return "in_review";
  return "empty";
}

function workStatusInk(status: SemanticStatus): string {
  if (status === "blocked" || status === "overdue" || status === "critical")
    return "var(--danger-ink)";
  if (status === "warning") return "var(--warning-ink)";
  if (status === "in_review") return "var(--accent-strong)";
  if (status === "healthy") return "var(--success-ink)";
  return "var(--text-secondary)";
}

function compactLabel(value: string | null | undefined, fallback: string): string {
  // Title-case the first letter so enum leaks ("exception", "task",
  // "obligation") render as proper labels ("Exception", "Task",
  // "Obligation"). Display-only transformation — the model data is unchanged.
  const raw = String(value || fallback).replace(/_/g, " ").trim();
  if (raw.length === 0) return "";
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

/** Pick a lucide icon for a work-row's type tag (Task / Approval / etc.).
 *  Pattern match on the compactLabel so the row's kind reads at scan time
 *  without needing a separate chip column. */
function workTypeIcon(type: string): LucideIcon {
  const t = type.toLowerCase();
  if (t.includes("approval")) return BadgeCheck;
  if (t.includes("obligation")) return Calendar;
  if (t.includes("exception")) return AlertTriangle;
  if (t.includes("evidence")) return ShieldAlert;
  // Renewal checkpoints get their own glyph so they no longer collide with
  // contract tasks — letting the icon carry the work kind without a text label.
  if (t.includes("renewal") || t.includes("checkpoint")) return CalendarClock;
  return ListChecks;
}

/** Map an activity row onto the canonical activity-feed vocabulary: a caps
 *  verb from the shared list, a single-color semantic icon, and an optional
 *  tone. Keeps Recent Activity to "verb + target chip + time" per §8.5
 *  instead of free sentence prose. */
function activityVisual(row: CoreDashboardActivityRow): {
  verb: string;
  icon: LucideIcon;
  tone?: StatTone;
} {
  const text = `${row.label} ${row.summary} ${row.outcome ?? ""}`.toLowerCase();
  if (text.includes("upload")) return { verb: CAPS_VERBS.uploaded, icon: UploadCloud };
  if (text.includes("extract")) return { verb: CAPS_VERBS.extracted, icon: FileText };
  if (text.includes("approv")) return { verb: CAPS_VERBS.approved, icon: BadgeCheck, tone: "success" };
  if (text.includes("reject")) return { verb: CAPS_VERBS.rejected, icon: AlertTriangle, tone: "danger" };
  if (text.includes("creat")) return { verb: CAPS_VERBS.created, icon: FileText };
  if (text.includes("delet")) return { verb: CAPS_VERBS.deleted, icon: FileText };
  // owner_changed keeps the Users glyph; other change events use a generic doc
  // glyph. Both read as CHANGED and dedupe as one kind (see activityDedupeKind).
  if (text.includes("owner")) return { verb: CAPS_VERBS.changed, icon: Users };
  if (
    text.includes("updat") ||
    text.includes("chang") ||
    text.includes("status") ||
    text.includes("supersed") ||
    text.includes("applied")
  )
    return { verb: CAPS_VERBS.changed, icon: FileText };
  if (text.includes("complet") || text.includes("done"))
    return { verb: CAPS_VERBS.completed, icon: CheckSquare, tone: "success" };
  if (text.includes("evidence") || text.includes("receiv"))
    return { verb: CAPS_VERBS.received, icon: ShieldCheck };
  if (text.includes("export")) return { verb: CAPS_VERBS.exported, icon: FileSpreadsheet };
  if (text.includes("sign")) return { verb: CAPS_VERBS.signed, icon: BadgeCheck, tone: "success" };
  // Last word of the label, not the leading noun, so an unmapped
  // "Contract Template Pack Applied" reads "APPLIED", never a generic "CONTRACT".
  const words = row.label.trim().split(/\s+/);
  const fallback = (words[words.length - 1] || "Activity").toUpperCase();
  return { verb: fallback, icon: FileText };
}

function EmptySectionRow({ children }: { children: string }) {
  return (
    <div
      className="relative flex min-h-[4.5rem] items-center gap-3 overflow-hidden rounded-xl px-4 py-3"
      style={{
        background:
          "linear-gradient(180deg, color-mix(in oklab, var(--success-soft) 14%, transparent) 0%, color-mix(in oklab, var(--success-soft) 6%, transparent) 100%)",
        boxShadow:
          "inset 0 1px 0 0 color-mix(in oklab, var(--success-ink) 10%, transparent)",
      }}
    >
      <span
        aria-hidden
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border"
        style={{
          borderColor: "color-mix(in oklab, var(--success-ink) 26%, var(--border-card))",
          background: "color-mix(in oklab, var(--success-soft) 32%, var(--surface-raised))",
          color: "color-mix(in oklab, var(--success-ink) 80%, var(--text-secondary))",
        }}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
      </span>
      <span className="min-w-0 flex-1 text-[13px] leading-snug text-[var(--text-secondary)]">
        {children}
      </span>
    </div>
  );
}

function TopSignal({ card }: { card: CoreDashboardTopCard }) {
  const isZero = card.count === 0;
  const ink = cardInk(card);
  const unit = TOP_CARD_UNIT[card.key];
  const CardIcon = TOP_CARD_ICON[card.key];
  // §2.11 stat cell with a single leading anchor (§11.17): caps label / icon
  // medallion + tone-colored number / unit chip. The medallion is the cell's
  // only status marker — active cells show the metric's tone-tinted icon, zero
  // cells swap it for a success Check beside a muted-green number. No competing
  // tone-dot in the label row (the dot + icon + label together read as busy).
  return (
    <Link
      href={card.href}
      aria-label={`${card.label}: ${card.count}. ${card.actionLabel}.`}
      className="group relative flex min-w-0 flex-col gap-1 rounded-lg px-3 py-3 transition-colors duration-150 hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_8%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:color-mix(in_oklab,var(--accent)_45%,transparent)]"
    >
      <span className="ui-caps-2 block text-[10px] text-[var(--text-tertiary)]">{card.label}</span>
      <span className="mt-0.5 inline-flex items-center gap-2">
        {isZero ? (
          <span
            aria-hidden
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border"
            style={{
              borderColor: "color-mix(in oklab, var(--success-ink) 28%, var(--border-card))",
              background: "color-mix(in oklab, var(--success-ink) 12%, var(--surface))",
              color: "var(--success-ink)",
            }}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={2.2} />
          </span>
        ) : (
          <span
            aria-hidden
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border"
            style={{
              borderColor: `color-mix(in oklab, ${ink} 26%, var(--border-card))`,
              background: `color-mix(in oklab, ${ink} 12%, var(--surface))`,
              color: ink,
            }}
          >
            <CardIcon className="h-3.5 w-3.5" strokeWidth={2} />
          </span>
        )}
        <span
          className="text-[2rem] font-semibold leading-none tabular-nums tracking-[-0.02em]"
          style={{
            color: isZero
              ? "color-mix(in oklab, var(--success-ink) 55%, var(--text-tertiary))"
              : ink,
          }}
        >
          {card.count}
        </span>
      </span>
      <span
        className="mt-0.5 inline-flex h-4 max-w-max items-center whitespace-nowrap rounded-md border bg-[var(--surface)] px-1.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] leading-none"
        style={{
          borderColor: isZero
            ? "color-mix(in oklab, var(--success-ink) 24%, var(--border-card))"
            : "var(--border-card)",
          color: isZero
            ? "color-mix(in oklab, var(--success-ink) 55%, var(--text-tertiary))"
            : "var(--text-tertiary)",
        }}
      >
        {unit}
      </span>
    </Link>
  );
}

function SignalSurface({ children }: { children: React.ReactNode }) {
  return (
    <section
      aria-label="Top cards"
      // Six-column horizontal strip at xl breakpoint — denser scan path than a
      // 3×2 grid, no large empty areas. Collapses to 2 cols at sm and a single
      // column on mobile. Shares the raised card surface (§2.1) so the summary
      // band reads with the same presence as the section panels below.
      className="ui-card-raised overflow-hidden"
    >
      {/* Subtle vertical hairlines between the six cells at xl (single row) give
          the strip real stat-cell separation so it stops reading flat; below xl
          the grid wraps to 2–3 columns, so dividers drop out in favor of gap
          (§Metric Strip). */}
      <div className="grid grid-cols-1 gap-1 p-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 xl:gap-0 xl:[&>*+*]:border-l xl:[&>*+*]:border-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)]">
        {children}
      </div>
    </section>
  );
}

function PartialDataNotice({ count }: { count: number }) {
  if (count <= 0) return null;
  // Reflects dashboard sections that failed to load — NOT import progress
  // (that's ImportStatusNotice, fed by real contract_import_jobs). This banner
  // previously claimed "imports still processing," which mislabeled a failed
  // query as an import.
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Dashboard partial data state"
      className="ui-alert-warning flex items-start gap-2.5 px-5 py-3"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
      <p className="text-[13px] leading-snug">
        <span className="font-semibold">Some dashboard data could not load.</span>{" "}
        {count === 1 ? "One section" : `${count} sections`} may show incomplete
        counts — reload to try again.
      </p>
    </div>
  );
}

function ImportStatusNotice({ status }: { status: CoreDashboardImportStatus }) {
  // Real contract-import state from contract_import_jobs: an info strip while
  // imports are mid-flight (processing), a warning/error strip when the latest
  // import failed or finished with rows needing correction (attention), and
  // nothing once imports stop affecting counts — kind === "none" collapses the
  // banner so a clean import doesn't nag.
  if (status.kind === "none") return null;
  const alertClass =
    status.tone === "danger"
      ? "ui-alert-error"
      : status.tone === "warning"
        ? "ui-alert-warning"
        : "ui-alert-info";
  const chipTone = status.tone === "danger" ? "danger" : status.tone === "warning" ? "warning" : undefined;
  const ink =
    status.tone === "danger"
      ? "var(--danger-ink)"
      : status.tone === "warning"
        ? "var(--warning-ink)"
        : "var(--accent-strong)";
  const StatusIcon =
    status.kind === "processing"
      ? UploadCloud
      : status.tone === "danger"
        ? CircleAlert
        : AlertTriangle;
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Contract import status"
      className={`${alertClass} flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between`}
    >
      {/* Structured left: tone-tinted icon medallion + strong status phrase over
          a quiet detail line. Anchors the banner so it stops reading
          under-composed for its width (§Import Banner). */}
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
          style={{
            borderColor: `color-mix(in oklab, ${ink} 30%, var(--border-card))`,
            background: `color-mix(in oklab, ${ink} 14%, var(--surface-raised))`,
            color: ink,
          }}
        >
          <StatusIcon className="h-4 w-4" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold leading-snug">{status.headline}</p>
          <p className="mt-0.5 text-[12px] leading-snug">{status.detail}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
        {status.occurredAt ? (
          <TimeChip date={status.occurredAt} bordered className="shrink-0" />
        ) : null}
        <ActionChip
          verb={status.canRetry ? "Retry import" : "View imports"}
          href={status.href}
          tone={chipTone}
          className="shrink-0"
        />
      </div>
    </div>
  );
}

function SectionShell({
  section,
  children,
}: {
  section: CoreDashboardSection;
  children: React.ReactNode;
}) {
  const Icon = SECTION_ICONS[section.key];
  const ariaId = `${section.key.replace(/_/g, "-")}-h`;
  return (
    <section
      aria-labelledby={ariaId}
      // Documented raised tier for page-level content blocks (§2.1): stronger
      // accent-tinted border + accent wash + shadow-2 + refined inner highlight
      // + a subtle accent halo. Lifts the panels off the canvas so they no
      // longer read as pale/thin.
      className="ui-card-raised min-w-0 overflow-hidden"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)] px-4 py-3">
        <h2
          id={ariaId}
          className="ui-caps-2 flex min-w-0 items-center gap-2 text-[11px] text-[var(--text-secondary)]"
        >
          {/* Accent icon-tile gives every panel header the same structured
              left anchor (§Panel System) instead of a bare faint glyph, so the
              raised panels stop reading pale/thin. */}
          <span
            aria-hidden
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[color:color-mix(in_oklab,var(--accent)_18%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_30%,var(--surface-raised))] text-[var(--accent-strong)]"
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={1.85} />
          </span>
          <span className="min-w-0 truncate">{section.title}</span>
          {section.count > 0 ? (
            <CountChip value={section.count} emphasis="strong" className="ml-0.5 shrink-0" />
          ) : null}
        </h2>
        {section.actionLabel ? (
          <ActionChip verb={section.actionLabel} href={section.href} className="shrink-0" />
        ) : null}
      </div>
      <div className="p-2">{children}</div>
    </section>
  );
}

// Row hover treatment shared across review / work / data-gap rows: gentle bg
// shift plus an accent rail that grows on hover.
const ROW_LINK_BASE =
  "group relative flex items-center gap-3 rounded-xl px-3 transition-colors duration-200 hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_12%,transparent)] focus-visible:bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,transparent)] focus-visible:outline-none before:absolute before:left-0 before:top-1/2 before:h-0 before:w-[2.5px] before:-translate-y-1/2 before:rounded-full before:bg-gradient-to-b before:from-[var(--accent-strong)] before:to-[color:color-mix(in_oklab,var(--accent-strong)_70%,transparent)] before:transition-all before:duration-200 hover:before:h-[70%]";
// Default row padding. Data Gaps overrides to a denser py-2 so its full-width
// two-column list reads less sparse (§Data Gaps).
const ROW_LINK_CLASS = `${ROW_LINK_BASE} py-3`;

// Hover-revealed structured action chip shared by review / work / data-gap rows
// (§8.6). The row itself is the link; this aria-hidden chip telegraphs the click
// target on hover/focus instead of a static chevron, then drops out at rest.
const HOVER_ACTION_CHIP_CLASS =
  "inline-flex items-center gap-0.5 whitespace-nowrap rounded-md border border-[color:color-mix(in_oklab,var(--accent)_30%,var(--border-card))] bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,var(--surface-raised))] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] leading-none text-[var(--accent-strong)] opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COUNTERPARTY_FALLBACK_TOKENS = new Set([
  "tenants",
  "tenant",
  "vendor",
  "counterparty",
  "supplier",
  "customer",
  "party",
]);

function MetaDataFlag({
  kind,
  raw,
}: {
  kind: "owner" | "counterparty";
  raw: string;
}) {
  const label = kind === "owner" ? "Unassigned" : raw;
  const tooltip =
    kind === "owner"
      ? `Owner missing — recorded as ${raw}`
      : `Counterparty name missing — currently shows "${raw}"`;
  return (
    <span
      title={tooltip}
      className="inline-flex items-center gap-1 rounded-md px-1 py-0 text-[11px] font-medium leading-[1.4]"
      style={{
        background: "color-mix(in oklab, var(--warning-soft) 18%, transparent)",
        color: "var(--warning-ink)",
      }}
    >
      <UserX aria-hidden className="h-2.5 w-2.5 shrink-0" strokeWidth={2} />
      {label}
    </span>
  );
}

function ReviewRows({ rows }: { rows: CoreDashboardReviewRow[] }) {
  return (
    <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)]">
      {rows.map((row) => {
        const counterpartyText = row.counterparty?.trim() || "";
        const counterpartyIsUnknown =
          counterpartyText &&
          COUNTERPARTY_FALLBACK_TOKENS.has(counterpartyText.toLowerCase());
        const ownerText = row.ownerLabel?.trim() || "";
        const ownerIsEmail = ownerText && EMAIL_RE.test(ownerText);
        const shownFieldNames = row.pendingFieldNames.slice(0, 4);
        const overflowFields = row.pendingFields - shownFieldNames.length;
        return (
          <li key={row.id}>
            <Link href={row.href} className={`${ROW_LINK_CLASS} min-h-[3rem] gap-3`}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold leading-[1.3] tracking-tight text-[var(--text-primary)]">
                  {row.title}
                </p>
                {/* Sentence-case metadata in quiet tertiary text, joined by a
                    canonical dot separator. Data-quality fallbacks
                    (Unassigned, unknown counterparty) still get the structured
                    warning flag for emphasis. */}
                <p className="mt-0.5 inline-flex max-w-full flex-wrap items-center gap-x-1.5 text-[11.5px] leading-[1.4] text-[var(--text-secondary)]">
                  {counterpartyText ? (
                    counterpartyIsUnknown ? (
                      <MetaDataFlag kind="counterparty" raw={counterpartyText} />
                    ) : (
                      <span className="truncate">{counterpartyText}</span>
                    )
                  ) : null}
                  {counterpartyText && ownerText ? (
                    <span aria-hidden className="ui-dot-sep">·</span>
                  ) : null}
                  {ownerText ? (
                    ownerIsEmail ? (
                      <MetaDataFlag kind="owner" raw={ownerText} />
                    ) : (
                      <span className="truncate">{ownerText}</span>
                    )
                  ) : null}
                </p>
                {/* Name the suggested fields awaiting review, not just the
                    count — the row's next action becomes "review THESE fields".
                    The named chips plus a "N more" overflow already convey both
                    which fields and how many, so the row carries no separate
                    trailing count (matching Data Gaps, §11.18). The no-names
                    fallback keeps the count visible as "N fields". */}
                {row.pendingFields > 0 ? (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    {shownFieldNames.map((name) => (
                      <FieldChip key={name} label={name} />
                    ))}
                    {overflowFields > 0 ? (
                      <FieldChip
                        variant="dashed"
                        label={shownFieldNames.length > 0 ? `${overflowFields} more` : `${row.pendingFields} fields`}
                        aria-label={`${overflowFields} more suggested field${overflowFields === 1 ? "" : "s"}`}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
              {/* The named field chips above are the source-backed review signal
                  (release AI boundary: suggested fields aren't trusted until a
                  human reviews them). The accent REVIEW chip appears on
                  hover/focus to telegraph the action (§8.6). */}
              <div className="flex shrink-0 items-center self-center">
                <span aria-hidden className={HOVER_ACTION_CHIP_CLASS}>
                  Review
                  <ChevronRight className="h-2.5 w-2.5" strokeWidth={1.85} />
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function DeadlineRows({ rows }: { rows: CoreDashboardDeadlineRow[] }) {
  return (
    <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)]">
      {rows.map((row) => {
        // Two-tier urgency — only genuine time-pressure (≤ 7 days) earns
        // warning ink so non-status dates stay neutral.
        const urgent = row.daysRemaining <= 7;
        const titleText = row.contractTitle?.trim() || row.label;
        const showEyebrow = Boolean(row.contractTitle?.trim());
        const countdown =
          row.daysRemaining === 0
            ? "TODAY"
            : row.daysRemaining === 1
              ? "1 DAY"
              : `${row.daysRemaining} DAYS`;
        return (
          <li key={row.id}>
            {/* Single row link to the contract record (mirrors the review row),
                so the hover affordance is a structured span instead of a second
                nested anchor. */}
            <Link
              href={row.href}
              aria-label={`${row.label}: ${titleText}`}
              className={`${ROW_LINK_CLASS} min-h-[3rem] gap-3`}
            >
              <div className="min-w-0 flex-1">
                {showEyebrow ? (
                  <p className="inline-flex items-center gap-1.5">
                    <span className="ui-caps-3 text-[10px] text-[var(--text-tertiary)]">{row.label}</span>
                    {/* Trust provenance (release AI boundary): a human-approved
                        field reads REVIEWED with the success tint (a real review
                        state); a date computed from approved fields stays a
                        quiet dashed COMPUTED chip, so it never reads as
                        equivalent to an approval. */}
                    {row.source === "derived" ? (
                      <FieldChip
                        variant="dashed"
                        label="Computed"
                        title="Computed from reviewed, source-backed dates"
                        className="text-[9px]"
                      />
                    ) : (
                      <FieldChip
                        label="Reviewed"
                        tone="success"
                        title="Reviewed, source-backed date"
                        className="text-[9px]"
                      />
                    )}
                  </p>
                ) : null}
                <p
                  title={titleText}
                  className="mt-0.5 truncate text-[13.5px] font-semibold leading-[1.3] tracking-tight text-[var(--text-primary)]"
                >
                  {titleText}
                </p>
                {row.ownerLabel ? (
                  <p className="mt-0.5 truncate text-[11.5px] leading-[1.4] text-[var(--text-secondary)]">
                    {row.ownerLabel}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2.5 self-center">
                {/* Open affordance revealed on hover/focus (§8.6); it always
                    occupies its slot (opacity-only), so the date column to its
                    right never shifts on hover (§10.9). */}
                <span aria-hidden className={HOVER_ACTION_CHIP_CLASS}>
                  Open
                  <ChevronRight className="h-2.5 w-2.5" strokeWidth={1.85} />
                </span>
                {/* Calendar date is the stable right-edge anchor; the countdown
                    is a caps sub-line. A min-width keeps "JUN 6" and "JUN 14"
                    the same box so the column edge holds (§10.9); urgent rows
                    tint both as one tonal unit. */}
                <div className="flex flex-col items-end gap-1 text-right">
                  <TimeChip
                    date={row.date}
                    format="calendar"
                    tone={urgent ? "warning" : undefined}
                    bordered
                    className="min-w-[3.75rem] justify-center"
                  />
                  <span
                    className="ui-caps-3 text-[10px] tabular-nums"
                    style={{ color: urgent ? "var(--warning-ink)" : "var(--text-tertiary)" }}
                  >
                    {countdown}
                  </span>
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function WorkRows({ rows }: { rows: CoreDashboardWorkRow[] }) {
  return (
    <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)]">
      {rows.map((row) => {
        const contractSuffix = row.contractTitle ? `: ${row.contractTitle}` : "";
        const cleanTitle =
          contractSuffix && row.title.endsWith(contractSuffix)
            ? row.title.slice(0, -contractSuffix.length)
            : row.title;
        const TypeIcon = workTypeIcon(row.type);
        const typeLabel = compactLabel(row.type, "Work");
        const statusLabel = compactLabel(row.status, "Open");
        const status = statusForWork(row);
        const ink = workStatusInk(status);
        // Blocked / overdue rows carry a persistent danger rail so risk reads
        // before the eye reaches the status badge.
        const isDanger =
          status === "blocked" || status === "overdue" || row.dueState === "overdue";
        const dueTone: StatTone | undefined = row.dueState === "overdue" ? "danger" : undefined;
        return (
          <li key={row.id}>
            <Link
              href={row.href}
              className={`${ROW_LINK_CLASS} min-h-[3rem] gap-3`}
            >
              {/* Persistent danger rail for blocked / overdue rows: a clear,
                  intentional semantic bar that mirrors the hover accent rail's
                  shape, replacing the faint inset shadow that read as
                  decorative (§Work Needing Action). */}
              {isDanger ? (
                <span
                  aria-hidden
                  className="pointer-events-none absolute left-0 top-1/2 h-[58%] w-[2.5px] -translate-y-1/2 rounded-full"
                  style={{
                    background:
                      "linear-gradient(to bottom, var(--danger-ink), color-mix(in oklab, var(--danger-ink) 65%, transparent))",
                  }}
                />
              ) : null}
              <span
                role="img"
                aria-label={typeLabel}
                title={typeLabel}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                style={{
                  background: `color-mix(in oklab, ${ink} 14%, var(--surface))`,
                  color: ink,
                }}
              >
                <TypeIcon className="h-3.5 w-3.5" strokeWidth={1.85} />
              </span>
              <div className="min-w-0 flex-1">
                {/* Allow up to 2 lines of title before truncating. */}
                <p
                  title={cleanTitle}
                  className="line-clamp-2 text-[13.5px] font-semibold leading-[1.3] tracking-tight text-[var(--text-primary)]"
                >
                  {cleanTitle}
                </p>
                {/* Status routes through the canonical badge; type and contract
                    stay quiet, joined by a dot separator. */}
                <p className="mt-1 inline-flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-1 text-[11.5px] leading-[1.4] text-[var(--text-tertiary)]">
                  <StatusBadge status={status} className="self-center">
                    {statusLabel}
                  </StatusBadge>
                  {/* Type is carried by the left icon medallion (now distinct per
                      work kind), so the redundant text label is dropped to
                      shorten the chip chain (§Work Needing Action). */}
                  {/* Owning contract as a structured chip (matches the activity
                      feed's target chip) instead of a dot-separated tail. */}
                  {row.contractTitle ? (
                    <FieldChip
                      label={row.contractTitle}
                      title={row.contractTitle}
                      className="max-w-[10rem] sm:max-w-[14rem]"
                    />
                  ) : null}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 self-center">
                {/* Contextual action verb (Resolve / Approve / Open work …)
                    revealed on hover/focus (§8.6). */}
                <span aria-hidden className={HOVER_ACTION_CHIP_CLASS}>
                  {row.actionLabel}
                  <ChevronRight className="h-2.5 w-2.5" strokeWidth={1.85} />
                </span>
                {row.dueAt ? (
                  <TimeChip date={row.dueAt} format="calendar" tone={dueTone} className="shrink-0" bordered />
                ) : null}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function DataGapRows({ rows }: { rows: CoreDashboardDataGapRow[] }) {
  return (
    // Full-width section → two dense columns of gap rows so the width is used
    // instead of leaving each row hugging the left edge.
    <ul className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
      {rows.map((row) => {
        const visibleFields = row.missing.slice(0, 3);
        const overflow = row.missing.slice(3);
        return (
          <li
            key={row.id}
            // Drop the bottom hairline on the last row of each column so the
            // card ends cleanly on its rounded edge instead of reading as
            // clipped at a cut line (§Data Gaps).
            className="border-b border-[color:color-mix(in_oklab,var(--border-subtle)_45%,transparent)] [&:nth-last-child(-n+2)]:border-b-0"
          >
            <Link href={row.href} className={`${ROW_LINK_BASE} min-h-[2.75rem] py-2`}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold leading-[1.3] tracking-tight text-[var(--text-primary)]">
                  {row.title}
                </p>
                {/* Each missing field is a structured bordered caps chip — the
                    fields themselves are identifiers, severity lives in the
                    right-side count. */}
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {visibleFields.map((field) => (
                    <FieldChip key={field} label={field} className="max-w-[12rem]" />
                  ))}
                  {overflow.length > 0 ? (
                    // Overflow as a numeric +N count pill — visually distinct
                    // from the field-identifier chips beside it (§Data Gaps).
                    <span
                      title={`Also missing: ${overflow.join(", ")}`}
                      aria-label={`${overflow.length} more field${overflow.length === 1 ? "" : "s"}: ${overflow.join(", ")}`}
                      className="inline-flex shrink-0 cursor-help items-center rounded-md border border-[var(--border-card)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-semibold leading-none tabular-nums text-[var(--text-tertiary)]"
                    >
                      +{overflow.length}
                    </span>
                  ) : null}
                </div>
              </div>
              {/* The visible field chips + "N more" already convey both which
                  gaps and how many, so the old trailing count chip was redundant
                  (§11.18) and read as disconnected. The FIX chip is revealed on
                  hover/focus to telegraph the action (§8.6). */}
              <div className="flex shrink-0 items-center gap-2 self-center">
                <span aria-hidden className={HOVER_ACTION_CHIP_CLASS}>
                  Fix
                  <ChevronRight className="h-2.5 w-2.5" strokeWidth={1.85} />
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ActivityRows({ rows }: { rows: CoreDashboardActivityRow[] }) {
  // Recent Activity renders through the canonical activity feed: icon + caps
  // verb + target chip + borderless time, instead of sentence-case prose with
  // a detached bordered time pill.
  const items: ActivityFeedItem[] = rows.map((row) => {
    const visual = activityVisual(row);
    return {
      id: row.id,
      icon: visual.icon,
      tone: visual.tone,
      verb: visual.verb,
      target: row.contractTitle ?? undefined,
      timestamp: row.occurredAt ?? "",
      href: row.href,
    };
  });
  return <ActivityFeed items={items} emptyLabel="No recent activity" />;
}

function SectionBody({ section }: { section: CoreDashboardSection }) {
  if (section.rows.length === 0) return <EmptySectionRow>{section.emptyState}</EmptySectionRow>;
  if (section.key === "review_queue") return <ReviewRows rows={section.rows} />;
  if (section.key === "upcoming_deadlines") return <DeadlineRows rows={section.rows} />;
  if (section.key === "work_needing_action") return <WorkRows rows={section.rows} />;
  if (section.key === "data_gaps") return <DataGapRows rows={section.rows} />;
  return <ActivityRows rows={section.rows} />;
}

function DashboardSectionView({ section }: { section: CoreDashboardSection }) {
  return (
    <SectionShell section={section}>
      <SectionBody section={section} />
    </SectionShell>
  );
}

function getSection(model: CoreDashboardModel, key: DashboardSectionKey): CoreDashboardSection {
  const section = model.sections.find((candidate) => candidate.key === key);
  if (!section) {
    throw new Error(`Missing Core dashboard section: ${key}`);
  }
  return section;
}

export function CoreDashboard({ model }: { model: CoreDashboardModel }) {
  const visiblePartialErrors = getCoreDashboardVisiblePartialErrors(model.partialErrors);
  const orderedSections: CoreDashboardSection[] = [
    getSection(model, "review_queue"),
    getSection(model, "upcoming_deadlines"),
    getSection(model, "work_needing_action"),
    getSection(model, "data_gaps"),
    getSection(model, "recent_activity"),
  ];
  // Two-column operational/summary split, then Data Gaps spans full width
  // beneath it. Keeping the long Data Gaps list out of a half-width column
  // avoids the tall empty void that otherwise opens beside it once the columns'
  // heights diverge.
  const sectionByKey = new Map<DashboardSectionKey, CoreDashboardSection>(
    orderedSections.map((section) => [section.key, section])
  );
  const mainColumn: DashboardSectionKey[] = ["review_queue", "work_needing_action"];
  const railColumn: DashboardSectionKey[] = ["upcoming_deadlines", "recent_activity"];
  const fullWidthColumn: DashboardSectionKey[] = ["data_gaps"];

  return (
    // Constrain the dashboard to a composed max width (the shared dashboard
    // layout caps at 1440px — this page reads better tighter) and switch to a
    // denser gap-5 rhythm so the metric strip sits closer to the first panel row.
    <div className="ui-page-stack mx-auto w-full max-w-[1200px] gap-5">
      <DashboardPageHeader
        icon={<Files className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
        eyebrow="Dashboard"
        title={DASHBOARD_TITLE}
        lead="Review queues, renewal deadlines, open work, evidence, and reports across your contracts."
        // Vertically center the action cluster against the multi-line title
        // block so the two CTAs read as attached to the title instead of
        // floating detached in the top-right corner (§Header).
        actionsAlign="center"
        // Canonical flat page identity (§2.4 / §5.1): 40px product icon-tile +
        // fixed "Dashboard" eyebrow. The workspace identity lives in the
        // app-shell chrome, so the header uses the product icon-tile rather than
        // a workspace monogram. A tracked-contracts count chip attaches to the
        // h1 — portfolio size is distinct from the subset metric cards below and
        // pulls header weight toward center so the title + actions read as one
        // composed cluster instead of two far-apart ends.
        titleSuffix={
          model.totalContracts > 0 ? (
            <KeyValueChip label="Tracked" value={model.totalContracts} />
          ) : undefined
        }
        actions={
          <>
            {/* Paired button treatment: primary + secondary share the same
                pill scale so the two contract-intake affordances read as one
                cluster, top-aligned with the title block. */}
            <Link
              href="/contracts/new"
              className="ui-btn-primary inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-semibold"
            >
              <UploadCloud className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
              {DASHBOARD_PRIMARY_CTA}
            </Link>
            <Link
              href="/contracts/bulk"
              prefetch={false}
              className="ui-btn-secondary inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-semibold"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
              {DASHBOARD_SECONDARY_CTA}
            </Link>
          </>
        }
      />

      <ImportStatusNotice status={model.importStatus} />

      <PartialDataNotice count={visiblePartialErrors.length} />

      {model.showPlanBanner ? (
        <div className="ui-alert-warning flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[14px] leading-relaxed">
            <span className="font-semibold">Subscription required</span> to create or edit contracts.
          </p>
          <Link href="/settings/billing" className="ui-btn-secondary shrink-0 px-4 py-2 text-[12.5px]">
            Billing
          </Link>
        </div>
      ) : null}

      {/* Operational content grouped on a tighter gap-4 rhythm so the metric
          strip sits closer to the first panel row, while the header + alerts
          above keep the looser gap-5 stack rhythm (§Page Frame). */}
      <div className="flex min-w-0 flex-col gap-4">
        <SignalSurface>
          {model.topCards.map((card) => (
            <TopSignal key={card.key} card={card} />
          ))}
        </SignalSurface>

        <div className="grid min-w-0 items-start gap-4 xl:grid-cols-12">
          <div className="flex min-w-0 flex-col gap-4 xl:col-span-7">
            {mainColumn.map((key) => {
              const section = sectionByKey.get(key);
              return section ? <DashboardSectionView key={key} section={section} /> : null;
            })}
          </div>
          <div className="flex min-w-0 flex-col gap-4 xl:col-span-5">
            {railColumn.map((key) => {
              const section = sectionByKey.get(key);
              return section ? <DashboardSectionView key={key} section={section} /> : null;
            })}
          </div>
        </div>

        {fullWidthColumn.map((key) => {
          const section = sectionByKey.get(key);
          return section ? <DashboardSectionView key={key} section={section} /> : null;
        })}
      </div>
    </div>
  );
}
