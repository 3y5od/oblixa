import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { StatTone } from "@/components/ui/stat-cell";
import { TimeChip } from "@/components/ui/time-chip";

export interface ActivityFeedItem {
  id: string;
  icon: LucideIcon;
  tone?: StatTone;
  /** Caps-tracking action verb (e.g., "EXTRACTED"). */
  verb: string;
  /** Optional caps quantity / detail chip (e.g., "12 FIELDS"). */
  detail?: string;
  /** Optional contract / target name shown as a structured chip. */
  target?: string;
  /** Optional actor name shown as an avatar-adjacent muted chip. */
  actor?: string;
  timestamp: Date | string;
  href?: string;
}

export interface ActivityFeedProps {
  items: ActivityFeedItem[];
  compact?: boolean;
  emptyLabel?: string;
  className?: string;
}

function toneInk(tone?: StatTone): string {
  if (tone === "success") return "var(--success-ink)";
  if (tone === "warning") return "var(--warning-ink)";
  if (tone === "danger") return "var(--danger-ink)";
  return "var(--text-tertiary)";
}

export function ActivityFeed({
  items,
  compact = false,
  emptyLabel = "NO RECENT ACTIVITY",
  className,
}: ActivityFeedProps) {
  if (items.length === 0) {
    return (
      <p
        className={`text-[10.5px] uppercase tracking-[0.14em] font-semibold text-[var(--text-tertiary)] ${className ?? ""}`.trim()}
      >
        {emptyLabel.toUpperCase()}
      </p>
    );
  }

  return (
    <ul
      className={`divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_45%,transparent)] space-y-${compact ? "1" : "1.5"} ${className ?? ""}`.trim()}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const ink = toneInk(item.tone);
        const inner = (
          <>
            <span
              aria-hidden
              className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center"
              style={{ color: ink }}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={1.85} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-[10.5px] uppercase tracking-[0.12em] leading-tight">
                <span className="font-bold" style={{ color: ink }}>
                  {item.verb.toUpperCase()}
                </span>
                {item.detail ? (
                  <span className="font-medium tabular-nums text-[var(--text-secondary)]">
                    {item.detail.toUpperCase()}
                  </span>
                ) : null}
              </p>
              {item.target || item.actor ? (
                <p className="mt-0.5 flex items-center gap-1.5 truncate text-[10.5px] text-[var(--text-tertiary)]">
                  {item.target ? (
                    <span
                      className="inline-flex max-w-[12rem] items-center rounded-md border border-[var(--border-card)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] leading-none text-[var(--text-secondary)]"
                      title={item.target}
                    >
                      <span className="truncate">{item.target}</span>
                    </span>
                  ) : null}
                  {item.actor ? (
                    <span className="truncate text-[var(--text-tertiary)]">
                      {item.actor}
                    </span>
                  ) : null}
                </p>
              ) : null}
            </div>
            <TimeChip
              date={item.timestamp}
              className="shrink-0 self-center text-[var(--text-tertiary)]"
            />
          </>
        );
        const rowClass =
          "flex items-start gap-2.5 rounded-md px-2 py-1.5 transition-colors";
        return (
          <li key={item.id}>
            {item.href ? (
              <Link
                href={item.href}
                className={`${rowClass} hover:bg-[var(--surface-tint-soft)] focus-visible:bg-[var(--surface-tint-soft)] focus-visible:outline-none`}
              >
                {inner}
              </Link>
            ) : (
              <div className={rowClass}>{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
