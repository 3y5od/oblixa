import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

// Touch-aware hover chip: visible at rest on touch (no hover:hover), revealed on
// hover/focus on pointer devices (§8.6 / §Rows). One definition replaces the
// per-row duplicated hover-chip class strings.
const HOVER_CHIP_CLASS =
  "inline-flex items-center gap-0.5 whitespace-nowrap rounded-md border border-[color:color-mix(in_oklab,var(--accent)_30%,var(--border-card))] bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,var(--surface-raised))] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] leading-none text-[var(--accent-strong)] transition-opacity duration-150 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-visible:opacity-100";

// Default hover/focus accent rail (grows on hover AND focus so the focus state
// matches hover, §Rows). Suppressed when a persistent tone rail is shown.
const ACCENT_HOVER_RAIL =
  "before:absolute before:left-0 before:top-1/2 before:h-0 before:w-[2.5px] before:-translate-y-1/2 before:rounded-full before:bg-gradient-to-b before:from-[var(--accent-strong)] before:to-[color:color-mix(in_oklab,var(--accent-strong)_70%,transparent)] before:transition-all before:duration-200 hover:before:h-[70%] focus-visible:before:h-[70%]";

export interface DashboardActionRowProps {
  href: string;
  /** Persistent left rail for at-risk rows; omit for the default hover accent rail. */
  rail?: "danger" | "warning";
  /** Leading icon/medallion slot. */
  leading?: ReactNode;
  /** Optional line above the title (e.g. a provenance ChipPair). */
  eyebrow?: ReactNode;
  title: ReactNode;
  /** Metadata line under the title. */
  meta?: ReactNode;
  /** Hover/focus-revealed action verb (e.g. "Open", "Resolve", "Review fields"). */
  hoverAction: string;
  /** Right-edge slot (e.g. a date stack). */
  trailing?: ReactNode;
  ariaLabel?: string;
  minHeightClassName?: string;
  paddingClassName?: string;
  className?: string;
}

function railInk(rail?: "danger" | "warning"): string | null {
  if (rail === "danger") return "var(--danger-ink)";
  if (rail === "warning") return "var(--warning-ink)";
  return null;
}

/**
 * One row recipe for review / deadline / work / data-gap lists: a Link with a
 * left rail (persistent tone for at-risk rows, otherwise a hover/focus accent
 * rail), an optional leading medallion, a stacked eyebrow/title/meta column, a
 * touch-aware hover action chip, and an optional trailing slot. Hover and focus
 * share the same rail + background (§Rows).
 */
export function DashboardActionRow({
  href,
  rail,
  leading,
  eyebrow,
  title,
  meta,
  hoverAction,
  trailing,
  ariaLabel,
  minHeightClassName,
  paddingClassName,
  className,
}: DashboardActionRowProps) {
  const ink = railInk(rail);
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={`group relative flex items-center gap-3 rounded-[6px] px-3 ${
        paddingClassName ?? "py-3"
      } ${minHeightClassName ?? "min-h-[3rem]"} transition-colors duration-200 hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_12%,transparent)] focus-visible:bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,transparent)] focus-visible:outline-none ${
        ink ? "" : ACCENT_HOVER_RAIL
      } ${className ?? ""}`.trim()}
    >
      {ink ? (
        <span
          aria-hidden
          className="pointer-events-none absolute left-0 top-1/2 h-[58%] w-[2.5px] -translate-y-1/2 rounded-full"
          style={{
            background: `linear-gradient(to bottom, ${ink}, color-mix(in oklab, ${ink} 65%, transparent))`,
          }}
        />
      ) : null}
      {leading}
      <div className="min-w-0 flex-1">
        {eyebrow}
        {title}
        {meta}
      </div>
      <div className="flex shrink-0 items-center gap-2 self-center">
        <span aria-hidden className={HOVER_CHIP_CLASS}>
          {hoverAction}
          <ChevronRight className="h-2.5 w-2.5" strokeWidth={1.85} />
        </span>
        {trailing}
      </div>
    </Link>
  );
}
