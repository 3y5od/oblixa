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

// The row's primary control — a structured pill that stays quiet at rest
// (neutral border + text, transparent fill) and only promotes to accent on
// hover/focus, so a column of repeated Review/Complete actions doesn't blanket
// the queue's right edge in saturated blue (§10.2). The same recipe drives BOTH
// branches so the act-in-place mutation (leading Check + Undo flow) and the
// navigating link (Approve/Resolve/Review/…) read as one affordance. `h-8` +
// `min-w-[5.5rem]` hold the fixed 32px height + shared column edge so verbs of
// differing length never shift the reserved Actions slot (§10.9).
const PRIMARY_CLASS =
  "group inline-flex h-8 min-w-[5.5rem] items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-[var(--border-subtle)] bg-transparent px-3 text-[11.5px] font-medium leading-none text-[var(--text-secondary)] transition-[color,background-color,border-color,transform] hover:border-[color:color-mix(in_oklab,var(--accent)_40%,var(--border-card))] hover:bg-[color:color-mix(in_oklab,var(--accent-strong)_8%,var(--surface-raised))] hover:text-[var(--accent-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:color-mix(in_oklab,var(--accent)_60%,transparent)] active:translate-y-px disabled:opacity-60";

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

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {row.primaryAction.kind === "mutation" ? (
        <button
          type="button"
          className={PRIMARY_CLASS}
          disabled={isPending}
          aria-busy={isPending || undefined}
          onClick={runPrimaryMutation}
        >
          <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
          {row.primaryAction.label}
        </button>
      ) : (
        <Link href={row.primaryAction.href} className={PRIMARY_CLASS}>
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
