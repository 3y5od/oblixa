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
    <div className={`flex flex-wrap items-start justify-between gap-3 ${props.className ?? ""}`.trim()}>
      <div className="min-w-0">
        <p className="ui-eyebrow">{props.eyebrow}</p>
        <h2 className="ui-section-title mt-2 text-xl">{props.title}</h2>
        {props.description ? (
          <p className="ui-muted-tight mt-1 max-w-2xl text-[13px]">{props.description}</p>
        ) : null}
      </div>
      {props.actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{props.actions}</div>
      ) : null}
    </div>
  );
}

/** Compact actionable row for queue columns (dashboard lower, risk lane). */
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
  return (
    <Link
      href={props.href}
      className={`ui-operational-focusable block rounded-xl border border-[var(--border-subtle)] px-3 py-2.5 shadow-[var(--shadow-1)] transition-[border-color,box-shadow] hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-2)] ${OPERATIONAL_SHELL_BY_TONE[tone]}`.trim()}
    >
      {props.eyebrow ? (
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{props.eyebrow}</p>
      ) : null}
      <p className={`font-semibold tracking-tight text-zinc-900 ${props.eyebrow ? "mt-0.5" : ""}`}>{props.title}</p>
      {props.hint ? <p className="mt-1 text-[12px] leading-snug text-zinc-500">{props.hint}</p> : null}
      {props.chips && props.chips.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5" role="list">
          {props.chips.map((c) => (
            <OperationalMetricChip key={c.label} {...c} />
          ))}
        </div>
      ) : null}
      <span className="mt-2 inline-block text-[11px] font-semibold text-[var(--accent)]">{props.actionLabel}</span>
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
      className="ui-metric-chip inline-flex min-h-8 items-center gap-2 rounded-lg border border-zinc-200/90 bg-surface/80 px-2.5 py-1 text-[11px] shadow-[0_1px_0_rgba(15,23,42,0.03)] dark:bg-zinc-900/25"
    >
      <span className="font-medium text-zinc-500">{label}</span>
      <span className="font-semibold tabular-nums text-zinc-900">{value}</span>
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
    ? "text-[1.35rem] font-semibold leading-none tabular-nums tracking-tight text-zinc-950 sm:text-[1.5rem]"
    : "text-[2rem] font-semibold leading-none tabular-nums tracking-tight text-zinc-950 sm:text-[2.125rem]";
  const pad = compact ? "py-3 pl-3 pr-3" : "py-4 pl-4 pr-4";
  const iconBox = compact ? "h-9 w-9" : "h-10 w-10";
  const iconSz = compact ? "h-4 w-4" : "h-5 w-5";

  return (
    <article
      id={id}
      className={`rounded-2xl border border-[var(--border-subtle)] ${pad} ${OPERATIONAL_SHELL_BY_TONE[tone]} ${className}`.trim()}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span
            className={`flex shrink-0 items-center justify-center rounded-xl ${iconBox} ${OPERATIONAL_ICON_WRAP_BY_TONE[tone]}`}
          >
            <Icon className={iconSz} strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{eyebrow}</p>
            <h3 className={`mt-0.5 font-semibold tracking-tight text-zinc-900 ${compact ? "text-sm" : "text-[15px]"}`}>
              {headline}
            </h3>
          </div>
        </div>
        {showStatusBadge ? (
          <StatusBadge status={badge.status} className="shrink-0">
            {badge.label}
          </StatusBadge>
        ) : null}
      </div>

      <div className="mt-3">
        <p className={metricClass}>{primaryDisplay}</p>
        {primaryUnit ? (
          <p className={`mt-1 font-medium text-zinc-500 ${compact ? "text-[11px]" : "text-[12px]"}`}>{primaryUnit}</p>
        ) : null}
        {secondaryLine && (primaryValue === null || primaryValue === undefined) ? (
          <p className={`mt-1 text-zinc-500 ${compact ? "text-[11px]" : "text-[12px]"}`}>{secondaryLine}</p>
        ) : null}
      </div>

      {breakdown.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2" role="list">
          {breakdown.map((row) => (
            <OperationalMetricChip key={row.label} {...row} />
          ))}
        </div>
      ) : null}

      <div className="mt-3 border-t border-zinc-200/60 pt-3 dark:border-zinc-700/50">
        <Link
          href={action.href}
          target={action.external ? "_blank" : undefined}
          rel={action.external ? "noopener noreferrer" : undefined}
          className="ui-operational-focusable inline-block rounded-sm text-[12px] font-semibold text-[var(--accent)] hover:text-zinc-900"
        >
          {action.label}
        </Link>
        {footerExtra}
      </div>
    </article>
  );
}

/**
 * Whole-card link for shortcut grids (action lanes, module hubs).
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
  return (
    <Link
      href={props.href}
      className={`ui-operational-focusable block rounded-2xl border border-[var(--border-subtle)] py-3 pl-3 pr-3 shadow-[var(--shadow-1)] transition-[box-shadow,border-color] hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-2)] ${OPERATIONAL_SHELL_BY_TONE[tone]}`.trim()}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${OPERATIONAL_ICON_WRAP_BY_TONE[tone]}`}
          >
            <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{props.eyebrow}</p>
            <p className="mt-0.5 text-sm font-semibold tracking-tight text-zinc-900">{props.title}</p>
            {props.hint ? <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-zinc-500">{props.hint}</p> : null}
          </div>
        </div>
        <StatusBadge status={badge.status} className="shrink-0">
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
      <span className="mt-2 inline-block text-[12px] font-semibold text-[var(--accent)]">{props.actionLabel}</span>
    </Link>
  );
}
