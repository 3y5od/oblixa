import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";

export interface DashboardEmptyStateProps {
  icon: LucideIcon;
  /** Empty-state label (e.g., "No pinned searches"). */
  label: string;
  /** Optional secondary hint explaining absence and next step. */
  hint?: string;
  /** Action shown as a structured button. */
  action?: { href: string; label: string };
  /** Compact spacing variant. */
  compact?: boolean;
  /** When true (default, for backward-compat), the label and hint are forced to
   *  uppercase. Pass false to render label, hint, and action in sentence case
   *  (the intake/empty-state register — caps reserved for the page eyebrow). */
  uppercase?: boolean;
}

/**
 * Compact zero-state for inline use inside right-rail and section panels.
 * Replaces prose-paragraph empty states with a structured icon + label + hint +
 * action button. Distinct from the larger page-level `EmptyState` primitive in
 * `@/components/ui/empty-state`.
 */
export function DashboardEmptyState({
  icon: Icon,
  label,
  hint,
  action,
  compact = false,
  uppercase = true,
}: DashboardEmptyStateProps) {
  const caps = uppercase
    ? "font-semibold uppercase tracking-[0.14em]"
    : "font-medium";
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
        <span className={`text-[12px] text-[var(--text-secondary)] ${caps}`}>
          {uppercase ? label.toUpperCase() : label}
        </span>
      </div>
      {hint ? (
        <span
          className={`text-[11px] text-[var(--text-tertiary)] ${
            uppercase ? "uppercase tracking-[0.12em]" : "leading-snug"
          }`}
        >
          {uppercase ? hint.toUpperCase() : hint}
        </span>
      ) : null}
      {action ? (
        <Link
          href={action.href}
          className={`inline-flex items-center gap-1 rounded-md border border-[var(--border-card)] bg-[var(--surface-raised)] px-2.5 py-1 text-[11px] text-[var(--accent-strong)] transition-colors hover:border-[color:color-mix(in_oklab,var(--accent)_42%,var(--border-strong))] hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_20%,transparent)] ${
            uppercase ? "font-semibold uppercase tracking-[0.14em]" : "font-medium"
          }`}
        >
          {uppercase ? action.label.toUpperCase() : action.label}
          <ArrowRight className="h-3 w-3" strokeWidth={1.85} aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}
