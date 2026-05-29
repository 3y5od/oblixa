import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Calendar,
  CalendarClock,
  Check,
  CheckSquare,
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

function titleCasePlan(planTier: string | null): string | null {
  if (!planTier) return null;
  return `${planTier.charAt(0).toUpperCase()}${planTier.slice(1).toLowerCase()}`;
}

// Per-card semantic tone — only true time-pressure (upcoming deadlines) and
// genuine blockage (blocked work, open exceptions) earn loud warning/danger
// ink. Data-quality cards (missing owners, evidence requested) get neutral
// secondary ink so amber stops dominating the strip.
const CARD_TONE_INK: Record<DashboardTopCardKey, string> = {
  needs_review: "var(--accent-strong)",
  upcoming_deadlines: "var(--warning-ink)",
  blocked_work: "var(--danger-ink)",
  missing_owners: "var(--text-secondary)",
  open_exceptions: "var(--danger-ink)",
  evidence_requested: "var(--text-secondary)",
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
  if (text.includes("owner")) return { verb: CAPS_VERBS.changed, icon: Users };
  if (text.includes("complet") || text.includes("done"))
    return { verb: CAPS_VERBS.completed, icon: CheckSquare, tone: "success" };
  if (text.includes("evidence") || text.includes("receiv"))
    return { verb: CAPS_VERBS.received, icon: ShieldCheck };
  if (text.includes("export")) return { verb: CAPS_VERBS.exported, icon: FileSpreadsheet };
  if (text.includes("sign")) return { verb: CAPS_VERBS.signed, icon: BadgeCheck, tone: "success" };
  const fallback = (row.label.trim().split(/\s+/)[0] || "Activity").toUpperCase();
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
  // §2.11 stat cell: tone dot + caps label / number / unit chip. Active cells
  // carry one status marker (the dot) and the tone-colored number — no second
  // icon medallion. Zero cells swap the dot's emphasis for a success Check
  // medallion beside a muted-green number, with no full-cell tint.
  return (
    <Link
      href={card.href}
      aria-label={`${card.label}: ${card.count}. ${card.actionLabel}.`}
      className="group relative flex min-w-0 flex-col gap-1 rounded-lg px-3 py-2.5 transition-colors duration-150 hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_8%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:color-mix(in_oklab,var(--accent)_45%,transparent)]"
    >
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="relative inline-flex h-2 w-2 min-w-[0.625rem] shrink-0 items-center justify-center"
        >
          {isZero ? (
            <span
              className="relative h-1.5 w-1.5 rounded-full"
              style={{
                background: "color-mix(in oklab, var(--success-ink) 60%, transparent)",
              }}
            />
          ) : (
            <>
              <span
                className="absolute inset-0 rounded-full"
                style={{ background: `color-mix(in oklab, ${ink} 30%, transparent)` }}
              />
              <span
                className="relative h-1.5 w-1.5 rounded-full"
                style={{ background: ink }}
              />
            </>
          )}
        </span>
        <span className="ui-caps-2 text-[10px] text-[var(--text-tertiary)]">{card.label}</span>
      </span>
      <span className="mt-0.5 inline-flex items-center gap-2">
        {isZero ? (
          <span
            aria-hidden
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border"
            style={{
              borderColor: "color-mix(in oklab, var(--success-ink) 28%, var(--border-card))",
              background: "color-mix(in oklab, var(--success-ink) 12%, var(--surface))",
              color: "var(--success-ink)",
            }}
          >
            <Check className="h-3 w-3" strokeWidth={2.2} />
          </span>
        ) : null}
        <span
          className="text-[1.75rem] font-semibold leading-none tabular-nums tracking-[-0.02em]"
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
      // column on mobile.
      className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)]"
    >
      <div className="grid grid-cols-1 gap-0.5 p-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {children}
      </div>
    </section>
  );
}

function PartialDataNotice({ count }: { count: number }) {
  if (count <= 0) return null;
  // Standalone filled warning banner tied to the import workflow — not a
  // detached footer capsule under the metric strip. Mirrors the plan banner so
  // the dashboard's two system alerts read with the same weight.
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Dashboard partial data state"
      className="ui-alert-warning flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
        <p className="text-[13px] leading-snug">
          <span className="font-semibold">
            {count === 1 ? "1 import" : `${count} imports`} still processing.
          </span>{" "}
          Some counts may be incomplete until they finish.
        </p>
      </div>
      <ActionChip verb="Manage imports" href="/contracts/bulk" tone="warning" className="shrink-0" />
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
      // Bordered panel so stacked sections in a column read as distinct
      // surfaces. The header rule + row dividers carry the containment.
      className="min-w-0 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)] px-4 py-3">
        <h2
          id={ariaId}
          className="ui-caps-2 flex min-w-0 items-center gap-2 text-[11px] text-[var(--text-secondary)]"
        >
          <Icon
            className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]"
            strokeWidth={1.85}
            aria-hidden
          />
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
const ROW_LINK_CLASS =
  "group relative flex items-center gap-3 rounded-xl px-3 py-3 transition-colors duration-200 hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_12%,transparent)] focus-visible:bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,transparent)] focus-visible:outline-none before:absolute before:left-0 before:top-1/2 before:h-0 before:w-[2.5px] before:-translate-y-1/2 before:rounded-full before:bg-gradient-to-b before:from-[var(--accent-strong)] before:to-[color:color-mix(in_oklab,var(--accent-strong)_70%,transparent)] before:transition-all before:duration-200 hover:before:h-[70%]";

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
        // Every queue row carries the same canonical status badge so review
        // state reads consistently with Work statuses; the field count makes
        // it informative rather than a generic "Pending".
        const pendingLabel = row.pendingFields > 0 ? `${row.pendingFields} pending` : "Pending";
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
                <p className="mt-0.5 inline-flex max-w-full flex-wrap items-center gap-x-1.5 text-[11.5px] leading-[1.4] text-[var(--text-tertiary)]">
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
              </div>
              <StatusBadge status="in_review" className="shrink-0 self-center">
                {pendingLabel}
              </StatusBadge>
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
        const reminderHref = `/contracts/renewals?contract=${row.contractId}`;
        return (
          <li key={row.id}>
            {/* Row is a container, not a link, so the row-level "Remind" action
                can sit beside the stretched primary link without nesting
                anchors (§8.6). */}
            <div className={`${ROW_LINK_CLASS} min-h-[3rem] gap-3`}>
              <Link
                href={row.href}
                aria-label={`${row.label}: ${titleText}`}
                className="absolute inset-0 z-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:color-mix(in_oklab,var(--accent)_45%,transparent)]"
              />
              <div className="pointer-events-none relative z-[1] min-w-0 flex-1">
                {showEyebrow ? (
                  <p className="ui-caps-3 text-[10px] text-[var(--text-tertiary)]">{row.label}</p>
                ) : null}
                <p
                  title={titleText}
                  className="mt-0.5 truncate text-[13.5px] font-semibold leading-[1.3] tracking-tight text-[var(--text-primary)]"
                >
                  {titleText}
                </p>
                {row.ownerLabel ? (
                  <p className="mt-0.5 truncate text-[11.5px] leading-[1.4] text-[var(--text-tertiary)]">
                    {row.ownerLabel}
                  </p>
                ) : null}
              </div>
              <div className="relative z-[1] flex shrink-0 items-center gap-2.5 self-center">
                {/* Calendar date is the anchor; the countdown reads as a caps
                    sub-line. Urgent rows tint both as a single tonal unit. */}
                <div className="pointer-events-none flex flex-col items-end gap-1 text-right">
                  <TimeChip date={row.date} format="calendar" tone={urgent ? "warning" : undefined} />
                  <span
                    className="ui-caps-3 text-[10px]"
                    style={{ color: urgent ? "var(--warning-ink)" : "var(--text-tertiary)" }}
                  >
                    {countdown}
                  </span>
                </div>
                <Link
                  href={reminderHref}
                  prefetch={false}
                  className="pointer-events-auto inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-[color:color-mix(in_oklab,var(--accent)_32%,var(--border-card))] bg-[color:color-mix(in_oklab,var(--accent)_8%,var(--surface-raised))] px-2.5 py-1 text-[11.5px] font-semibold leading-none text-[var(--accent-strong)] opacity-0 transition-opacity duration-150 hover:brightness-110 focus-visible:opacity-100 focus-visible:outline-none group-hover:opacity-100"
                >
                  Remind
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                </Link>
              </div>
            </div>
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
              style={isDanger ? { boxShadow: "inset 2.5px 0 0 0 var(--danger-ink)" } : undefined}
            >
              <span
                aria-hidden
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
                <p className="mt-1 inline-flex max-w-full flex-wrap items-center gap-x-1.5 text-[11.5px] leading-[1.4] text-[var(--text-tertiary)]">
                  <StatusBadge status={status} className="self-center">
                    {statusLabel}
                  </StatusBadge>
                  <span>{typeLabel}</span>
                  {row.contractTitle ? (
                    <>
                      <span aria-hidden className="ui-dot-sep">·</span>
                      <span className="truncate">{row.contractTitle}</span>
                    </>
                  ) : null}
                </p>
              </div>
              {row.dueAt ? (
                <TimeChip
                  date={row.dueAt}
                  format="calendar"
                  tone={dueTone}
                  className="shrink-0 self-center"
                />
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function DataGapRows({ rows }: { rows: CoreDashboardDataGapRow[] }) {
  return (
    <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)]">
      {rows.map((row) => {
        const visibleFields = row.missing.slice(0, 3);
        const overflow = row.missing.slice(3);
        return (
          <li key={row.id}>
            <Link href={row.href} className={`${ROW_LINK_CLASS} min-h-[3rem]`}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold leading-[1.3] tracking-tight text-[var(--text-primary)]">
                  {row.title}
                </p>
                {/* Each missing field is a structured bordered caps chip — the
                    fields themselves are identifiers, severity lives in the
                    right-side count. */}
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {visibleFields.map((field) => (
                    <span
                      key={field}
                      className="inline-flex max-w-[12rem] items-center rounded-md border border-[var(--border-card)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] leading-none text-[var(--text-secondary)]"
                    >
                      <span className="truncate">{field}</span>
                    </span>
                  ))}
                  {overflow.length > 0 ? (
                    <span
                      title={`Also missing: ${overflow.join(", ")}`}
                      aria-label={`${overflow.length} more field${overflow.length === 1 ? "" : "s"}: ${overflow.join(", ")}`}
                      className="inline-flex cursor-help items-center rounded-md border border-dashed border-[var(--border-card)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] leading-none text-[var(--text-tertiary)]"
                    >
                      +{overflow.length}
                    </span>
                  ) : null}
                </div>
              </div>
              {/* Severity count chip — number only; the section title and field
                  chips already supply the "gaps" noun. */}
              <CountChip
                value={row.missing.length}
                tone="warning"
                emphasis="strong"
                className="hidden shrink-0 self-center sm:inline-flex"
              />
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
  const planTier = titleCasePlan(model.planTier);
  const visiblePartialErrors = getCoreDashboardVisiblePartialErrors(model.partialErrors);
  const orderedSections: CoreDashboardSection[] = [
    getSection(model, "review_queue"),
    getSection(model, "upcoming_deadlines"),
    getSection(model, "work_needing_action"),
    getSection(model, "data_gaps"),
    getSection(model, "recent_activity"),
  ];
  // Stack sections into two balanced columns so a short queue (e.g. Review
  // Queue) flows straight into the next panel instead of leaving a tall void
  // beside a long neighbour. The operational queues sit in the wider main
  // column; the time/feed panels sit in the rail.
  const sectionByKey = new Map<DashboardSectionKey, CoreDashboardSection>(
    orderedSections.map((section) => [section.key, section])
  );
  const mainColumn: DashboardSectionKey[] = [
    "review_queue",
    "work_needing_action",
    "data_gaps",
  ];
  const railColumn: DashboardSectionKey[] = ["upcoming_deadlines", "recent_activity"];

  return (
    <div className="ui-page-stack">
      <DashboardPageHeader
        density="compact"
        icon={<Files className="h-[14px] w-[14px]" strokeWidth={1.85} />}
        eyebrow={model.workspaceName}
        suppressEyebrow={!model.workspaceName || model.workspaceName === "Workspace"}
        title={DASHBOARD_TITLE}
        lead="Review queues, upcoming renewal dates, and open work across your contracts."
        monogram={
          model.workspaceName && model.workspaceName !== "Workspace"
            ? model.workspaceName.slice(0, 2).toUpperCase()
            : undefined
        }
        // Plan chip kept (user-relevant subscription context); contracts count
        // dropped from the header — it's redundant with the cards below.
        titleSuffix={
          planTier ? <KeyValueChip label="Plan" value={planTier} /> : undefined
        }
        actions={
          <>
            {/* Paired button treatment: primary + secondary share the same
                pill scale so the two import affordances read as one cluster. */}
            <Link
              href="/contracts/new"
              className="ui-btn-primary inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold"
            >
              <UploadCloud className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
              {DASHBOARD_PRIMARY_CTA}
            </Link>
            <Link
              href="/contracts/bulk"
              prefetch={false}
              className="ui-btn-secondary inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
              {DASHBOARD_SECONDARY_CTA}
            </Link>
          </>
        }
      />

      <PartialDataNotice count={visiblePartialErrors.length} />

      <SignalSurface>
        {model.topCards.map((card) => (
          <TopSignal key={card.key} card={card} />
        ))}
      </SignalSurface>

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

      <div className="grid items-start gap-4 xl:grid-cols-12">
        <div className="flex flex-col gap-4 xl:col-span-7">
          {mainColumn.map((key) => {
            const section = sectionByKey.get(key);
            return section ? <DashboardSectionView key={key} section={section} /> : null;
          })}
        </div>
        <div className="flex flex-col gap-4 xl:col-span-5">
          {railColumn.map((key) => {
            const section = sectionByKey.get(key);
            return section ? <DashboardSectionView key={key} section={section} /> : null;
          })}
        </div>
      </div>
    </div>
  );
}
