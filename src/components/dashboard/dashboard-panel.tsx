import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ActionChip } from "@/components/ui/action-chip";
import { CountChip } from "@/components/ui/count-chip";
import type { StatTone } from "@/components/ui/stat-cell";

export interface DashboardPanelAction {
  label: string;
  href: string;
  tone?: StatTone;
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
  /** Optional sentence-case panel action (e.g. "Review fields"). */
  action?: DashboardPanelAction;
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
  action,
  className,
}: DashboardPanelHeaderProps) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)] px-4 py-3 ${className ?? ""}`.trim()}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <span
          aria-hidden
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,var(--surface-raised))] text-[var(--text-tertiary)]"
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={1.85} />
        </span>
        <div className="min-w-0">
          <h2
            id={titleId}
            className="ui-caps-2 inline-flex min-w-0 items-center gap-1.5 text-[11px] text-[var(--text-secondary)]"
          >
            <span className="min-w-0 truncate">{title}</span>
            {typeof count === "number" && count > 0 ? (
              <CountChip value={count} emphasis="strong" className="shrink-0" />
            ) : null}
          </h2>
          {description ? (
            <p className="mt-1 max-w-2xl text-[12px] font-medium leading-snug tracking-normal text-[var(--text-tertiary)]">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {action ? (
        <ActionChip verb={action.label} href={action.href} tone={action.tone} className="shrink-0" />
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
  action?: DashboardPanelAction;
  /** Optional footer node (e.g. "Showing 6 of 104"). */
  footer?: ReactNode;
  children: ReactNode;
  /** Extra classes on the section surface. */
  className?: string;
  /** Body padding override; defaults to the standard `p-2`. */
  bodyClassName?: string;
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
  action,
  footer,
  children,
  className,
  bodyClassName,
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
        action={action}
      />
      <div className={bodyClassName ?? "p-2"}>{children}</div>
      {footer}
    </section>
  );
}
