import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Check,
  CheckSquare,
  ClipboardCheck,
  FileText,
  Inbox,
  LayoutDashboard,
  ListChecks,
  ShieldAlert,
  Slash,
  UploadCloud,
  UserX,
} from "lucide-react";
import { ActionChip } from "@/components/ui/action-chip";
import { ChipCapsule } from "@/components/ui/chip-capsule";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { KeyValueChip } from "@/components/ui/key-value-chip";
import { RatioChip } from "@/components/ui/ratio-chip";
import { StatusBadge, type SemanticStatus } from "@/components/ui/status-badge";
import { TimeChip } from "@/components/ui/time-chip";
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

const TOP_CARD_ICONS: Record<DashboardTopCardKey, typeof ClipboardCheck> = {
  needs_review: ClipboardCheck,
  upcoming_deadlines: CalendarClock,
  blocked_work: Slash,
  missing_owners: UserX,
  open_exceptions: AlertTriangle,
  evidence_requested: ShieldAlert,
};

const SECTION_ICONS: Record<DashboardSectionKey, typeof CheckSquare> = {
  review_queue: CheckSquare,
  upcoming_deadlines: CalendarClock,
  work_needing_action: ListChecks,
  data_gaps: Inbox,
  recent_activity: FileText,
};

const SECTION_LAYOUT: Record<DashboardSectionKey, string> = {
  // Row 1: Review Queue (7) + Upcoming Deadlines (5) — kept asymmetric so
  // the queue row pattern (title + counterparty + owner + ratio + status
  // + updated date) has horizontal room.
  review_queue: "xl:col-span-7",
  upcoming_deadlines: "xl:col-span-5",
  // Row 2: balanced 4-4-4 so Data Gaps has room for its action verb. The
  // prior 5-3-4 split truncated "Fix missing data" in the col-span-3 cell.
  work_needing_action: "xl:col-span-4",
  data_gaps: "xl:col-span-4",
  recent_activity: "xl:col-span-4",
};

function titleCasePlan(planTier: string | null): string | null {
  if (!planTier) return null;
  return `${planTier.charAt(0).toUpperCase()}${planTier.slice(1).toLowerCase()}`;
}

function cardInk(card: CoreDashboardTopCard): string {
  if (card.count === 0) return "color-mix(in oklab, var(--success-ink) 55%, var(--text-tertiary))";
  if (card.tone === "danger") return "var(--danger-ink)";
  if (card.tone === "warning") return "var(--warning-ink)";
  return "var(--text-primary)";
}

function statusForWork(row: CoreDashboardWorkRow): SemanticStatus {
  if (row.status === "blocked") return "blocked";
  if (row.dueState === "overdue") return "overdue";
  if (row.status === "waiting") return "warning";
  if (row.status === "done") return "healthy";
  return "in_review";
}

function statusForReview(status: string, pendingFields: number): SemanticStatus {
  if (pendingFields > 0 || status === "pending_review") return "in_review";
  if (status === "active") return "healthy";
  return "info";
}

function compactLabel(value: string | null | undefined, fallback: string): string {
  // v18: title-case the first letter so enum leaks ("exception", "task",
  // "obligation") render as proper labels ("Exception", "Task",
  // "Obligation"). Display-only transformation — the model data is
  // unchanged.
  const raw = String(value || fallback).replace(/_/g, " ").trim();
  if (raw.length === 0) return "";
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

function SectionCount({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      // Plus Jakarta Sans (the heading font) has a tall ascender ratio
      // (~0.98), so with `leading-[1.2]` the cap-center sits within 0.1px
      // of the line-box center. Pure `items-center` on the h2 already
      // gives correct optical alignment — no transform needed.
      className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full border px-1.5 text-[10px] font-semibold tabular-nums leading-none text-[var(--warning-ink)]"
      style={{
        borderColor: "color-mix(in oklab, var(--warning-ink) 32%, var(--border-card))",
        background: "color-mix(in oklab, var(--warning-soft) 24%, var(--surface-raised))",
        boxShadow: "inset 0 1px 0 0 color-mix(in oklab, var(--warning-ink) 10%, transparent)",
      }}
    >
      {count}
    </span>
  );
}

function MetaList({ items }: { items: Array<string | null | undefined> }) {
  const visible = items
    .filter((item): item is string => Boolean(item?.trim()))
    .filter((item) => item.trim().toLowerCase() !== "name");
  if (visible.length === 0) return null;
  return (
    // v20: render metadata items as canonical §2.6 status-value chips
    // (subtle accent-tinted bordered pills) instead of dot-separated
    // prose. Fixes the small-plain-text complaint in row sub-lines —
    // each entity reference now reads as a discrete structured label
    // with visible chrome.
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      {visible.map((item, idx) => (
        <span
          key={`${item}-${idx}`}
          className="inline-flex max-w-[14rem] items-center rounded-md border px-1.5 py-[3px] text-[11px] font-medium leading-none"
          style={{
            borderColor: "color-mix(in oklab, var(--accent) 10%, var(--border-subtle))",
            background: "color-mix(in oklab, var(--accent-soft) 6%, var(--surface))",
            color: "var(--text-secondary)",
          }}
        >
          <span className="truncate">{item}</span>
        </span>
      ))}
    </div>
  );
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
  const Icon = TOP_CARD_ICONS[card.key];
  const ink = cardInk(card);
  const isZero = card.count === 0;
  const isActive = !isZero && card.tone !== "neutral";
  return (
    <Link
      href={card.href}
      aria-label={`${card.label}: ${card.count}. ${card.actionLabel}.`}
      className="group relative grid min-h-[5rem] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 transition-[background,box-shadow] duration-150 hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_8%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:color-mix(in_oklab,var(--accent)_45%,transparent)]"
      style={{
        // v18: active cells get a soft radial accent behind the icon
        // position (top-left) layered over the existing vertical
        // gradient. This adds a subtle "lit" quality that anchors the
        // count visually without competing with the section cards below.
        background: isActive
          ? `radial-gradient(ellipse 50% 80% at 0% 0%, color-mix(in oklab, ${ink} 9%, transparent), transparent 70%), linear-gradient(180deg, color-mix(in oklab, ${ink} 7%, var(--surface-raised)) 0%, color-mix(in oklab, ${ink} 2%, var(--surface-raised)) 100%)`
          : "var(--surface-raised)",
        boxShadow: isActive
          ? `inset 0 3px 0 color-mix(in oklab, ${ink} 60%, transparent), inset 0 1px 0 0 color-mix(in oklab, white 6%, transparent)`
          : "inset 0 1px 0 0 color-mix(in oklab, white 4%, transparent)",
      }}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {isZero ? (
          <Check
            className="h-4 w-4 shrink-0"
            strokeWidth={2.4}
            aria-hidden
            style={{ color: ink }}
          />
        ) : (
          <Icon
            className="h-4 w-4 shrink-0"
            strokeWidth={1.85}
            aria-hidden
            style={{ color: ink }}
          />
        )}
        <p
          className="text-[2.125rem] font-semibold leading-none tabular-nums tracking-[-0.02em]"
          style={{ color: ink }}
        >
          {card.count}
        </p>
      </div>
      <span
        className="ui-caps-2 block min-w-0 truncate leading-[1.2]"
        style={{ color: isZero ? "var(--text-tertiary)" : ink }}
      >
        {card.label}
      </span>
      <ArrowRight
        className="h-4 w-4 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5"
        strokeWidth={2.2}
        aria-hidden
        style={{
          color: isActive
            ? "var(--accent-strong)"
            : isZero
              ? "color-mix(in oklab, var(--text-tertiary) 60%, transparent)"
              : "color-mix(in oklab, var(--accent-strong) 80%, transparent)",
        }}
      />
    </Link>
  );
}

function SignalSurface({
  children,
  partialNotice,
}: {
  children: React.ReactNode;
  partialNotice: React.ReactNode;
}) {
  return (
    <section
      aria-label="Top cards"
      // v15 aesthetic pass: switched to canonical `.ui-card-raised`
      // (per ui-design-principles §2.1) so the dashboard's top container
      // matches the rest of the app's raised-surface recipe — accent-
      // tinted border, radial + linear backdrop, inset top highlight,
      // accent halo at bottom. Inner gap-px grid kept; cells render
      // their own backgrounds so the parent grid color shows through
      // as hairline dividers.
      className="ui-card-raised overflow-hidden"
    >
      <div className="grid grid-cols-1 gap-px sm:grid-cols-2 xl:grid-cols-3">
        {children}
      </div>
      {partialNotice ? (
        <div className="border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)]">
          {partialNotice}
        </div>
      ) : null}
    </section>
  );
}

function PartialDataNotice({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <section
      role="status"
      aria-live="polite"
      aria-label="Dashboard partial data state"
      // v17: dropped the warning-soft background tint — the ChipCapsule
      // itself carries the warning tone, the background tint was just
      // chrome that competed with the chip. Now renders against the
      // SignalSurface's canonical background.
      className="flex w-full items-center justify-center px-4 py-3"
    >
      <ChipCapsule
        leftValue={count}
        leftLabel={count === 1 ? "source delayed" : "sources delayed"}
        rightVerb="review health"
        href="/settings/health"
        tone="warning"
      />
    </section>
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
      // v15 aesthetic pass: switched to canonical `.ui-card-raised` so
      // section cards match the rest of the app (Settings page, hero
      // cards, etc.). The bespoke `border + bg-[surface-raised] + inline
      // boxShadow` recipe diverged from the canonical accent-tinted
      // border + radial gradient + accent halo treatment.
      className={`${SECTION_LAYOUT[section.key]} ui-card-raised min-w-0 overflow-hidden`}
    >
      <div
        className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] px-5 py-4"
        style={{
          // v18: faint accent-soft wash under the section header to
          // visually distinguish it from the body — matches the canonical
          // `.ui-card-raised` radial gradient at top.
          background:
            "linear-gradient(180deg, color-mix(in oklab, var(--accent-soft) 6%, transparent) 0%, transparent 100%)",
        }}
      >
        <h2
          id={ariaId}
          className="inline-flex min-w-0 items-center gap-2.5 text-[1.1rem] font-semibold leading-[1.2] tracking-[-0.005em] text-[var(--text-primary)] sm:text-[1.35rem]"
        >
          <Icon
            className="h-[1.125rem] w-[1.125rem] shrink-0 text-[var(--accent-strong)]"
            strokeWidth={1.85}
            aria-hidden
          />
          <span className="truncate">{section.title}</span>
          <SectionCount count={section.count} />
        </h2>
        {section.actionLabel ? (
          // v15: ActionChip gets `shrink-0` + `whitespace-nowrap` so it
          // never word-wraps mid-verb. Combined with `flex-wrap` on the
          // header, this means narrow columns (e.g., Data Gaps at
          // col-span-3) drop the action chip below the heading instead
          // of truncating the section title.
          <ActionChip
            verb={section.actionLabel}
            href={section.href}
            className="shrink-0 whitespace-nowrap"
          />
        ) : null}
      </div>
      <div className="p-2.5 sm:p-3">{children}</div>
    </section>
  );
}

// v17 aesthetic pass: row hover refinements — gentler bg shift, slightly
// taller accent rail on hover (60% → 70%), and the rail uses a vertical
// gradient for a touch of refinement. Shared across all 5 row variants.
const ROW_LINK_CLASS =
  "group relative flex items-center gap-3 rounded-xl px-3 py-3 transition-colors duration-200 hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_12%,transparent)] focus-visible:bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,transparent)] focus-visible:outline-none before:absolute before:left-0 before:top-1/2 before:h-0 before:w-[2.5px] before:-translate-y-1/2 before:rounded-full before:bg-gradient-to-b before:from-[var(--accent-strong)] before:to-[color:color-mix(in_oklab,var(--accent-strong)_70%,transparent)] before:transition-all before:duration-200 hover:before:h-[70%]";

// v21: shared status-badge-with-dot helper. Augments the canonical
// <StatusBadge> primitive with a leading status dot per §2.5
// (status dot pattern) and §7.7 (non-color reinforcement for status
// signals — WCAG color-only is banned). Keeps the canonical primitive's
// class-based chrome; adds the dot as a child.
function RowStatusBadge({
  status,
  children,
  className,
}: {
  status: SemanticStatus;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <StatusBadge status={status} className={className}>
      <span
        aria-hidden
        className="mr-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-90"
      />
      {children}
    </StatusBadge>
  );
}

function ReviewRows({ rows }: { rows: CoreDashboardReviewRow[] }) {
  return (
    <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)]">
      {rows.map((row) => (
        <li key={row.id}>
          <Link href={row.href} className={`${ROW_LINK_CLASS} min-h-[5.25rem] gap-4`}>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold leading-[1.25] tracking-tight text-[var(--text-primary)]">
                {row.title}
              </p>
              <MetaList
                items={[
                  row.counterparty,
                  row.ownerLabel,
                  row.updatedAt
                    ? `Updated ${new Date(row.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                    : null,
                ]}
              />
            </div>
            {row.totalFields > 0 ? (
              <div className="hidden shrink-0 sm:flex">
                <RatioChip numerator={row.reviewed} denominator={row.totalFields} suffix="reviewed" />
              </div>
            ) : null}
            <RowStatusBadge status={statusForReview(row.status, row.pendingFields)} className="shrink-0">
              {row.pendingFields > 0 ? "Pending review" : compactLabel(row.status, "Review")}
            </RowStatusBadge>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function DeadlineRows({ rows }: { rows: CoreDashboardDeadlineRow[] }) {
  return (
    <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)]">
      {rows.map((row) => {
        const urgent = row.daysRemaining <= 7;
        return (
          <li key={row.id}>
            <Link href={row.href} className={`${ROW_LINK_CLASS} min-h-[4.5rem]`}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold leading-[1.25] tracking-tight text-[var(--text-primary)]">
                  {row.label}
                </p>
                <MetaList
                  items={[
                    row.contractTitle,
                    row.daysRemaining === 0
                      ? "Today"
                      : row.daysRemaining === 1
                        ? "Tomorrow"
                        : `${row.daysRemaining} days`,
                    row.ownerLabel,
                  ]}
                />
              </div>
              <TimeChip date={row.date} format="calendar" tone={urgent ? "warning" : undefined} />
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
        // v20: strip ": <contractTitle>" suffix from row title — the model
        // returns titles like "Missing critical dates: Acme Corp MSA 2025"
        // and the contract chip below would duplicate the same name.
        // Display-only transformation.
        const contractSuffix = row.contractTitle ? `: ${row.contractTitle}` : "";
        const cleanTitle =
          contractSuffix && row.title.endsWith(contractSuffix)
            ? row.title.slice(0, -contractSuffix.length)
            : row.title;
        return (
          <li key={row.id}>
            <Link href={row.href} className={`${ROW_LINK_CLASS} min-h-[4.75rem]`}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold leading-[1.25] tracking-tight text-[var(--text-primary)]">
                  {cleanTitle}
                </p>
                <MetaList items={[compactLabel(row.type, "Work"), row.contractTitle, row.ownerLabel]} />
              </div>
              {row.dueAt ? <TimeChip date={row.dueAt} format="readable" /> : null}
              <RowStatusBadge status={statusForWork(row)} className="hidden shrink-0 sm:inline-flex">
                {compactLabel(row.status, "Open")}
              </RowStatusBadge>
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
      {rows.map((row) => (
        <li key={row.id}>
          <Link href={row.href} className={`${ROW_LINK_CLASS} min-h-[4.5rem]`}>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold leading-[1.25] tracking-tight text-[var(--text-primary)]">
                {row.title}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {row.missing.slice(0, 3).map((field) => (
                  <span
                    key={field}
                    className="inline-flex max-w-[12rem] items-center rounded-md border px-1.5 py-[3px] text-[11px] font-medium leading-none"
                    style={{
                      borderColor: "color-mix(in oklab, var(--warning-ink) 28%, var(--border-subtle))",
                      background: "color-mix(in oklab, var(--warning-soft) 14%, var(--surface))",
                      color: "var(--warning-ink)",
                    }}
                  >
                    <span className="truncate">{field}</span>
                  </span>
                ))}
                {row.missing.length > 3 ? (
                  <span className="inline-flex items-center text-[11px] font-medium leading-none text-[var(--text-tertiary)]">
                    +{row.missing.length - 3}
                  </span>
                ) : null}
              </div>
            </div>
            <RowStatusBadge status="warning" className="hidden shrink-0 sm:inline-flex">
              {row.missing.length} gaps
            </RowStatusBadge>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ActivityRows({ rows }: { rows: CoreDashboardActivityRow[] }) {
  return (
    <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)]">
      {rows.map((row) => (
        <li key={row.id}>
          <Link href={row.href} className={`${ROW_LINK_CLASS} min-h-[4.5rem]`}>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold leading-[1.25] tracking-tight text-[var(--text-primary)]">
                {row.summary}
              </p>
              {/* v18: em-dash ("—") replaces missing contract title per
                  §10.12 — the canonical "no value yet" marker. */}
              <MetaList items={[row.contractTitle?.trim() || "—", row.outcome]} />
            </div>
            {row.occurredAt ? <TimeChip date={row.occurredAt} format="readable" /> : null}
          </Link>
        </li>
      ))}
    </ul>
  );
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

  return (
    <div className="ui-page-stack">
      <DashboardPageHeader
        icon={<LayoutDashboard className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
        eyebrow={model.workspaceName}
        suppressEyebrow={!model.workspaceName || model.workspaceName === "Workspace"}
        title={DASHBOARD_TITLE}
        monogram={
          model.workspaceName && model.workspaceName !== "Workspace"
            ? model.workspaceName.slice(0, 2).toUpperCase()
            : undefined
        }
        lead={null}
        metaStrip={
          <>
            {/* v19: meta items rendered as canonical <KeyValueChip> pills
                (§2.6) instead of bare dt/dd spans. Fixes two visible
                defects: (1) the "Contracts 1" pair had only gap-1.5 (6px)
                between label and value, reading as cramped; (2) the
                wrapping dl had no visible container chrome — the strip
                read as floating text. KeyValueChip provides a bordered
                pill with proper internal spacing and tone-coded ink. */}
            {model.totalContracts > 0 ? (
              <KeyValueChip
                label="Contracts"
                value={model.totalContracts}
              />
            ) : null}
            {planTier ? (
              <KeyValueChip label="Plan" value={planTier} />
            ) : null}
          </>
        }
        actions={
          <>
            <Link
              href="/contracts/new"
              className="ui-btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-[12.5px] font-semibold"
            >
              <UploadCloud className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
              {DASHBOARD_PRIMARY_CTA}
            </Link>
            <Link
              href="/contracts/intake"
              prefetch={false}
              className="ui-btn-secondary inline-flex items-center gap-1.5 px-4 py-2 text-[12.5px] font-semibold"
            >
              {DASHBOARD_SECONDARY_CTA}
            </Link>
          </>
        }
      />

      <SignalSurface partialNotice={<PartialDataNotice count={visiblePartialErrors.length} />}>
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

      <div className="grid items-start gap-5 xl:grid-cols-12">
        {orderedSections.map((section) => (
          <DashboardSectionView key={section.key} section={section} />
        ))}
      </div>
    </div>
  );
}
