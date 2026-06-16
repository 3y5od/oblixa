import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  OPERATIONAL_ICON_WRAP_BY_TONE,
  OPERATIONAL_SHELL_BY_TONE,
} from "@/lib/ui/operational-surface";
import { countAwareLabel } from "./operational-summary-card-labels";
import { OperationalMetricChip } from "./operational-summary-card-primitives";
import { badgeForTone } from "./operational-summary-card-status";
import type { OperationalSummaryCardProps, OperationalSurfaceLinkCardProps } from "./operational-summary-card-types";

export function OperationalSummaryCard(props: OperationalSummaryCardProps) {
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
    primaryValue !== null && primaryValue !== undefined ? String(primaryValue) : (primaryFallback ?? "\u2014");
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
            <span className={`ui-icon-tile${compact ? "-compact" : ""} shrink-0 ${iconBox} ${OPERATIONAL_ICON_WRAP_BY_TONE[tone]}`.trim()}>
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
              <h3 className={`mt-1.5 break-words font-semibold tracking-tight text-[var(--text-primary)] ${compact ? "text-sm leading-snug" : hero ? "text-[1.2rem] leading-[1.15] sm:text-[1.35rem]" : "text-[14px] leading-snug"}`}>
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
        <OperationalCardAction action={action} compact={compact} />
        {footerExtra ? <div className="min-w-0 flex-1">{footerExtra}</div> : null}
      </div>
    </article>
  );
}

function OperationalCardAction({
  action,
  compact,
}: {
  action: OperationalSummaryCardProps["action"];
  compact: boolean;
}) {
  const content = (
    <>
      {compact ? null : <span>{action.label}</span>}
      <span aria-hidden>{"\u2192"}</span>
    </>
  );
  const props = {
    "aria-label": compact ? action.label : undefined,
    className: "ui-operational-focusable ui-operational-action",
  };
  return action.href.startsWith("#") ? (
    <a href={action.href} {...props}>
      {content}
    </a>
  ) : (
    <Link href={action.href} target={action.external ? "_blank" : undefined} rel={action.external ? "noopener noreferrer" : undefined} {...props}>
      {content}
    </Link>
  );
}

export function OperationalSurfaceLinkCard(props: OperationalSurfaceLinkCardProps) {
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
        <span aria-hidden>{"\u2192"}</span>
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
