import Link from "next/link";
import {
  BadgeCheck,
  CalendarClock,
  FileText,
  ListChecks,
  Paperclip,
  TriangleAlert,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import type { WorkItemRow, WorkTypeKey } from "@/lib/work/types";

const WORK_TYPE_ICONS: Record<WorkTypeKey, LucideIcon> = {
  contract_task: ListChecks,
  obligation: FileText,
  approval: BadgeCheck,
  exception: TriangleAlert,
  evidence_request: Paperclip,
  renewal_checkpoint: CalendarClock,
  unassigned_work: UserPlus,
};

// Red-rebalance: ONLY the cannot-proceed tier carries a colored left rail. A
// past-due-but-actionable row gets NO amber rail — its single restrained amber
// cue lives in the due column — so the eye lands on the one blocked record and
// reads the rest of the queue calmly (product direction; §7 trust states).
export function rowRailStyle(row: WorkItemRow): { boxShadow: string } | undefined {
  if (row.rowEmphasis === "critical") {
    return { boxShadow: "inset 3px 0 0 0 var(--danger-ink)" };
  }
  return undefined;
}

// Material record sheet for the supporting block (contract / owner / due /
// status). The cannot-proceed row gets a faintly danger-washed parchment so the
// blocked record reads as a distinct object; every other row reads as the same
// quiet cool sheet. Subtle background blocks (not just ruled lines) give each
// record internal structure (§6 composition; §13 surface roles).
export function recordBlockStyle(row: WorkItemRow): {
  background: string;
  borderColor: string;
} {
  if (row.recordTone === "critical") {
    return {
      background: "color-mix(in oklab, var(--danger-soft) 26%, var(--surface-raised))",
      borderColor: "color-mix(in oklab, var(--danger-ink) 16%, var(--border-subtle))",
    };
  }
  return {
    background: "color-mix(in oklab, var(--surface-cool) 50%, var(--surface-raised))",
    borderColor: "color-mix(in oklab, var(--border-strong) 26%, var(--border-subtle))",
  };
}

export function WorkTypeIcon({ row, label }: { row: WorkItemRow; label: string }) {
  const Icon = WORK_TYPE_ICONS[row.type];
  // Red-rebalance: only the cannot-proceed row gets an oxblood-tinted type tile.
  // A past-due row keeps the neutral parchment tile — its amber cue is in the due
  // column alone — so the queue's type tiles don't read as a column of amber.
  const ink = row.rowEmphasis === "critical" ? "var(--danger-ink)" : null;
  return (
    <span
      title={label}
      aria-hidden
      className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border"
      style={{
        borderColor: ink
          ? `color-mix(in oklab, ${ink} 32%, var(--border-card))`
          : "color-mix(in oklab, var(--border-strong) 28%, var(--border-subtle))",
        background: ink
          ? `color-mix(in oklab, ${ink} 13%, var(--surface-raised))`
          : "color-mix(in oklab, var(--surface-inset) 60%, var(--surface-raised))",
        color: ink ?? "var(--text-secondary)",
      }}
    >
      <Icon className="h-4 w-4" strokeWidth={1.85} aria-hidden />
    </span>
  );
}

export function WorkStatusBadge({ row, className = "" }: { row: WorkItemRow; className?: string }) {
  if (row.isCritical) {
    // The cannot-proceed tier always wears the oxblood FILLED badge — never amber.
    // `statusTone` can resolve to "overdue" on a row that is both blocked and past
    // due, which would paint the badge amber and contradict the rebalance, so the
    // critical badge is pinned to the danger tone here (red-rebalance).
    const criticalTone = row.statusTone === "overdue" ? "critical" : row.statusTone;
    return (
      <StatusBadge status={criticalTone} className={`gap-1.5 ${className}`.trim()}>
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 rounded-full bg-current"
          style={{ boxShadow: "0 0 0 2px color-mix(in oklab, currentColor 22%, transparent)" }}
        />
        {row.statusLabel}
      </StatusBadge>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[12px] font-semibold tracking-tight ${className}`.trim()}
      style={{ color: row.statusInk }}
    >
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-current"
        style={{ boxShadow: "0 0 0 2px color-mix(in oklab, currentColor 20%, transparent)" }}
      />
      {row.statusLabel}
    </span>
  );
}

export function WorkNextActionNote({ row }: { row: WorkItemRow }) {
  if (!row.nextActionNote) return null;
  // Only the cannot-proceed tier's dependency reason gets the danger-ruled
  // subregion — a small oxblood-washed block so the blocked reason reads as a
  // distinct consequence. Every other note (including past-due rows) is quiet
  // secondary text, no rule, no color (red-rebalance; §6 anti-noise).
  const danger = row.nextActionTone === "danger";
  if (danger) {
    return (
      <p
        className="mt-1.5 max-w-[38rem] rounded-r-sm border-l-2 py-0.5 pl-2 text-[12px] font-medium leading-snug"
        style={{
          color: "var(--danger-ink)",
          borderColor: "color-mix(in oklab, var(--danger-ink) 60%, transparent)",
          background: "color-mix(in oklab, var(--danger-soft) 34%, transparent)",
        }}
      >
        {row.nextActionNote}
      </p>
    );
  }
  return (
    <p className="mt-1.5 max-w-[38rem] text-[12px] font-medium leading-snug text-[var(--text-secondary)]">
      {row.nextActionNote}
    </p>
  );
}

export function WorkDue({ row }: { row: WorkItemRow }) {
  if (!row.dueAt || !row.duePrimaryLabel) {
    return <span className="text-[12px] text-[var(--text-tertiary)]">No due date</span>;
  }
  // The due column is the ONLY place a past-due-but-actionable row carries amber:
  // a small restrained "Past due by N days" cue. Due-today/soon also read amber;
  // anything further out is quiet tertiary text. Oxblood is never used here — the
  // cannot-proceed signal lives on the status badge and rail (red-rebalance).
  const amber = row.dueState === "overdue" || row.dueState === "due_today" || row.dueState === "due_soon";
  return (
    <span className="flex flex-col items-start gap-1 tabular-nums">
      <span className="text-[12.5px] font-medium text-[var(--text-primary)]">
        {row.duePrimaryLabel}
      </span>
      {row.dueRelativeLabel ? (
        amber ? (
          <span
            className="inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10.5px] font-semibold leading-none"
            style={{
              color: "var(--warning-ink)",
              background: "color-mix(in oklab, var(--warning-soft) 52%, transparent)",
              boxShadow: "inset 0 0 0 1px color-mix(in oklab, var(--warning-ink) 22%, transparent)",
            }}
          >
            {row.dueRelativeLabel}
          </span>
        ) : (
          <span className="text-[11px] font-medium text-[var(--text-tertiary)]">
            {row.dueRelativeLabel}
          </span>
        )
      ) : null}
    </span>
  );
}

export function WorkOwnerCell({ row }: { row: WorkItemRow }) {
  if (row.ownerLabel === "Unassigned") {
    return (
      <span
        className="block truncate text-[12px] font-medium"
        style={{ color: "var(--warning-ink)" }}
        title="No owner assigned"
      >
        Unassigned
      </span>
    );
  }
  const initial = row.ownerLabel.trim().charAt(0).toUpperCase() || "?";
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span
        aria-hidden
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_72%,var(--surface-raised))] text-[10px] font-semibold leading-none text-[var(--text-secondary)]"
      >
        {initial}
      </span>
      <span className="block min-w-0 flex-1 truncate text-[12.5px] text-[var(--text-primary)]" title={row.ownerLabel}>
        {row.ownerLabel}
      </span>
    </span>
  );
}

export function WorkContractCell({ row, max }: { row: WorkItemRow; max: string }) {
  const contract = row.display.identity.linkedContract;
  return (
    <span className="block min-w-0">
      {contract.href ? (
        <Link
          href={contract.href}
          title={contract.value}
          className={`block ${max} truncate text-[12.5px] text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-strong)]`}
        >
          {contract.value}
        </Link>
      ) : (
        <span className={`block ${max} truncate text-[12.5px] text-[var(--text-tertiary)]`}>
          {contract.value}
        </span>
      )}
      {row.counterparty ? (
        <span className={`block ${max} truncate text-[11px] text-[var(--text-tertiary)]`} title={row.counterparty}>
          {row.counterparty}
        </span>
      ) : null}
    </span>
  );
}
