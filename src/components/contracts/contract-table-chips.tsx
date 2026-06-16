import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  ChevronRight,
  Plus,
  UserCog,
  UserPlus,
} from "lucide-react";
import { RowActionMenu, RowActionMenuItem } from "@/components/ui/row-action-menu";

type CellChipTone = "danger" | "warning" | "success" | "neutral";

const CELL_CHIP_BASE =
  "inline-flex items-center gap-1 whitespace-nowrap rounded-md border bg-transparent px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]";

const CELL_CHIP_TONE: Record<CellChipTone, string> = {
  danger:
    "border-[color:color-mix(in_oklab,var(--danger-ink)_30%,var(--border-subtle))] text-[var(--danger-ink)] hover:bg-[color:color-mix(in_oklab,var(--danger-soft)_20%,transparent)]",
  warning:
    "border-[color:color-mix(in_oklab,var(--warning-ink)_26%,var(--border-subtle))] text-[var(--warning-ink)] hover:bg-[color:color-mix(in_oklab,var(--warning-soft)_22%,transparent)]",
  success:
    "border-[color:color-mix(in_oklab,var(--success-ink)_30%,var(--border-subtle))] text-[var(--success-ink)] hover:bg-[color:color-mix(in_oklab,var(--success-soft)_22%,transparent)]",
  neutral:
    "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[color:color-mix(in_oklab,var(--accent)_30%,var(--border-subtle))] hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,transparent)] hover:text-[var(--accent-strong)]",
};

export function CellChip({
  href,
  tone,
  dashed,
  ariaLabel,
  title,
  children,
}: {
  href: string;
  tone: CellChipTone;
  dashed?: boolean;
  ariaLabel?: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      title={title}
      className={`${CELL_CHIP_BASE} ${CELL_CHIP_TONE[tone]}${dashed ? " border-dashed" : ""}`}
    >
      {children}
    </Link>
  );
}

export function RowActionsMenu({
  contractId,
  hasOwner,
}: {
  contractId: string;
  hasOwner: boolean;
}) {
  const iconClass = "h-3.5 w-3.5 shrink-0";
  return (
    <RowActionMenu menuLabel="Contract row actions" triggerLabel="Row actions">
      <RowActionMenuItem
        href={`/contracts/${contractId}#ownership-record`}
        icon={
          hasOwner ? (
            <UserCog className={iconClass} strokeWidth={1.85} aria-hidden />
          ) : (
            <UserPlus className={iconClass} strokeWidth={1.85} aria-hidden />
          )
        }
      >
        {hasOwner ? "Reassign owner" : "Assign owner"}
      </RowActionMenuItem>
      <RowActionMenuItem
        href={`/contracts/${contractId}#extracted-fields`}
        icon={<CheckCheck className={iconClass} strokeWidth={1.85} aria-hidden />}
      >
        Confirm details
      </RowActionMenuItem>
      <RowActionMenuItem
        href={`/contracts/${contractId}#dates`}
        icon={<Bell className={iconClass} strokeWidth={1.85} aria-hidden />}
      >
        Add reminder
      </RowActionMenuItem>
      <RowActionMenuItem
        href={`/contracts/${contractId}#contract-tasks`}
        icon={<Plus className={iconClass} strokeWidth={1.85} aria-hidden />}
      >
        Create task
      </RowActionMenuItem>
    </RowActionMenu>
  );
}

export function OpenContractChip({
  contractId,
  title,
}: {
  contractId: string;
  title: string;
}) {
  return (
    <Link
      href={`/contracts/${contractId}`}
      aria-label={`Open contract: ${title}`}
      className="group/open inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_24%,var(--surface-raised))] px-2 text-[10px] font-semibold uppercase leading-none text-[var(--accent-strong)] opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_46%,var(--surface-raised))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
    >
      Open
      <ChevronRight
        className="h-3 w-3 transition-transform group-hover/open:translate-x-0.5"
        strokeWidth={2}
        aria-hidden
      />
    </Link>
  );
}

export function ExceptionAlertChip({
  contractId,
  count,
}: {
  contractId: string;
  count: number;
}) {
  return (
    <Link
      href={`/contracts/exceptions?status=open&contract=${contractId}`}
      aria-label={`${count} open ${count === 1 ? "problem" : "problems"}`}
      title={`${count} open ${count === 1 ? "problem" : "problems"} on this contract`}
      className="inline-flex h-[22px] shrink-0 items-center gap-1 rounded-[2px] border border-[color:color-mix(in_oklab,var(--danger-soft)_52%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--danger-soft)_50%,transparent)] px-2 text-[10.5px] font-semibold uppercase leading-none tabular-nums text-[var(--danger-ink)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--danger-soft)_78%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
    >
      <AlertTriangle className="h-3 w-3" strokeWidth={2} aria-hidden />
      {/* Visible object type, not just a bare count (no unlabeled icon). */}
      <span className="tabular-nums">{count}</span>
      <span>{count === 1 ? "problem" : "problems"}</span>
    </Link>
  );
}
