import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { StatusBadge, type SemanticStatus } from "@/components/ui/status-badge";
import type { OperationalTone } from "@/lib/ui/operational-surface";
import {
  OPERATIONAL_ICON_WRAP_BY_TONE,
  OPERATIONAL_SHELL_BY_TONE,
} from "@/lib/ui/operational-surface";

export type OperationalBreakdownItem = { label: string; value: string };
export type OperationalTriageItem = {
  id: string;
  title: string;
  description?: string;
  count?: number | string;
  tone?: OperationalTone;
  href?: string;
  actionLabel?: string;
  meta?: OperationalBreakdownItem[];
};

const COUNT_AWARE_LABELS: Record<string, string> = {
  "Active requests": "Active request",
  "Active approver slots": "Active approver slot",
  "Blocked scenarios": "Blocked scenario",
  "Clarification loops": "Clarification loop",
  "Completed runs": "Completed run",
  "Contracts in view": "Contract in view",
  "Contracts processed": "Contract processed",
  "Contracts tracked": "Contract tracked",
  "Contracts waiting": "Contract waiting",
  "Contracts on key": "Contract on key",
  "Critical issues": "Critical issue",
  "Critical exceptions": "Critical exception",
  "Critical gaps": "Critical gap",
  "Digest executions": "Digest execution",
  "Duplicate groups": "Duplicate group",
  "Email digest runs": "Email digest run",
  "Eligible contracts": "Eligible contract",
  "Failed deliveries": "Failed delivery",
  "Failed runs": "Failed run",
  "Field comments (sample)": "Field comment (sample)",
  Forecasts: "Forecast",
  Interventions: "Intervention",
  "Missed dates prevented": "Missed date prevented",
  "Missing approved dates": "Missing approved date",
  "Open items": "Open item",
  "Open exceptions": "Open exception",
  "Open findings": "Open finding",
  "Open obligations": "Open obligation",
  "Open tasks": "Open task",
  "Orphaned files": "Orphaned file",
  "Outbound backlog": "Outbound backlog item",
  "Pending fields": "Pending field",
  "Pending approvals": "Pending approval",
  Policies: "Policy",
  "Policy evaluations": "Policy evaluation",
  "Recorded interventions": "Recorded intervention",
  "Report packs": "Report pack",
  "Rows shown": "Row shown",
  "Saved templates": "Saved template",
  "Sampled queue": "Sampled queue item",
  "Stale records": "Stale record",
  "Status transitions": "Status transition",
  Subscriptions: "Subscription",
  Templates: "Template",
  "Timeline events": "Timeline event",
  "Tasks completed": "Task completed",
  "Unread notifications": "Unread notification",
  "Unresolved gaps": "Unresolved gap",
  "Upcoming checkpoints": "Upcoming checkpoint",
  "Watchlisted contracts": "Watchlisted contract",
  "Weak field signals": "Weak field signal",
  "Weekly operators": "Weekly operator",
  "active critical": "active critical",
  "approved in this slice": "approved in this slice",
  "awaiting signoff": "awaiting signoff",
  "awaiting start": "awaiting start",
  "campaigns running": "campaign running",
  "completed runs": "completed run",
  "current approvals": "current approval",
  "contracts in queue": "contract in queue",
  "contracts loaded": "contract loaded",
  "contracts need extra follow-up": "contract needs extra follow-up",
  "contracts on this page": "contract on this page",
  "contracts running": "contract running",
  "contracts with blockers or owner gaps": "contract with blocker or owner gap",
  "failed in sample": "failed in sample",
  "in studio": "in studio",
  "latest samples": "latest sample",
  "need action": "needs action",
  "need recovery": "needs recovery",
  "need unblock plan": "needs unblock plan",
  "open or in progress": "open or in progress",
  "paused campaigns": "paused campaign",
  "recent runs": "recent run",
  "recent rows": "recent row",
  "recent sample": "recent sample",
  "resolved samples": "resolved sample",
  rows: "row",
  "saved templates": "saved template",
  "still need owner": "still needs owner",
  "still awaiting review": "still awaiting review",
  "still requested": "still requested",
  "tracked seats": "tracked seat",
  "undelivered samples": "undelivered sample",
  "with at least one item": "with at least one item",
};

function countAwareLabel(label: string, count: number | null): string {
  if (count !== 1) return label;
  return COUNT_AWARE_LABELS[label] ?? label;
}

/**
 * When to use what:
 * - **OperationalSummaryCard** — Primary KPI tiles (metric + chips + footer action).
 * - **OperationalSurfaceLinkCard** — Hub/shortcut grids (whole card is navigation).
 * - **OperationalQueueRow** — Dense columns (dashboard Now/Next/Risk): link row + optional chips, lighter than a full card.
 * - **OperationalSectionHeader** — Shared eyebrow + title + optional description/actions for any section.
 */
export function OperationalSectionHeader(props: {
  eyebrow: string;
  title: string;
  description?: string;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-4 ${props.className ?? ""}`.trim()}>
      <div className="min-w-0 space-y-1.5">
        <p className="ui-eyebrow">{props.eyebrow}</p>
        <h2 className="ui-page-title text-[1.6rem] sm:text-[2.2rem]">{props.title}</h2>
        {props.description ? (
          <p className="ui-page-lead">{props.description}</p>
        ) : null}
      </div>
      {props.actions ? (
        <div className="ui-toolbar-strong shrink-0 gap-2">{props.actions}</div>
      ) : null}
    </div>
  );
}

/**
 * Compact actionable row for queue columns (dashboard lower, risk lane).
 * Hash-only `href` uses a native anchor for reliable same-document jumps.
 */
export function OperationalQueueRow(props: {
  href: string;
  eyebrow?: string;
  title: string;
  hint?: string;
  chips?: OperationalBreakdownItem[];
  actionLabel: string;
  tone?: OperationalTone;
}) {
  const tone = props.tone ?? "neutral";
  const wrapClass = `ui-operational-focusable ui-operational-card-compact flex h-full min-h-0 flex-col px-3.5 py-3 ${OPERATIONAL_SHELL_BY_TONE[tone]}`.trim();
  const inner = (
    <>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {props.eyebrow ? (
          <p className="ui-kicker">{props.eyebrow}</p>
        ) : null}
        <p className={`font-semibold tracking-tight text-[14px] text-[var(--text-primary)] ${props.eyebrow ? "mt-1.5" : ""}`}>
          {props.title}
        </p>
        {props.hint ? <p className="ui-support-copy mt-1.5">{props.hint}</p> : null}
        {props.chips && props.chips.length > 0 ? (
          <div className="mt-2.5 flex flex-wrap gap-1.5" role="list">
            {props.chips.map((c) => (
              <OperationalMetricChip key={c.label} {...c} />
            ))}
          </div>
        ) : null}
      </div>
      <span className="ui-operational-action mt-3.5 shrink-0 text-[11px]">
        {props.actionLabel}
        <span aria-hidden>→</span>
      </span>
    </>
  );
  return props.href.startsWith("#") ? (
    <a href={props.href} className={wrapClass}>
      {inner}
    </a>
  ) : (
    <Link href={props.href} className={wrapClass}>
      {inner}
    </Link>
  );
}

/** Map row-level semantic badges to operational surface tones for queue / list cards. */
export function semanticStatusToOperationalTone(status: SemanticStatus): OperationalTone {
  switch (status) {
    case "healthy":
      return "healthy";
    case "warning":
      return "attention";
    case "blocked":
    case "overdue":
    case "critical":
      return "risk";
    case "empty":
    case "disabled":
    case "info":
    case "in_review":
    default:
      return "neutral";
  }
}

function badgeForTone(tone: OperationalTone): { status: SemanticStatus; label: string } | null {
  switch (tone) {
    case "healthy":
      return { status: "healthy", label: "Clear" };
    case "attention":
      return { status: "warning", label: "Watch" };
    case "risk":
      return { status: "critical", label: "At risk" };
    // "neutral" intentionally returns null — informational state needs no pill.
    case "neutral":
    default:
      return null;
  }
}

export function OperationalMetricChip({ label, value }: OperationalBreakdownItem) {
  return (
    <div role="listitem" className="ui-metric-chip">
      <span className="ui-metric-label">{label}</span>
      <span className="font-semibold tabular-nums text-[var(--text-primary)]">{value}</span>
    </div>
  );
}

export function CompressedNormalState(props: {
  title: string;
  description?: string;
  action?: { href: string; label: string };
  className?: string;
}) {
  return (
    <div
      role="status"
      className={`rounded-2xl border border-[var(--border-subtle)] bg-[color:var(--surface-tint)] px-3.5 py-3 text-[12.5px] text-[var(--text-secondary)] ${props.className ?? ""}`.trim()}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-semibold text-[var(--text-primary)]">{props.title}</p>
          {props.description ? <p className="mt-0.5">{props.description}</p> : null}
        </div>
        {props.action ? (
          <Link href={props.action.href} className="ui-operational-action shrink-0 text-[11px]">
            <span>{props.action.label}</span>
            <span aria-hidden>→</span>
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function DiagnosticDisclosure(props: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details
      className={`rounded-2xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_54%,transparent)] px-3.5 py-3 text-[12.5px] text-[var(--text-secondary)] ${props.className ?? ""}`.trim()}
    >
      <summary className="cursor-pointer list-none font-semibold text-[var(--text-primary)] marker:hidden">
        {props.title ?? "Diagnostics"}
      </summary>
      <div className="mt-2 leading-relaxed">{props.children}</div>
    </details>
  );
}

export function SeverityMetricStrip(props: {
  items: Array<OperationalBreakdownItem & { tone?: OperationalTone }>;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap gap-2 ${props.className ?? ""}`.trim()} role="list">
      {props.items.map((item) => (
        <div
          key={item.label}
          role="listitem"
          className={`ui-metric-chip ${
            item.tone ? OPERATIONAL_SHELL_BY_TONE[item.tone] : ""
          }`.trim()}
        >
          <span className="ui-metric-label">{item.label}</span>
          <span className="font-semibold tabular-nums text-[var(--text-primary)]">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

export function OperationalTriagePanel(props: {
  eyebrow: string;
  title: string;
  description?: string;
  items: OperationalTriageItem[];
  allClear?: {
    title: string;
    description?: string;
    action?: { href: string; label: string };
  };
  diagnostics?: ReactNode;
  className?: string;
}) {
  const activeItems = props.items.filter((item) => item.count !== 0 && item.count !== "0");
  // When state is clear, collapse to a thin banner. The display-size header
  // is reserved for cases where there's actual triage work to surface.
  if (activeItems.length === 0 && props.allClear) {
    return (
      <CompressedNormalState
        title={props.allClear.title}
        description={props.allClear.description}
        action={props.allClear.action}
        className={props.className}
      />
    );
  }
  return (
    <section className={`ui-card p-4 md:p-5 ${props.className ?? ""}`.trim()}>
      <OperationalSectionHeader
        eyebrow={props.eyebrow}
        title={props.title}
        description={props.description}
        className="items-start"
      />
      {activeItems.length > 0 ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {activeItems.map((item) => {
            const content = (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--text-primary)]">{item.title}</p>
                    {item.description ? (
                      <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                        {item.description}
                      </p>
                    ) : null}
                  </div>
                  {item.count !== undefined ? (
                    <span className="shrink-0 text-lg font-semibold tabular-nums text-[var(--text-primary)]">
                      {item.count}
                    </span>
                  ) : null}
                </div>
                {item.meta && item.meta.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5" role="list">
                    {item.meta.map((chip) => (
                      <OperationalMetricChip key={chip.label} {...chip} />
                    ))}
                  </div>
                ) : null}
                {item.actionLabel ? (
                  <span className="ui-operational-action mt-3 text-[11px]">
                    {item.actionLabel}
                    <span aria-hidden>→</span>
                  </span>
                ) : null}
              </>
            );
            const className = `ui-operational-focusable ui-operational-card-compact flex min-h-0 flex-col px-3.5 py-3 ${OPERATIONAL_SHELL_BY_TONE[item.tone ?? "neutral"]}`;
            return item.href ? (
              <Link key={item.id} href={item.href} className={className}>
                {content}
              </Link>
            ) : (
              <div key={item.id} className={className}>
                {content}
              </div>
            );
          })}
        </div>
      ) : props.allClear ? (
        <CompressedNormalState className="mt-4" {...props.allClear} />
      ) : null}
      {props.diagnostics ? (
        <DiagnosticDisclosure className="mt-4">{props.diagnostics}</DiagnosticDisclosure>
      ) : null}
    </section>
  );
}

type IconProps = { className?: string; strokeWidth?: number; "aria-hidden"?: boolean };

/**
 * Control-surface card: muted eyebrow, noun headline, status badge, dominant metric,
 * optional chip row, specific action link.
 */
export function OperationalSummaryCard(props: {
  eyebrow: string;
  headline: string;
  tone: OperationalTone;
  icon: ComponentType<IconProps>;
  primaryValue: number | string | null;
  primaryFallback?: string;
  primaryUnit?: string;
  secondaryLine?: string;
  /** When primary is null, show secondaryLine under the metric area */
  breakdown?: OperationalBreakdownItem[];
  action: { href: string; label: string; external?: boolean };
  /** Smaller type and padding for dense strips (e.g. portfolio metrics). */
  variant?: "default" | "compact" | "hero";
  showStatusBadge?: boolean;
  className?: string;
  footerExtra?: ReactNode;
  id?: string;
}) {
  const {
    eyebrow,
    headline,
    tone,
    icon: Icon,
    primaryValue,
    primaryFallback,
    primaryUnit,
    secondaryLine,
    breakdown = [],
    action,
    variant = "default",
    showStatusBadge = true,
    className = "",
    footerExtra,
    id,
  } = props;

  const badge = badgeForTone(tone);
  const primaryDisplay =
    primaryValue !== null && primaryValue !== undefined ? String(primaryValue) : (primaryFallback ?? "—");
  const primaryCount = typeof primaryValue === "number" ? primaryValue : null;
  const headlineDisplay = countAwareLabel(headline, primaryCount);
  const primaryUnitDisplay = primaryUnit ? countAwareLabel(primaryUnit, primaryCount) : null;
  const compact = variant === "compact";
  const hero = variant === "hero";
  const metricClass = compact
    ? "text-[1.55rem] font-semibold leading-none tabular-nums tracking-tight text-[var(--text-primary)] sm:text-[1.7rem]"
    : hero
      ? "text-[2.75rem] font-semibold leading-none tabular-nums tracking-tight text-[var(--text-primary)] sm:text-[3.35rem]"
      : "text-[2.3rem] font-semibold leading-none tabular-nums tracking-tight text-[var(--text-primary)] sm:text-[2.7rem]";
  const pad = compact ? "py-3.5 pl-3.5 pr-3.5" : hero ? "py-5 px-5 sm:px-6 sm:py-6" : "py-4.5 pl-4.5 pr-4.5";
  const iconBox = compact ? "h-10 w-10" : hero ? "h-12 w-12 sm:h-14 sm:w-14" : "h-11 w-11";
  const iconSz = compact ? "h-4 w-4" : hero ? "h-5 w-5 sm:h-6 sm:w-6" : "h-5 w-5";
  const badgeClass = compact
    ? "max-w-full whitespace-normal text-[11px] leading-tight sm:text-[11px]"
    : hero
      ? "shrink-0 whitespace-nowrap text-[11px]"
      : "shrink-0 whitespace-nowrap";
  const footerClass = compact
    ? "mt-3 flex shrink-0 flex-col items-start gap-2 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_84%,transparent)] pt-3"
    : hero
      ? "mt-4 flex shrink-0 flex-wrap items-center gap-2 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_84%,transparent)] pt-4"
      : "mt-3 flex shrink-0 flex-wrap items-center gap-2 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_84%,transparent)] pt-3";
  const shellClass = hero ? "ui-card-hero" : "ui-summary-card";
  const headerClass = compact ? "flex flex-col gap-3" : "flex flex-wrap items-start justify-between gap-3";

  return (
    <article
      id={id}
      className={`${shellClass} ui-transition-surface flex h-full min-h-0 min-w-0 flex-col ${pad} ${OPERATIONAL_SHELL_BY_TONE[tone]} hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-2)] ${className}`.trim()}
    >
      <div className="min-h-0 flex-1">
        <div className={headerClass}>
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span
              className={`ui-icon-tile${compact ? "-compact" : ""} shrink-0 ${iconBox} ${OPERATIONAL_ICON_WRAP_BY_TONE[tone]}`.trim()}
            >
              <Icon className={iconSz} strokeWidth={1.65} aria-hidden />
            </span>
            <div className="min-w-0 flex-1 pr-1">
              <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
                <p className={hero ? "ui-eyebrow" : "ui-kicker"}>{eyebrow}</p>
                {showStatusBadge && !compact && badge ? (
                  <StatusBadge status={badge.status} className={`sm:hidden ${badgeClass}`.trim()}>
                    {badge.label}
                  </StatusBadge>
                ) : null}
              </div>
              <h3
                className={`mt-1.5 break-words font-semibold tracking-tight text-[var(--text-primary)] ${
                  compact ? "text-sm leading-snug" : hero ? "text-[1.2rem] leading-[1.15] sm:text-[1.35rem]" : "text-[14px] leading-snug"
                }`}
              >
                {headlineDisplay}
              </h3>
            </div>
          </div>
          {showStatusBadge && !compact && badge ? (
            <StatusBadge status={badge.status} className={`hidden sm:inline-flex ${badgeClass}`.trim()}>
              {badge.label}
            </StatusBadge>
          ) : null}
        </div>
        <div className={hero ? "mt-4" : "mt-3"}>
          <p className={metricClass}>{primaryDisplay}</p>
          {primaryUnitDisplay ? (
            <p className={`mt-1.5 font-medium text-[var(--text-secondary)] ${compact ? "text-[11px]" : hero ? "text-[12.5px]" : "text-[12.5px]"}`}>
              {primaryUnitDisplay}
            </p>
          ) : secondaryLine ? (
            <p className={`mt-1.5 text-[var(--text-secondary)] ${compact ? "text-[11px]" : hero ? "text-[12.5px]" : "text-[12.5px]"}`}>
              {secondaryLine}
            </p>
          ) : null}
        </div>

        {breakdown.length > 0 ? (
          <div className={`${hero ? "mt-4" : "mt-3"} flex flex-wrap gap-2`} role="list">
            {breakdown.map((row) => (
              <OperationalMetricChip key={row.label} {...row} />
            ))}
          </div>
        ) : null}
      </div>

      <div className={footerClass}>
        {showStatusBadge && compact && badge ? (
          <StatusBadge status={badge.status} className={badgeClass}>
            {badge.label}
          </StatusBadge>
        ) : null}
        {action.href.startsWith("#") ? (
          <a
            href={action.href}
            aria-label={compact ? action.label : undefined}
            className="ui-operational-focusable ui-operational-action"
          >
            {compact ? null : <span>{action.label}</span>}
            <span aria-hidden>→</span>
          </a>
        ) : (
          <Link
            href={action.href}
            target={action.external ? "_blank" : undefined}
            rel={action.external ? "noopener noreferrer" : undefined}
            aria-label={compact ? action.label : undefined}
            className="ui-operational-focusable ui-operational-action"
          >
            {compact ? null : <span>{action.label}</span>}
            <span aria-hidden>→</span>
          </Link>
        )}
        {footerExtra ? <div className="min-w-0 flex-1">{footerExtra}</div> : null}
      </div>
    </article>
  );
}

/**
 * Whole-card link for shortcut grids (action lanes, module hubs).
 * Hash-only `href` (e.g. `#section`) uses a native anchor so in-page jumps match browser behavior.
 */
export function OperationalSurfaceLinkCard(props: {
  href: string;
  eyebrow: string;
  title: string;
  tone?: OperationalTone;
  icon: ComponentType<IconProps>;
  chips?: OperationalBreakdownItem[];
  /** CTA on the link line; defaults to an operator-action verb tied to the card tone. */
  actionLabel?: string;
  hint?: string;
  variant?: "default" | "hero";
  className?: string;
}) {
  const tone = props.tone ?? "neutral";
  const hero = props.variant === "hero";
  const badge = badgeForTone(tone);
  const Icon = props.icon;
  const fallbackActionVerb = tone === "healthy" ? "Browse" : tone === "neutral" ? "Inspect" : "Review";
  const cta =
    typeof props.actionLabel === "string" && props.actionLabel.trim() !== ""
      ? props.actionLabel
      : `${fallbackActionVerb} ${props.title}`;
  const wrapClass = `ui-operational-focusable ${hero ? "ui-card-hero px-5 py-5 sm:px-6 sm:py-6" : "ui-operational-card py-4 pl-4 pr-4"} flex h-full min-h-0 flex-col ${OPERATIONAL_SHELL_BY_TONE[tone]} ${props.className ?? ""}`.trim();
  const inner = (
    <>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-2.5">
            <span className={`${hero ? "ui-icon-tile h-11 w-11 sm:h-12 sm:w-12" : "ui-icon-tile-compact h-9 w-9"} shrink-0 ${OPERATIONAL_ICON_WRAP_BY_TONE[tone]}`.trim()}>
              <Icon className={hero ? "h-5 w-5" : "h-4 w-4"} strokeWidth={1.65} aria-hidden />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
                <p className={hero ? "ui-eyebrow" : "ui-kicker"}>{props.eyebrow}</p>
                {badge ? (
                  <StatusBadge status={badge.status} className="shrink-0 whitespace-nowrap sm:hidden">
                    {badge.label}
                  </StatusBadge>
                ) : null}
              </div>
              <p className={`mt-1.5 break-words font-semibold tracking-tight text-[var(--text-primary)] ${hero ? "text-[1.15rem] leading-[1.15] sm:text-[1.3rem]" : "text-sm leading-snug"}`}>
                {props.title}
              </p>
              {props.hint ? (
                <p className={`ui-support-copy mt-1.5 ${hero ? "line-clamp-3 text-[12.5px]" : "line-clamp-2"}`}>{props.hint}</p>
              ) : null}
            </div>
          </div>
          {badge ? (
            <StatusBadge status={badge.status} className="hidden shrink-0 whitespace-nowrap sm:inline-flex">
              {badge.label}
            </StatusBadge>
          ) : null}
        </div>
        {props.chips && props.chips.length > 0 ? (
          <div className={`${hero ? "mt-3" : "mt-2"} flex flex-wrap gap-1.5`} role="list">
            {props.chips.map((c) => (
              <OperationalMetricChip key={c.label} {...c} />
            ))}
          </div>
        ) : null}
      </div>
      <span className={`ui-operational-action shrink-0 ${hero ? "mt-4 text-[12.5px]" : "mt-3"}`}>
        {cta}
        <span aria-hidden>→</span>
      </span>
    </>
  );
  return props.href.startsWith("#") ? (
    <a href={props.href} className={wrapClass}>
      {inner}
    </a>
  ) : (
    <Link href={props.href} className={wrapClass}>
      {inner}
    </Link>
  );
}
