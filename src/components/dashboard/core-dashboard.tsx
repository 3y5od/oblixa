import Link from "next/link";
import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  Calendar,
  CalendarClock,
  Check,
  CheckSquare,
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
import { DashboardActionRow } from "@/components/dashboard/dashboard-action-row";
import { DashboardPanel } from "@/components/dashboard/dashboard-panel";
import { DashboardStickyToolbar } from "@/components/dashboard/dashboard-sticky-toolbar";
import { MetricStrip } from "@/components/dashboard/metric-strip";
import { ActionChip } from "@/components/ui/action-chip";
import { ActivityFeed, type ActivityFeedItem } from "@/components/ui/activity-feed";
import { ChipPair } from "@/components/ui/chip-pair";
import { CountChip } from "@/components/ui/count-chip";
import { DashboardMetricCell } from "@/components/ui/dashboard-metric-cell";
import { EntityChip } from "@/components/ui/entity-chip";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { FieldChip } from "@/components/ui/field-chip";
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
  CoreDashboardDataGapCategory,
  CoreDashboardDataGapSummary,
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

const TOP_CARD_DESCRIPTION: Record<DashboardTopCardKey, string> = {
  needs_review: "Confirm suggested dates, owners, and terms before they are used elsewhere.",
  upcoming_deadlines: "Renewal, notice, end, or effective dates in the next 90 days.",
  blocked_work: "Tasks waiting for an answer, approval, or file before work can continue.",
  missing_owners: "Assign an owner so reminders and follow-up have a clear responsible person.",
  open_exceptions: "Open contract problems that need an owner, decision, or resolution.",
  evidence_requested: "Open requests for files or confirmation tied to contract requirements.",
};

const SECTION_DESCRIPTION: Record<DashboardSectionKey, string> = {
  review_queue: "Confirm suggested dates, owners, and terms before reminders and reports rely on them.",
  upcoming_deadlines: "Approved or computed contract dates that may need action soon.",
  work_needing_action: "Tasks that need a response, decision, approval, file, or owner.",
  data_gaps: "Missing owners, dates, or counterparties that weaken routing and reports.",
  recent_activity: "Recent confirmed changes across contracts, tasks, evidence, and reports.",
};

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
  const raw = String(value || fallback).replace(/_/g, " ").trim();
  const normalized = raw.toLowerCase();
  const userLabels: Record<string, string> = {
    blocked: "Needs response",
    exception: "Problem",
    "contract task": "Task",
    "unassigned work": "Unassigned task",
  };
  if (userLabels[normalized]) return userLabels[normalized];
  if (raw.length === 0) return "";
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

/** Pick a lucide icon for a task-row's type tag (Task / Approval / etc.).
 *  Pattern match on the compactLabel so the row's kind reads at scan time
 *  without needing a separate chip column. */
function workTypeIcon(type: string): LucideIcon {
  const t = type.toLowerCase();
  if (t.includes("approval")) return BadgeCheck;
  if (t.includes("obligation")) return Calendar;
  if (t.includes("exception") || t.includes("issue")) return AlertTriangle;
  if (t.includes("evidence")) return ShieldAlert;
  // Renewal checkpoints get their own glyph so they no longer collide with
  // contract tasks — letting the icon carry the work kind without a text label.
  if (t.includes("renewal") || t.includes("checkpoint")) return CalendarClock;
  return ListChecks;
}

/** Contextual hover verb for a work row so the affordance says what clicking
 *  does (Resolve / Approve / Review evidence) instead of a generic "Open". */
function workHoverVerb(row: CoreDashboardWorkRow): string {
  if (row.status === "blocked" || row.dueState === "overdue") return "Resolve";
  const t = row.type.toLowerCase();
  if (t.includes("approval")) return "Approve";
  if (t.includes("evidence")) return "Review evidence";
  if (t.includes("exception")) return "Resolve";
  if (t.includes("renewal") || t.includes("checkpoint")) return "Review";
  return "Open task";
}

/** Short, specific fix verb for a data-gap row's primary missing field
 *  ("Fix owner" / "Fix date" / "Fix counterparty") instead of echoing the raw
 *  field label. */
function gapFixLabel(field: string | undefined): string {
  const f = (field ?? "").toLowerCase();
  if (f.includes("owner")) return "Fix owner";
  if (f.includes("counterparty")) return "Fix counterparty";
  if (f.includes("date") || f.includes("notice") || f.includes("renewal")) return "Fix date";
  if (f.includes("value")) return "Fix value";
  if (f.includes("status")) return "Fix status";
  return "Fix";
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
  // Thin adapter over the shared DashboardMetricCell primitive: this file owns
  // the per-card icon config; tone comes from the model and the primitive
  // owns the cell anatomy (reserved tone-dot, 28px medallion, zero-state).
  return (
    <DashboardMetricCell
      href={card.href}
      label={card.label}
      description={TOP_CARD_DESCRIPTION[card.key]}
      value={card.count}
      tone={card.tone}
      icon={TOP_CARD_ICON[card.key]}
    />
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
  const ariaId = `${section.key.replace(/_/g, "-")}-h`;
  // Honest "showing N of total" so the header's total count never reads as if
  // the visible rows explained all of it (§Data Freshness).
  const footer =
    section.rows.length > 0 && section.count > section.rows.length ? (
      <p className="ui-caps-3 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_45%,transparent)] px-4 py-2 text-[10px] tabular-nums text-[var(--text-tertiary)]">
        Showing {section.rows.length} of {section.count}
      </p>
    ) : null;
  return (
    <DashboardPanel
      titleId={ariaId}
      icon={SECTION_ICONS[section.key]}
      title={section.title}
      description={SECTION_DESCRIPTION[section.key]}
      count={section.count}
      action={
        section.actionLabel
          ? { label: section.actionLabel, href: section.href }
          : undefined
      }
      footer={footer}
    >
      {children}
    </DashboardPanel>
  );
}

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

function OverflowCount({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center rounded-md border border-[var(--border-card)] bg-[var(--surface)] px-1.5 py-0.5 text-[10.5px] font-semibold uppercase leading-none tracking-[0.12em] text-[var(--text-primary)] tabular-nums">
      +{value}
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
        // Cap visible pending-field chips at 3, then "+N" — four chips crowd
        // the row at the rail's width.
        const shownFieldNames = row.pendingFieldNames.slice(0, 3);
        const overflowFields = row.pendingFields - shownFieldNames.length;
        return (
          <li key={row.id}>
            <DashboardActionRow
              href={row.href}
              hoverAction="Confirm details"
              leading={
                // Neutral review medallion so review rows share the same left
                // anchor as work/deadline rows instead of starting flat at text.
                <span
                  aria-hidden
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                  style={{
                    background: "color-mix(in oklab, var(--surface-muted) 65%, var(--surface))",
                    color: "var(--text-tertiary)",
                  }}
                >
                  <CheckSquare className="h-3.5 w-3.5" strokeWidth={1.85} />
                </span>
              }
              title={
                <p className="truncate text-[13.5px] font-semibold leading-[1.3] tracking-tight text-[var(--text-primary)]">
                  {row.title}
                </p>
              }
              meta={
                <>
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
                      count — the named identifier chips + "+N" overflow convey
                      both which fields and how many (§11.18). */}
                  {row.pendingFields > 0 ? (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      {shownFieldNames.map((name) => (
                        <FieldChip key={name} label={name} />
                      ))}
                      {shownFieldNames.length === 0 ? (
                        <CountChip value={row.pendingFields} />
                      ) : overflowFields > 0 ? (
                        <OverflowCount value={overflowFields} />
                      ) : null}
                    </div>
                  ) : null}
                </>
              }
            />
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
        // Compact countdown keeps the right column narrow and stable across
        // "TODAY" / "3D" / "19D" (§Upcoming Dates).
        const countdown = row.daysRemaining === 0 ? "TODAY" : `${row.daysRemaining}D`;
        return (
          <li key={row.id}>
            {/* Single row link to the contract record (mirrors the review row),
                so the hover affordance is a structured span instead of a second
                nested anchor. */}
            <DashboardActionRow
              href={row.href}
              ariaLabel={`${row.label}: ${titleText}`}
              // Persistent warning rail for genuinely urgent deadlines (≤ 7 days)
              // so time-pressure reads before the date chip; non-urgent dates
              // stay neutral.
              rail={urgent ? "warning" : undefined}
              hoverAction="Open"
              eyebrow={
                showEyebrow ? (
                  // Date type + trust provenance as one tight ChipPair (§2.6 /
                  // §10.8): COMPUTED stays neutral so a date derived from
                  // approved fields never reads as human-approved, while a
                  // REVIEWED source-backed date carries the success tint.
                  <ChipPair
                    primary={row.label}
                    secondary={row.source === "derived" ? "Computed" : "Reviewed"}
                    tone={row.source === "derived" ? undefined : "success"}
                  />
                ) : undefined
              }
              title={
                <p
                  title={titleText}
                  className="mt-0.5 truncate text-[13.5px] font-semibold leading-[1.3] tracking-tight text-[var(--text-primary)]"
                >
                  {titleText}
                </p>
              }
              meta={
                row.ownerLabel ? (
                  // Mirror the review row: an email used as the owner fallback is a
                  // data-quality gap, so flag it as Unassigned instead of printing
                  // a raw address; real names render quietly.
                  EMAIL_RE.test(row.ownerLabel.trim()) ? (
                    <p className="mt-0.5">
                      <MetaDataFlag kind="owner" raw={row.ownerLabel} />
                    </p>
                  ) : (
                    <p className="mt-0.5 truncate text-[11.5px] leading-[1.4] text-[var(--text-secondary)]">
                      {row.ownerLabel}
                    </p>
                  )
                ) : undefined
              }
              trailing={
                // Calendar date is the stable right-edge anchor; the countdown is
                // a caps sub-line. A min-width keeps "JUN 6" / "JUN 14" the same
                // box so the column edge holds (§10.9); urgent rows tint both.
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
              }
            />
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
        const typeLabel = compactLabel(row.type, "Task");
        const statusLabel = compactLabel(row.status, "Open");
        const status = statusForWork(row);
        const ink = workStatusInk(status);
        // Needs-input / overdue rows carry a persistent danger rail so risk reads
        // before the eye reaches the status badge.
        const isDanger =
          status === "blocked" || status === "overdue" || row.dueState === "overdue";
        const dueTone: StatTone | undefined = row.dueState === "overdue" ? "danger" : undefined;
        return (
          <li key={row.id}>
            <DashboardActionRow
              href={row.href}
              // Persistent danger rail for needs-input / overdue rows so risk reads
              // before the status badge (§Work Needing Action).
              rail={isDanger ? "danger" : undefined}
              // Contextual action verb (Resolve / Approve / Review evidence), not
              // a generic "Open" (§8.6).
              hoverAction={workHoverVerb(row)}
              leading={
                <span
                  role="img"
                  aria-label={typeLabel}
                  title={typeLabel}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                  style={{
                    // The medallion carries the work KIND (glyph); status is the
                    // badge's job. Only danger rows tint it, so the row reads calm
                    // until something is genuinely at risk (§Work Needing Action).
                    background: isDanger
                      ? `color-mix(in oklab, ${ink} 14%, var(--surface))`
                      : "color-mix(in oklab, var(--surface-muted) 65%, var(--surface))",
                    color: isDanger ? ink : "var(--text-tertiary)",
                  }}
                >
                  <TypeIcon className="h-3.5 w-3.5" strokeWidth={1.85} />
                </span>
              }
              title={
                // Allow up to 2 lines of title before truncating.
                <p
                  title={cleanTitle}
                  className="line-clamp-2 text-[13.5px] font-semibold leading-[1.3] tracking-tight text-[var(--text-primary)]"
                >
                  {cleanTitle}
                </p>
              }
              meta={
                // Status routes through the canonical badge; type and contract
                // stay quiet. The owning contract is a case-preserving EntityChip
                // — a proper name, not an identifier (§11.9).
                <p className="mt-1 inline-flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-1 text-[11.5px] leading-[1.4] text-[var(--text-tertiary)]">
                  <StatusBadge status={status} className="self-center">
                    {statusLabel}
                  </StatusBadge>
                  <span className="ui-caps-3 self-center text-[10px] text-[var(--text-tertiary)]">
                    {typeLabel}
                  </span>
                  {row.contractTitle ? (
                    <EntityChip
                      name={row.contractTitle}
                      className="max-w-[10rem] sm:max-w-[14rem]"
                    />
                  ) : null}
                </p>
              }
              trailing={
                // Reserve the date slot even when a work item has no due date so
                // the right column stays aligned across dated/undated rows (§10.9).
                row.dueAt ? (
                  <TimeChip date={row.dueAt} format="calendar" tone={dueTone} className="shrink-0" bordered />
                ) : (
                  <span aria-hidden className="inline-block w-[3.75rem] shrink-0" />
                )
              }
            />
          </li>
        );
      })}
    </ul>
  );
}

// Representative missing field per category, so the hover verb reads "Fix owner"
// / "Fix date" / "Fix counterparty" via the shared gapFixLabel helper.
const CATEGORY_FIX_FIELD: Record<CoreDashboardDataGapCategory["key"], string> = {
  owners: "Owner",
  dates: "Renewal date",
  counterparties: "Counterparty",
};

function DataGapBoard({
  categories,
  summary,
}: {
  categories: CoreDashboardDataGapCategory[];
  summary: CoreDashboardDataGapSummary;
}) {
  // Category columns (Owners / Dates / Counterparties), each fed its OWN top-N
  // rows by the model so a high-volume category never starves the others. Active
  // categories take the full-width columns; all-clear categories collapse to
  // compact success tiles instead of eating an empty column (§Data Gaps / §10.10).
  const active = categories.filter((category) => category.rows.length > 0);
  const clear = categories.filter((category) => category.rows.length === 0);
  const activeCols =
    active.length >= 3
      ? "md:grid-cols-3"
      : active.length === 2
        ? "md:grid-cols-2"
        : "md:grid-cols-1";
  return (
    <div>
      {summary.oldestUpdatedAt ? (
        <div className="mb-2 flex items-center justify-end gap-1.5 px-1">
          <span className="ui-caps-3 text-[10px] text-[var(--text-tertiary)]">Oldest gap</span>
          <TimeChip date={summary.oldestUpdatedAt} bordered className="shrink-0" />
        </div>
      ) : null}
      <div
        className={`grid grid-cols-1 gap-y-5 ${activeCols} md:gap-y-0 md:divide-x md:divide-[color:color-mix(in_oklab,var(--border-subtle)_40%,transparent)]`}
      >
        {active.map((category, index) => (
          <div
            key={category.key}
            className={`min-w-0 ${
              active.length === 1
                ? ""
                : index === 0
                  ? "md:pr-5"
                  : index === active.length - 1
                    ? "md:pl-5"
                    : "md:px-5"
            }`}
          >
            <div className="mb-1 flex items-center gap-1.5 px-1">
              <span className="ui-caps-2 text-[10px] text-[var(--text-tertiary)]">
                {category.label}
              </span>
              <CountChip value={category.total} emphasis="strong" tone="warning" />
            </div>
            <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_45%,transparent)]">
              {category.rows.map((row) => {
                const visibleFields = row.missing.slice(0, 2);
                const overflow = row.missing.slice(2);
                return (
                  <li key={row.id}>
                    <DashboardActionRow
                      href={row.href}
                      minHeightClassName="min-h-[2.5rem]"
                      paddingClassName="py-1.5"
                      hoverAction={gapFixLabel(CATEGORY_FIX_FIELD[category.key])}
                      title={
                        <p className="truncate text-[13px] font-semibold leading-[1.3] tracking-tight text-[var(--text-primary)]">
                          {row.title}
                        </p>
                      }
                      meta={
                        <div className="mt-0.5 flex flex-wrap items-center gap-1">
                          {visibleFields.map((field) => (
                            <FieldChip key={field} label={field} className="max-w-[10rem]" />
                          ))}
                          {overflow.length > 0 ? (
                            <span
                              title={`Also missing: ${overflow.join(", ")}`}
                              aria-label={`${overflow.length} more detail${overflow.length === 1 ? "" : "s"}: ${overflow.join(", ")}`}
                              className="inline-flex shrink-0 cursor-help"
                            >
                              <OverflowCount value={overflow.length} />
                            </span>
                          ) : null}
                        </div>
                      }
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      {clear.length > 0 ? (
        // All-clear categories as compact success tiles (§10.10) — affirmative,
        // not an empty column.
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_45%,transparent)] px-1 pt-3">
          {clear.map((category) => (
            <span
              key={category.key}
              className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1"
              style={{
                borderColor: "color-mix(in oklab, var(--success-ink) 24%, var(--border-card))",
                background: "color-mix(in oklab, var(--success-ink) 8%, var(--surface))",
              }}
            >
              <Check
                className="h-3 w-3 shrink-0"
                strokeWidth={2.4}
                style={{ color: "var(--success-ink)" }}
                aria-hidden
              />
              <span
                className="ui-caps-2 text-[10px]"
                style={{ color: "color-mix(in oklab, var(--success-ink) 70%, var(--text-secondary))" }}
              >
                {category.label}
              </span>
              <span
                className="ui-caps-3 text-[9.5px]"
                style={{ color: "color-mix(in oklab, var(--success-ink) 55%, var(--text-tertiary))" }}
              >
                All clear
              </span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
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
  if (section.key === "data_gaps")
    return <DataGapBoard categories={section.categories} summary={section.summary} />;
  return <ActivityRows rows={section.rows} />;
}

function DashboardSectionView({ section }: { section: CoreDashboardSection }) {
  return (
    <SectionShell section={section}>
      <SectionBody section={section} />
    </SectionShell>
  );
}

function DashboardSectionGroup({
  id,
  eyebrow,
  children,
}: {
  id: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="min-w-0">
      <h2
        id={id}
        className="landing-eyebrow-dot ui-caps-2 mb-2 px-1 text-[var(--accent-strong)]"
      >
        {eyebrow}
      </h2>
      {children}
    </section>
  );
}

function getSection(model: CoreDashboardModel, key: DashboardSectionKey): CoreDashboardSection {
  const section = model.sections.find((candidate) => candidate.key === key);
  if (!section) {
    throw new Error(`Missing Core dashboard section: ${key}`);
  }
  return section;
}

function EmptyDashboard({ importStatus }: { importStatus: CoreDashboardImportStatus }) {
  return (
    <div className="ui-page-stack mx-auto w-full max-w-[1440px] gap-4">
      <DashboardPageHeader
        icon={<Files className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
        eyebrow="Dashboard"
        title={DASHBOARD_TITLE}
        lead="Upload signed contracts or import your tracker to start turning them into confirmed owners, dates, tasks, evidence, and reports."
      />
      <ImportStatusNotice status={importStatus} />
      {/* Single premium activation surface (§8.1) — a brand-new workspace gets
          one clear next step, not a strip of zero metrics and empty queues. */}
      <section className="ui-card-raised relative overflow-hidden rounded-2xl border p-6 sm:p-8">
        <div
          aria-hidden
          className="landing-corner-ring"
          style={{ top: "-2.25rem", right: "-2.25rem", width: "7rem", height: "7rem" }}
        />
        <div className="flex items-start gap-4">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_36%,var(--surface-raised))] text-[var(--accent-strong)] shadow-[var(--shadow-1)]">
            <UploadCloud className="h-5 w-5" strokeWidth={1.85} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p>
              <span className="landing-eyebrow-dot ui-caps-2 text-[var(--accent-strong)]">
                Get started
              </span>
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-[1.4rem]">
              Add your first signed contracts
            </h2>
            <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
              Confirmed, source-backed details become owners, dates, tasks, evidence,
              and exportable reports. Start with a bounded set — you don&apos;t need
              to migrate everything at once.
            </p>
            <div className="mt-5 flex flex-wrap gap-x-2 gap-y-2">
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
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export function CoreDashboard({ model }: { model: CoreDashboardModel }) {
  // Brand-new workspace: one activation surface instead of a strip of zero
  // metrics and empty queues (§Empty And Degraded States).
  if (model.totalContracts === 0) {
    return <EmptyDashboard importStatus={model.importStatus} />;
  }
  const visiblePartialErrors = getCoreDashboardVisiblePartialErrors(model.partialErrors);
  const needsReviewCount =
    model.topCards.find((card) => card.key === "needs_review")?.count ?? 0;
  const orderedSections: CoreDashboardSection[] = [
    getSection(model, "review_queue"),
    getSection(model, "work_needing_action"),
    getSection(model, "upcoming_deadlines"),
    getSection(model, "recent_activity"),
    getSection(model, "data_gaps"),
  ];
  const sectionByKey = new Map<DashboardSectionKey, CoreDashboardSection>(
    orderedSections.map((section) => [section.key, section])
  );
  const prioritySections: DashboardSectionKey[] = ["review_queue", "work_needing_action"];
  const monitoringSections: DashboardSectionKey[] = ["upcoming_deadlines", "recent_activity"];
  const cleanupSections: DashboardSectionKey[] = ["data_gaps"];

  return (
    // Fill the dashboard layout's natural width (the shared layout caps at
    // 1440px) so the page stops reading as a narrow island inside empty canvas,
    // and tighten the outer stack to gap-4 so the header, alerts, and metric
    // strip sit closer together (§Dashboard Frame).
    <div className="ui-page-stack mx-auto w-full max-w-[1440px] gap-4">
      <DashboardPageHeader
        icon={<Files className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
        eyebrow="Dashboard"
        title={DASHBOARD_TITLE}
        lead="Review contract details, track renewal deadlines, manage tasks, collect evidence, and export reports."
        // Vertically center the action cluster against the multi-line title
        // block so the two CTAs read as attached to the title instead of
        // floating detached in the top-right corner (§Header).
        actionsAlign="center"
        // Canonical flat page identity (§2.4 / §5.1): 40px product icon-tile +
        // fixed "Dashboard" eyebrow. The workspace contract count lives in the
        // right-side meta strip as a structured count chip — a real dt/dd group
        // (valid <dl> content, not a bare span) that mirrors the /contracts
        // header chip so the two Core surfaces share header chrome (§10.16).
        metaStrip={
          model.totalContracts > 0 ? (
            <div className="inline-flex items-center">
              <dt className="sr-only">Signed contracts in workspace</dt>
              <dd className="inline-flex items-center gap-1.5 rounded-full border border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] bg-[var(--surface-raised)] px-2.5 py-1 shadow-[var(--shadow-1)]">
                <span className="font-mono text-[12.5px] font-semibold tabular-nums text-[var(--text-primary)]">
                  {model.totalContracts}
                </span>
                <span className="ui-caps-2 text-[10px] text-[var(--text-tertiary)]">
                  {model.totalContracts === 1 ? "Contract" : "Contracts"}
                </span>
              </dd>
            </div>
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

      {/* Scroll-revealed condensed action bar — additive chrome that keeps
          Upload / Import / Review / Search reachable once the header scrolls
          away. Fixed-positioned, so it adds no flow space here. */}
      <DashboardStickyToolbar
        totalContracts={model.totalContracts}
        needsReview={needsReviewCount}
      />

      <ImportStatusNotice status={model.importStatus} />

      <PartialDataNotice count={visiblePartialErrors.length} />

      {model.showPlanBanner ? (
        <div
          role="status"
          className="ui-alert-warning flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          {/* Same compact anatomy as the import notice: tone medallion + strong
              headline over a quiet detail line + a structured action chip. */}
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
              style={{
                borderColor: "color-mix(in oklab, var(--warning-ink) 30%, var(--border-card))",
                background: "color-mix(in oklab, var(--warning-ink) 14%, var(--surface-raised))",
                color: "var(--warning-ink)",
              }}
            >
              <CircleAlert className="h-4 w-4" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold leading-snug">Subscription required</p>
              <p className="mt-0.5 text-[12px] leading-snug">
                Creating or editing contracts needs an active subscription.
              </p>
            </div>
          </div>
          <ActionChip
            verb="Manage billing"
            href="/settings/billing"
            tone="warning"
            className="shrink-0 self-start sm:self-center"
          />
        </div>
      ) : null}

      {/* Operational content grouped on a tight gap-3 rhythm so the metric
          strip and panels scan as one dense block, while the header + alerts
          above keep the looser gap-5 stack rhythm for identity breathing room
          (§Page Frame). */}
      <div className="flex min-w-0 flex-col gap-3">
        <MetricStrip>
          {model.topCards.map((card) => (
            <TopSignal key={card.key} card={card} />
          ))}
        </MetricStrip>

        <DashboardSectionGroup
          id="dashboard-priority-work"
          eyebrow="Priority work"
        >
          <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(22rem,5fr)]">
            {prioritySections.map((key) => {
              const section = sectionByKey.get(key);
              return section ? <DashboardSectionView key={key} section={section} /> : null;
            })}
          </div>
        </DashboardSectionGroup>

        <DashboardSectionGroup
          id="dashboard-monitoring"
          eyebrow="Monitoring"
        >
          <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(22rem,4fr)]">
            {monitoringSections.map((key) => {
              const section = sectionByKey.get(key);
              return section ? <DashboardSectionView key={key} section={section} /> : null;
            })}
          </div>
        </DashboardSectionGroup>

        <DashboardSectionGroup
          id="dashboard-cleanup"
          eyebrow="Data quality"
        >
          {cleanupSections.map((key) => {
            const section = sectionByKey.get(key);
            return section ? <DashboardSectionView key={key} section={section} /> : null;
          })}
        </DashboardSectionGroup>
      </div>
    </div>
  );
}
