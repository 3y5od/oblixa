import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { StatusBadge, type SemanticStatus } from "@/components/ui/status-badge";
import type { OperationalTone } from "@/lib/ui/operational-surface";
import {
  OPERATIONAL_ICON_WRAP_BY_TONE,
  OPERATIONAL_SHELL_BY_TONE,
} from "@/lib/ui/operational-surface";

export type OperationalBreakdownItem = { label: string; value: string };

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
      <div className="min-w-0 space-y-1">
        <p className="ui-eyebrow">{props.eyebrow}</p>
        <h2 className="ui-section-title text-xl sm:text-[1.4rem]">{props.title}</h2>
        {props.description ? (
          <p className="ui-muted-tight max-w-2xl text-[13px] sm:text-[13.5px]">{props.description}</p>
        ) : null}
      </div>
      {props.actions ? (
        <div className="ui-toolbar shrink-0 gap-2">{props.actions}</div>
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
  const wrapClass = `ui-operational-focusable ui-transition-surface block rounded-[1.15rem] border border-[var(--border-subtle)] px-3.5 py-3 shadow-[var(--shadow-1)] hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-2)] ${OPERATIONAL_SHELL_BY_TONE[tone]}`.trim();
  const inner = (
    <>
      {props.eyebrow ? (
        <p className="ui-kicker">{props.eyebrow}</p>
      ) : null}
      <p className={`font-semibold tracking-tight text-[var(--text-primary)] ${props.eyebrow ? "mt-1" : ""}`}>{props.title}</p>
      {props.hint ? <p className="mt-1 text-[12px] leading-snug text-[var(--text-secondary)]">{props.hint}</p> : null}
      {props.chips && props.chips.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5" role="list">
          {props.chips.map((c) => (
            <OperationalMetricChip key={c.label} {...c} />
          ))}
        </div>
      ) : null}
      <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--accent-strong)]">
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

function badgeForTone(tone: OperationalTone): { status: SemanticStatus; label: string } {
  switch (tone) {
    case "healthy":
      return { status: "healthy", label: "Clear" };
    case "neutral":
      return { status: "info", label: "Monitor" };
    case "attention":
      return { status: "warning", label: "Watch" };
    case "risk":
      return { status: "critical", label: "At risk" };
    default:
      return { status: "info", label: "Monitor" };
  }
}

export function OperationalMetricChip({ label, value }: OperationalBreakdownItem) {
  return (
    <div
      role="listitem"
      className="ui-metric-chip"
    >
      <span className="font-medium text-[var(--text-tertiary)]">{label}</span>
      <span className="font-semibold tabular-nums text-[var(--text-primary)]">{value}</span>
    </div>
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
  variant?: "default" | "compact";
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
  const compact = variant === "compact";
  const metricClass = compact
    ? "text-[1.55rem] font-semibold leading-none tabular-nums tracking-tight text-[var(--text-primary)] sm:text-[1.7rem]"
    : "text-[2.3rem] font-semibold leading-none tabular-nums tracking-tight text-[var(--text-primary)] sm:text-[2.7rem]";
  const pad = compact ? "py-3.5 pl-3.5 pr-3.5" : "py-4.5 pl-4.5 pr-4.5";
  const iconBox = compact ? "h-10 w-10" : "h-11 w-11";
  const iconSz = compact ? "h-4 w-4" : "h-5 w-5";
  const badgeClass = compact
    ? "shrink-0 whitespace-nowrap text-[10px] sm:text-[11px]"
    : "shrink-0 whitespace-nowrap";
  const footerClass = compact
    ? "mt-3 flex flex-wrap items-center gap-2 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_84%,transparent)] pt-3"
    : "mt-3 flex flex-wrap items-center gap-2 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_84%,transparent)] pt-3";

  return (
    <article
      id={id}
      className={`ui-summary-card ui-transition-surface ${pad} ${OPERATIONAL_SHELL_BY_TONE[tone]} hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-2)] ${className}`.trim()}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span
            className={`flex shrink-0 items-center justify-center rounded-xl ${iconBox} ${OPERATIONAL_ICON_WRAP_BY_TONE[tone]}`}
          >
            <Icon className={iconSz} strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0 flex-1 pr-1">
            <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
              <p className="ui-kicker">{eyebrow}</p>
              {showStatusBadge ? (
                <StatusBadge status={badge.status} className={`sm:hidden ${badgeClass}`.trim()}>
                  {badge.label}
                </StatusBadge>
              ) : null}
            </div>
            <h3
              className={`mt-1 break-words font-semibold tracking-tight text-[var(--text-primary)] ${
                compact ? "text-sm leading-snug" : "text-[15px] leading-snug"
              }`}
            >
              {headline}
            </h3>
          </div>
        </div>
        {showStatusBadge ? (
          <StatusBadge status={badge.status} className={`hidden sm:inline-flex ${badgeClass}`.trim()}>
            {badge.label}
          </StatusBadge>
        ) : null}
      </div>

      <div className="mt-3">
        <p className={metricClass}>{primaryDisplay}</p>
        {primaryUnit ? (
          <p className={`mt-1 font-medium text-[var(--text-secondary)] ${compact ? "text-[11px]" : "text-[12px]"}`}>{primaryUnit}</p>
        ) : null}
        {secondaryLine && (primaryValue === null || primaryValue === undefined) ? (
          <p className={`mt-1 text-[var(--text-secondary)] ${compact ? "text-[11px]" : "text-[12px]"}`}>{secondaryLine}</p>
        ) : null}
      </div>

      {breakdown.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2" role="list">
          {breakdown.map((row) => (
            <OperationalMetricChip key={row.label} {...row} />
          ))}
        </div>
      ) : null}

      <div className={footerClass}>
        {action.href.startsWith("#") ? (
          <a
            href={action.href}
            className="ui-operational-focusable inline-flex min-w-0 max-w-full items-center gap-1 text-[12px] font-semibold text-[var(--accent-strong)] hover:text-[var(--text-primary)]"
          >
            <span className="truncate">{action.label}</span>
            <span aria-hidden>→</span>
          </a>
        ) : (
          <Link
            href={action.href}
            target={action.external ? "_blank" : undefined}
            rel={action.external ? "noopener noreferrer" : undefined}
            className="ui-operational-focusable inline-flex min-w-0 max-w-full items-center gap-1 text-[12px] font-semibold text-[var(--accent-strong)] hover:text-[var(--text-primary)]"
          >
            <span className="truncate">{action.label}</span>
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
  actionLabel: string;
  hint?: string;
}) {
  const tone = props.tone ?? "neutral";
  const badge = badgeForTone(tone);
  const Icon = props.icon;
  const wrapClass = `ui-operational-focusable ui-transition-surface block rounded-[1.5rem] border border-[var(--border-subtle)] py-3.5 pl-3.5 pr-3.5 shadow-[var(--shadow-1)] hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-2)] ${OPERATIONAL_SHELL_BY_TONE[tone]}`.trim();
  const inner = (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${OPERATIONAL_ICON_WRAP_BY_TONE[tone]}`}
          >
            <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
              <p className="ui-kicker">{props.eyebrow}</p>
              <StatusBadge status={badge.status} className="shrink-0 whitespace-nowrap sm:hidden">
                {badge.label}
              </StatusBadge>
            </div>
            <p className="mt-1 break-words text-sm font-semibold tracking-tight leading-snug text-[var(--text-primary)]">{props.title}</p>
            {props.hint ? <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-[var(--text-secondary)]">{props.hint}</p> : null}
          </div>
        </div>
        <StatusBadge status={badge.status} className="hidden shrink-0 whitespace-nowrap sm:inline-flex">
          {badge.label}
        </StatusBadge>
      </div>
      {props.chips && props.chips.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5" role="list">
          {props.chips.map((c) => (
            <OperationalMetricChip key={c.label} {...c} />
          ))}
        </div>
      ) : null}
      <span className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--accent-strong)]">
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
