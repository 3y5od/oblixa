import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";

export interface DashboardEmptyStateProps {
  icon: LucideIcon;
  /** Caps-tracking label (e.g., "NO PINS"). */
  label: string;
  /** Optional caps-tracking secondary hint (e.g., "PIN A SEARCH"). */
  hint?: string;
  /** Action shown as a structured button. */
  action?: { href: string; label: string };
  /** Compact spacing variant. */
  compact?: boolean;
}

/**
 * Compact zero-state for inline use inside right-rail and section panels.
 * Replaces prose-paragraph empty states with structured icon + caps label +
 * caps hint + action button. Distinct from the larger page-level `EmptyState`
 * primitive in `@/components/ui/empty-state`.
 */
export function DashboardEmptyState({
  icon: Icon,
  label,
  hint,
  action,
  compact = false,
}: DashboardEmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-start gap-2 ${compact ? "py-1" : "py-2"}`}
    >
      <div className="flex items-center gap-2">
        <Icon
          className="h-3.5 w-3.5 text-[var(--text-tertiary)]"
          strokeWidth={1.85}
          aria-hidden
        />
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
          {label.toUpperCase()}
        </span>
      </div>
      {hint ? (
        <span className="text-[10.5px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
          {hint.toUpperCase()}
        </span>
      ) : null}
      {action ? (
        <Link
          href={action.href}
          className="inline-flex items-center gap-1 rounded-md border border-[var(--border-card)] bg-[var(--surface-raised)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-strong)] transition-colors hover:border-[color:color-mix(in_oklab,var(--accent)_42%,var(--border-strong))] hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_20%,transparent)]"
        >
          {action.label.toUpperCase()}
          <ArrowRight className="h-3 w-3" strokeWidth={1.85} aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}
