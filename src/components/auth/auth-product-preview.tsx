import type { ReactNode } from "react";
import { Check, ClipboardCheck, FileText, Users, type LucideIcon } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";

/** One downstream signal row with a reserved status column so badges right-align
 *  to a clean vertical edge. */
function SignalRow({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="inline-flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
        <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" strokeWidth={1.85} />
        {label}
      </span>
      <span className="flex min-w-[6rem] items-center justify-end gap-1.5">{children}</span>
    </div>
  );
}

/**
 * Decorative contract-review artifact — a staged Oblixa review surface, fully
 * `aria-hidden`. It tells the product thesis at a glance: a SUGGESTED detail,
 * its cited source text on a paper inset, the confirm step, and the CONFIRMED
 * owner / evidence / report records that follow. The trust vocabulary
 * (Suggested → Confirmed, Source text, warning/info downstream states) mirrors
 * the real app's StatusBadge recipes rather than inventing new ones.
 */
export function AuthProductPreview() {
  return (
    <div
      aria-hidden
      className="overflow-hidden rounded-[5px] border border-[color:color-mix(in_oklab,var(--text-primary)_22%,var(--border-strong))] bg-[var(--surface-raised)] shadow-[var(--shadow-1)]"
    >
      {/* Contract identity bar */}
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,transparent)] px-3.5 py-2">
        <span className="inline-flex min-w-0 items-center gap-2">
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px] border border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] bg-[var(--surface-raised)] text-[var(--text-tertiary)]">
            <FileText className="h-3 w-3" strokeWidth={1.9} />
          </span>
          <span className="truncate text-[12px] font-semibold tracking-tight text-[var(--text-primary)]">
            Northwind — Master Services Agreement
          </span>
        </span>
        <StatusBadge status="healthy" className="shrink-0">
          Active
        </StatusBadge>
      </div>

      {/* The suggested detail under review */}
      <div className="px-4 pb-3.5 pt-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="ui-caps-3 text-[var(--text-tertiary)]">Detail to confirm</p>
            <p className="mt-1 text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">
              Notice deadline
            </p>
            <p className="mt-0.5 text-[12px] tabular-nums text-[var(--text-secondary)]">
              Aug 14, 2026 · 60-day notice
            </p>
          </div>
          <StatusBadge status="in_review" className="shrink-0">
            Suggested
          </StatusBadge>
        </div>

        {/* Cited source text on a parchment paper inset */}
        <div className="mt-3 rounded-[4px] border border-[color:color-mix(in_oklab,var(--accent-warm)_24%,var(--border-subtle))] bg-[var(--surface-inset)] px-3 py-2">
          <p className="ui-caps-3 mb-1 text-[var(--accent-warm)]">Source text</p>
          <p className="font-mono text-[11px] italic leading-relaxed text-[var(--text-secondary)]">
            “…either party may terminate on sixty (60) days written notice…”
          </p>
        </div>

        {/* Confirm affordance + its operational consequence */}
        <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="inline-flex items-center gap-1.5 rounded-[3px] bg-[var(--accent-strong)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent-fg)]">
            <Check className="h-3 w-3" strokeWidth={2.5} />
            Confirm detail
          </span>
          <span className="text-[11px] leading-snug text-[var(--text-tertiary)]">
            before it drives reminders, tasks, and reports
          </span>
        </div>
      </div>

      {/* Downstream records once confirmed */}
      <div className="space-y-2 border-t border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_32%,transparent)] px-4 py-2.5">
        <p className="ui-caps-3 text-[var(--text-tertiary)]">Then it becomes accountable</p>
        <SignalRow icon={Users} label="Owner assigned">
          <StatusBadge status="healthy">Confirmed</StatusBadge>
        </SignalRow>
        <SignalRow icon={ClipboardCheck} label="Evidence request">
          <StatusBadge status="warning">Due 5d</StatusBadge>
        </SignalRow>
        <SignalRow icon={FileText} label="Renewal report">
          <StatusBadge status="info">Ready</StatusBadge>
        </SignalRow>
      </div>
    </div>
  );
}
