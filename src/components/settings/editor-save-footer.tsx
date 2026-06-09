"use client";

import { AlertCircle, Check } from "lucide-react";

interface SaveFooterProps {
  isDirty: boolean;
  /** When true the only change leaves a required field empty — the save button
   *  stays disabled and the status reads `emptyLabel` instead of "Unsaved". */
  isEmpty?: boolean;
  pending: boolean;
  error?: string;
  success?: boolean;
  /** id wired to the input's `aria-describedby` when an error is shown. */
  errId: string;
  onDiscard: () => void;
  saveLabel?: string;
  pendingLabel?: string;
  emptyLabel?: string;
}

const SAVED_CHIP =
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ui-caps-3 text-[10px]";

/**
 * Shared footer for the inline settings editors (Workspace identity, Profile).
 *
 * - Reserved status region on the left (`aria-live`) keeps a fixed min-height so
 *   the card never jumps when a save result arrives (§8.4-style stability).
 * - Clean → muted "Saved" chip; the save button is HIDDEN entirely so a
 *   disabled control never reads as an available secondary action (§11.* / spec).
 * - Dirty → "Unsaved" status + Discard (ghost) + Save (primary). After a
 *   successful save the chip flips to a success-tinted "Saved".
 */
export function SaveFooter({
  isDirty,
  isEmpty = false,
  pending,
  error,
  success,
  errId,
  onDiscard,
  saveLabel = "Save changes",
  pendingLabel = "Saving…",
  emptyLabel = "Required",
}: SaveFooterProps) {
  return (
    <div className="flex min-h-9 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-[var(--border-subtle)] pt-4">
      <div aria-live="polite" className="min-w-0">
        {error ? (
          <p
            id={errId}
            role="alert"
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--danger-ink)]"
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
            <span className="min-w-0">{error}</span>
          </p>
        ) : isDirty ? (
          <span className="ui-caps-3 text-[10px] text-[var(--text-tertiary)]">
            {isEmpty ? emptyLabel : "Unsaved changes"}
          </span>
        ) : (
          <span
            className={SAVED_CHIP}
            style={
              success
                ? {
                    borderColor: "color-mix(in oklab, var(--success) 24%, var(--border-subtle))",
                    background: "color-mix(in oklab, var(--success-soft) 24%, var(--surface-raised))",
                    color: "var(--success-ink)",
                  }
                : {
                    borderColor: "var(--border-subtle)",
                    background: "var(--surface-raised)",
                    color: "var(--text-tertiary)",
                  }
            }
          >
            <Check className="h-3 w-3" strokeWidth={2.2} aria-hidden />
            Saved
          </span>
        )}
      </div>
      {isDirty ? (
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onDiscard}
            className="ui-btn-ghost min-h-9 rounded-full px-3 py-1.5 text-[12.5px]"
          >
            Discard
          </button>
          <button
            type="submit"
            disabled={isEmpty || pending}
            aria-disabled={isEmpty || pending}
            aria-busy={pending}
            className="ui-btn-primary min-h-9 rounded-full px-4 py-1.5 text-[12.5px] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? pendingLabel : saveLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
