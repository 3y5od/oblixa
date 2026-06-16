"use client";

import { useEffect, useState } from "react";
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

function formatSavedAt(d: Date): string {
  const date = d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${date} at ${time}`;
}

/**
 * Shared footer for the inline settings editors (Workspace identity, Profile).
 *
 * - Reserved status region on the left (`aria-live`) keeps a fixed min-height so
 *   the card never jumps when a save result arrives (§8.4-style stability).
 * - State reads as quiet inline text, never a floating pill (§15): "No changes"
 *   at rest, "Unsaved changes" / "Saving…" in flight, and a timestamped
 *   "Saved …" record after a successful save. The save button is HIDDEN when
 *   clean so a disabled control never reads as an available action (§11.*).
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
  // Capture the wall-clock time of each completed save so the rest state can
  // read "Saved <date> at <time>" rather than a bare badge. Re-runs on the
  // pending→done transition, so repeated saves refresh the stamp.
  const [savedAtLabel, setSavedAtLabel] = useState<string | null>(null);
  useEffect(() => {
    if (!success || pending) return;
    const handle = setTimeout(() => setSavedAtLabel(formatSavedAt(new Date())), 0);
    return () => clearTimeout(handle);
  }, [success, pending]);

  return (
    <div className="flex min-h-9 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-[var(--border-subtle)] pt-4">
      <div aria-live="polite" className="min-w-0 text-[11.5px] leading-snug">
        {error ? (
          <p
            id={errId}
            role="alert"
            className="inline-flex items-center gap-1.5 font-medium text-[var(--danger-ink)]"
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
            <span className="min-w-0">{error}</span>
          </p>
        ) : pending ? (
          <span className="text-[var(--text-tertiary)]">{pendingLabel}</span>
        ) : isDirty ? (
          <span className={isEmpty ? "font-medium text-[var(--danger-ink)]" : "text-[var(--text-secondary)]"}>
            {isEmpty ? emptyLabel : "Unsaved changes"}
          </span>
        ) : success && savedAtLabel ? (
          <span className="inline-flex items-center gap-1.5 text-[var(--text-tertiary)]">
            <Check className="h-3.5 w-3.5 shrink-0 text-[var(--success-ink)]" strokeWidth={2.2} aria-hidden />
            <span className="min-w-0">Saved {savedAtLabel}</span>
          </span>
        ) : (
          <span className="text-[var(--text-tertiary)]">No changes</span>
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
