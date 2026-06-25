"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { ReactNode } from "react";
import {
  ArrowRight,
  CalendarClock,
  Check,
  MessageSquare,
  Paperclip,
  Undo2,
  UserCog,
} from "lucide-react";
import { completeWorkItem, updateContractTaskStatus } from "@/actions/tasks";
import { updateContractObligation } from "@/actions/obligations";
import { PermissionEligibilityHint } from "@/components/ui/permission-eligibility-hint";
import { RowActionMenu, RowActionMenuItem } from "@/components/ui/row-action-menu";
import type { WorkActionKey, WorkItemRow } from "@/lib/work/types";

// Escalate intentionally has no icon: the locked verdict removes the escalate
// menu entry as a no-op duplicate verb, so only the real Core workflow actions
// map here. The reserved icon slot below renders even when a key is unmapped,
// so a missing icon never shifts the item label.
const MENU_ICONS: Partial<Record<WorkActionKey, ReactNode>> = {
  reassign: <UserCog className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />,
  change_due_date: <CalendarClock className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />,
  comment: <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />,
  link_evidence: <Paperclip className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />,
};

// Shared geometry so every primary control holds the same 32px height + column
// edge regardless of verb length, and the reserved Actions slot never shifts
// (§10.9). `h-8` + `min-w-[5.5rem]` enforce it on both the act-in-place mutation
// (leading Check + Undo flow) and the navigating link.
const PRIMARY_BASE =
  "group inline-flex h-8 min-w-[5.5rem] items-center justify-center gap-1.5 whitespace-nowrap rounded-md border px-3 text-[11.5px] font-semibold leading-none transition-[color,background-color,border-color,transform] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 active:translate-y-px disabled:opacity-60";

// Routine rows (complete / approve / review on a healthy task) keep the quietest
// affordance: ghost at rest, faint accent only on hover. A column of repeated
// Mark-complete / Review-details actions must NOT blanket the queue edge — so the
// cannot-proceed action below stays the loudest control in the row (product
// direction; §15 restrained actions).
const PRIMARY_QUIET =
  "border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] bg-transparent font-medium text-[var(--text-tertiary)] hover:border-[color:color-mix(in_oklab,var(--accent)_34%,var(--border-card))] hover:bg-[color:color-mix(in_oklab,var(--accent-strong)_6%,var(--surface-raised))] hover:text-[var(--accent-strong)] focus-visible:outline-[color:color-mix(in_oklab,var(--accent)_55%,transparent)]";

// Cannot-proceed rows ONLY: the action that clears the dependency is the dominant
// control in the row — a danger-toned filled pill that earns the eye over every
// quiet action elsewhere. Reserved for the blocked/critical tier so the queue
// edge isn't a column of red (red-rebalance; §15 restrained actions).
const PRIMARY_CRITICAL =
  "border-[color:color-mix(in_oklab,var(--danger-ink)_32%,var(--border-card))] bg-[color:color-mix(in_oklab,var(--danger-soft)_70%,var(--surface-raised))] text-[var(--danger-ink)] hover:border-[color:color-mix(in_oklab,var(--danger-ink)_55%,var(--border-card))] hover:bg-[color:color-mix(in_oklab,var(--danger-soft)_92%,var(--surface-raised))] focus-visible:outline-[color:color-mix(in_oklab,var(--danger-ink)_55%,transparent)]";

export function WorkReleaseActions({
  row,
  mutationsEnabled,
}: {
  row: WorkItemRow;
  mutationsEnabled: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  // Holds the pending commit (refresh) timer during the undo window.
  const commitTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (commitTimer.current != null) window.clearTimeout(commitTimer.current);
    },
    []
  );

  if (!mutationsEnabled) {
    return (
      <div className="max-w-[15rem] text-[11.5px]">
        <PermissionEligibilityHint
          variant="not_permitted"
          actionLabel="Workspace roles"
          actionHref="/settings"
        />
      </div>
    );
  }

  function runPrimaryMutation() {
    if (row.primaryAction.kind !== "mutation") return;
    const mutation = row.primaryAction.mutation;
    setError(null);
    startTransition(async () => {
      const result =
        mutation === "complete_task"
          ? await completeWorkItem({ taskId: row.sourceId, idempotencyKey: null })
          : await updateContractObligation({ obligationId: row.sourceId, status: "done" });
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      // Keep the row briefly with an Undo affordance, then commit by refreshing
      // it out of the active queue once the undo window passes.
      setCompleted(true);
      commitTimer.current = window.setTimeout(() => {
        commitTimer.current = null;
        setCompleted(false);
        router.refresh();
      }, 6000);
    });
  }

  function handleUndo() {
    if (commitTimer.current != null) {
      window.clearTimeout(commitTimer.current);
      commitTimer.current = null;
    }
    setError(null);
    startTransition(async () => {
      // done -> open is the supported reopen for both tasks and obligations.
      const result =
        row.primaryAction.mutation === "complete_task"
          ? await updateContractTaskStatus(row.sourceId, "open")
          : await updateContractObligation({ obligationId: row.sourceId, status: "open" });
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      setCompleted(false);
      router.refresh();
    });
  }

  if (completed) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2" role="status" aria-live="polite">
        <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-[var(--success-ink)]">
          <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
          Marked complete
        </span>
        <button
          type="button"
          onClick={handleUndo}
          disabled={isPending}
          className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-[color:color-mix(in_oklab,var(--border-subtle)_84%,transparent)] bg-[var(--surface-raised)] px-2.5 text-[11.5px] font-semibold text-[var(--accent-strong)] transition-colors hover:border-[color:color-mix(in_oklab,var(--accent)_40%,var(--border-subtle))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:color-mix(in_oklab,var(--accent)_60%,transparent)] disabled:opacity-60"
        >
          <Undo2 className="h-3.5 w-3.5 shrink-0" strokeWidth={1.85} aria-hidden />
          Undo
        </button>
      </div>
    );
  }

  // The primary control carries the main verb; the overflow only needs the
  // secondary workflow actions, so "complete" never appears in both places.
  const menuActions = row.actions.filter((action) => action.key !== "complete");
  // Red-rebalance (v-materiality): the filled oxblood pill is reserved for the
  // ONE cannot-proceed tier so it dominates the queue edge. A past-due row no
  // longer gets an amber outline — it drops to the same ghost-quiet control as
  // every routine row, so the column edge isn't a stack of colored buttons. The
  // amber overdue cue survives only in the due column.
  const primaryTone = row.rowEmphasis === "critical" ? PRIMARY_CRITICAL : PRIMARY_QUIET;
  const primaryClass = `${PRIMARY_BASE} ${primaryTone}`;

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {row.primaryAction.kind === "mutation" ? (
        <button
          type="button"
          className={primaryClass}
          disabled={isPending}
          aria-busy={isPending || undefined}
          onClick={runPrimaryMutation}
        >
          <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
          {row.primaryAction.label}
        </button>
      ) : (
        <Link href={row.primaryAction.href} className={primaryClass}>
          {row.primaryAction.label}
          <ArrowRight
            className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5"
            strokeWidth={2}
            aria-hidden
          />
        </Link>
      )}

      {menuActions.length > 0 ? (
        <RowActionMenu menuLabel="More task actions" triggerLabel="Actions" disabled={isPending}>
          {menuActions.map((action) => (
            <RowActionMenuItem
              key={action.key}
              href={action.href ?? row.href}
              icon={MENU_ICONS[action.key]}
            >
              {action.label}
            </RowActionMenuItem>
          ))}
        </RowActionMenu>
      ) : null}

      {error ? (
        <span className="basis-full text-right text-[11.5px] text-[var(--danger-ink)]" role="status">
          {error}
        </span>
      ) : null}
    </div>
  );
}
