"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import {
  ArrowRight,
  CalendarClock,
  Check,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Undo2,
  UserCog,
} from "lucide-react";
import { completeWorkItem, updateContractTaskStatus } from "@/actions/tasks";
import { updateContractObligation } from "@/actions/obligations";
import { PermissionEligibilityHint } from "@/components/ui/permission-eligibility-hint";
import type { WorkActionCapability, WorkActionKey, WorkItemRow } from "@/lib/work/types";

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

// The primary control is a structured ActionChip (the design vocabulary from
// src/components/ui/action-chip.tsx) rather than a flat pill: rounded-full,
// accent-strong tinted border/bg/text, a trailing arrow that translates on
// hover, and an active:translate-y-px pressed state. The same recipe is applied
// to BOTH branches so the act-in-place mutation (leading Check + Undo flow) and
// the navigating link (Approve/Resolve/Review/…) read as one affordance.
//
// NOTE: this hand-mirrors ActionChip's recipe instead of rendering the
// component, because ActionChip is Link-only — the mutation branch needs a
// <button> to host onClick + the optimistic-complete/Undo flow. The token
// values (accent-strong 32% border, 8% bg, full-saturation ink) are kept in
// sync with ActionChip; if that recipe changes, update this string to match.
// `h-8` + `min-w-[5.5rem]` keep the fixed 32px height and shared column edge so
// verbs of differing length never shift the reserved Actions slot.
const PRIMARY_CLASS =
  "group inline-flex h-8 min-w-[5.5rem] items-center justify-center gap-1.5 rounded-full border border-[color:color-mix(in_oklab,var(--accent-strong)_32%,var(--border-card))] bg-[color:color-mix(in_oklab,var(--accent-strong)_8%,var(--surface-raised))] px-3 text-[11.5px] font-semibold leading-none text-[var(--accent-strong)] transition-[transform,filter,border-color] hover:brightness-110 hover:border-[color:color-mix(in_oklab,var(--accent-strong)_44%,var(--border-card))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:color-mix(in_oklab,var(--accent)_60%,transparent)] active:translate-y-px disabled:opacity-60";

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
          className="inline-flex h-7 items-center justify-center gap-1 rounded-lg border border-[color:color-mix(in_oklab,var(--border-subtle)_84%,transparent)] bg-[var(--surface-raised)] px-2.5 text-[11.5px] font-semibold text-[var(--accent-strong)] transition-colors hover:border-[color:color-mix(in_oklab,var(--accent)_40%,var(--border-subtle))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:color-mix(in_oklab,var(--accent)_60%,transparent)] disabled:opacity-60"
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
        <RowActionMenu actions={menuActions} rowHref={row.href} disabled={isPending} />
      ) : null}

      {error ? (
        <span className="basis-full text-right text-[11.5px] text-[var(--danger-ink)]" role="status">
          {error}
        </span>
      ) : null}
    </div>
  );
}

function RowActionMenu({
  actions,
  rowHref,
  disabled,
}: {
  actions: WorkActionCapability[];
  rowHref: string;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  // Which end to land focus on when the menu opens via keyboard: ArrowUp opens
  // to the last item, everything else (click, ArrowDown, Enter, Space) opens to
  // the first. Read by the focus effect below.
  const openToLastRef = useRef(false);

  // Centralised close: optionally returns focus to the trigger. Used by Escape
  // and Tab (keyboard-initiated) and by the outside-pointer/scroll/resize
  // handlers when focus currently lives inside the menu — so a programmatic
  // close never strands the keyboard user at the top of the document.
  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  // Read the trigger's position at open time inside the handler (not an effect)
  // so the fixed panel anchors under the button. The portal only mounts while
  // open — which can only happen client-side after a click/keypress — so no SSR
  // mounted-guard is needed.
  const openMenu = useCallback((focusLast: boolean) => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setCoords({ top: rect.bottom + 6, right: Math.max(8, window.innerWidth - rect.right) });
    }
    openToLastRef.current = focusLast;
    setOpen(true);
  }, []);

  function toggleOpen() {
    if (open) {
      setOpen(false);
      return;
    }
    openMenu(false);
  }

  // APG menu-button keys: ArrowDown / Enter / Space open the menu on the first
  // item; ArrowUp opens on the last. The native <button> click already covers
  // Enter/Space activation, but handling them here lets us steer initial focus
  // and gives the arrow-key open affordance the mouse path has.
  function onTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (open) return;
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      openMenu(false);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      openMenu(true);
    }
  }

  // Fixed-positioned panel can't follow the trigger, and it lives in a portal
  // outside the row — close on outside interaction, scroll, or resize. If focus
  // is inside the menu when one of these fires, hand it back to the trigger so
  // the about-to-be-removed portal node doesn't drop focus to the document top.
  useEffect(() => {
    if (!open) return;
    const closeFromEvent = () => {
      const active = document.activeElement;
      close(menuRef.current?.contains(active) ?? false);
    };
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      closeFromEvent();
    };
    const onScrollOrResize = () => closeFromEvent();
    document.addEventListener("mousedown", onPointer);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, close]);

  // Move focus into the menu when it opens for keyboard users — to the last item
  // if it was opened via ArrowUp, otherwise the first (APG menu pattern).
  useEffect(() => {
    if (open && menuRef.current) {
      const items = menuRef.current.querySelectorAll<HTMLElement>('[role="menuitem"]');
      const target = openToLastRef.current ? items[items.length - 1] : items[0];
      target?.focus();
    }
  }, [open]);

  function onMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
      return;
    }
    // Tab closes and hands focus back to the trigger so the next Tab continues
    // naturally from there instead of dropping to the top of the document when
    // the portal node unmounts.
    if (event.key === "Tab") {
      event.preventDefault();
      close(true);
      return;
    }
    // Anchors activate on Enter natively but not on Space; the role="menuitem"
    // contract expects both. Activate the focused item on Space (and prevent the
    // default page scroll a focused <a> + Space would otherwise trigger).
    if (event.key === " " || event.key === "Spacebar") {
      const active = document.activeElement as HTMLElement | null;
      if (active && active.getAttribute("role") === "menuitem") {
        event.preventDefault();
        active.click();
      }
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []
    );
    if (items.length === 0) return;
    const current = items.indexOf(document.activeElement as HTMLElement);
    const next =
      event.key === "ArrowDown"
        ? (current + 1) % items.length
        : (current - 1 + items.length) % items.length;
    items[next]?.focus();
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] text-[var(--text-secondary)] transition-colors hover:border-[color:color-mix(in_oklab,var(--border-strong)_82%,transparent)] hover:bg-[color:color-mix(in_oklab,var(--surface-contrast)_55%,transparent)] hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:color-mix(in_oklab,var(--accent)_60%,transparent)] disabled:opacity-60"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={toggleOpen}
        onKeyDown={onTriggerKeyDown}
      >
        <MoreHorizontal className="h-4 w-4" strokeWidth={1.85} aria-hidden />
        <span className="sr-only">Actions</span>
      </button>
      {open && coords
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              aria-orientation="vertical"
              aria-label="More work actions"
              onKeyDown={onMenuKeyDown}
              className="fixed z-50 grid min-w-[12rem] gap-0.5 rounded-[0.625rem] border border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] bg-[var(--surface-raised)] p-1.5 shadow-[var(--shadow-2)]"
              style={{ top: coords.top, right: coords.right }}
            >
              {actions.map((action) => (
                <Link
                  key={action.key}
                  role="menuitem"
                  href={action.href ?? rowHref}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-[0.45rem] px-2.5 py-1.5 text-left text-[11.5px] font-medium text-[var(--text-secondary)] outline-none transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent)_10%,transparent)] hover:text-[var(--text-primary)] focus-visible:bg-[color:color-mix(in_oklab,var(--accent)_10%,transparent)] focus-visible:text-[var(--text-primary)]"
                >
                  {/* Reserved icon slot: renders at a fixed size even when the
                      action has no mapped icon, so item labels share one left
                      edge and never shift between mapped/unmapped actions. */}
                  <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                    {MENU_ICONS[action.key] ?? null}
                  </span>
                  {action.label}
                </Link>
              ))}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
