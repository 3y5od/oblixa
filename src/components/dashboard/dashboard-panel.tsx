import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ActionChip } from "@/components/ui/action-chip";
import type { StatTone } from "@/components/ui/stat-cell";

export interface DashboardPanelAction {
  label: string;
  href: string;
  tone?: StatTone;
  /** Render the action as a quiet ghost link (subordinate section actions). */
  quiet?: boolean;
}

export interface DashboardPanelHeaderProps {
  /** Lucide glyph for the neutral 24px icon tile. */
  icon: LucideIcon;
  title: string;
  /** Short sentence explaining what this panel is for. */
  description?: string;
  /** Id applied to the heading so a wrapping panel can `aria-labelledby` it. */
  titleId?: string;
  /** Section total. Rendered as a count chip attached to the title (omit / 0 → none). */
  count?: number;
  /** Optional object-class noun (plural) for the count chip ("6 tasks"). */
  countUnit?: string;
  /** Optional sentence-case panel action (e.g. "Review fields"). */
  action?: DashboardPanelAction;
  /** Tighter header for the right context rail. */
  compact?: boolean;
  className?: string;
}

/**
 * Canonical panel header: neutral icon tile + caps title with the count chip
 * attached directly to the title (not floating after the caps label) + an
 * optional sentence-case ActionChip. One recipe for every dashboard panel so
 * section chrome stays consistent (§Panel Headers).
 */
export function DashboardPanelHeader({
  icon: Icon,
  title,
  description,
  titleId,
  count,
  countUnit,
  action,
  compact,
  className,
}: DashboardPanelHeaderProps & { compact?: boolean }) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)] ${compact ? "px-3.5 py-2.5" : "px-4 py-3"} ${className ?? ""}`.trim()}
    >
      <div className="flex min-w-0 items-start gap-2">
        {/* Bare quiet glyph — the title carries panel identity; a boxed icon tile
            per panel reads as repeated component noise (§Navigation: identity
            through title/content, not icon tiles). */}
        <Icon
          aria-hidden
          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-tertiary)]"
          strokeWidth={1.85}
        />
        <div className="min-w-0">
          <h2
            id={titleId}
            className={`inline-flex min-w-0 items-baseline gap-2 font-bold tracking-tight text-[var(--text-primary)] ${compact ? "text-[13.5px]" : "text-[15px]"}`}
          >
            <span className="min-w-0">{title}</span>
            {/* Count is quiet metadata, not a bordered chip — a chip reads like a
                form control beside a heading (§ counts ≠ statuses). */}
            {typeof count === "number" && count > 0 ? (
              <span className="shrink-0 text-[12.5px] font-medium tabular-nums text-[var(--text-tertiary)]">
                <span aria-hidden className="mr-1.5 text-[color:color-mix(in_oklab,var(--text-tertiary)_55%,transparent)]">&middot;</span>
                {count}
                {countUnit ? ` ${count === 1 ? countUnit.replace(/s$/, "") : countUnit}` : ""}
              </span>
            ) : null}
          </h2>
          {description ? (
            <p className="mt-1 max-w-2xl text-[12.5px] font-medium leading-snug tracking-normal text-[var(--text-secondary)]">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {action ? (
        <ActionChip verb={action.label} href={action.href} tone={action.tone} quiet={action.quiet} className="shrink-0" />
      ) : null}
    </div>
  );
}

export interface DashboardPanelProps {
  /** Heading id — applied to the header's h2 and the section's aria-labelledby. */
  titleId: string;
  icon: LucideIcon;
  title: string;
  description?: string;
  count?: number;
  countUnit?: string;
  action?: DashboardPanelAction;
  /** Optional footer node (e.g. "Showing 6 of 104"). */
  footer?: ReactNode;
  children: ReactNode;
  /** Extra classes on the section surface. */
  className?: string;
  /** Body padding override; defaults to the standard `p-2`. */
  bodyClassName?: string;
  /** Tighter header for the right context rail. */
  compact?: boolean;
}

/**
 * Standard dashboard content panel: a calmer `ui-card` surface (the metric strip
 * is the page's single raised focal surface, §10.6) wrapping a canonical header,
 * a body, and an optional footer. Replaces the hand-built SectionShell markup so
 * every panel shares one structure (§Shared Primitives).
 */
export function DashboardPanel({
  titleId,
  icon,
  title,
  description,
  count,
  countUnit,
  action,
  footer,
  children,
  className,
  bodyClassName,
  compact,
}: DashboardPanelProps) {
  return (
    <section
      aria-labelledby={titleId}
      className={`ui-card min-w-0 overflow-hidden ${className ?? ""}`.trim()}
    >
      <DashboardPanelHeader
        icon={icon}
        title={title}
        description={description}
        titleId={titleId}
        count={count}
        countUnit={countUnit}
        action={action}
        compact={compact}
      />
      <div className={bodyClassName ?? "p-2"}>{children}</div>
      {footer}
    </section>
  );
}
