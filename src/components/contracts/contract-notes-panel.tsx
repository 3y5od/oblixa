"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  createContractNote,
  deleteContractNote,
  toggleContractNotePin,
} from "@/actions/notes";
import { describeRecoverableMutationError } from "@/lib/recoverable-mutation-error";
import type { ContractNote } from "@/lib/types";

type ContractNoteItem = Pick<
  ContractNote,
  "id" | "note" | "pinned" | "author_id" | "created_at"
>;

export function ContractNotesPanel({
  contractId,
  notes,
  currentUserId,
  memberLabels,
  canEdit,
}: {
  contractId: string;
  notes: ContractNoteItem[];
  currentUserId: string;
  memberLabels: Array<{ userId: string; label: string }>;
  canEdit: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const labelById = useMemo(
    () => new Map(memberLabels.map((m) => [m.userId, m.label])),
    [memberLabels]
  );

  function onCreate(formData: FormData) {
    if (isPending) return;
    setError(null);
    startTransition(async () => {
      const note = String(formData.get("note") ?? "").trim();
      const pinned = canEdit && formData.get("pinned") === "on";
      const res = await createContractNote({ contractId, note, pinned });
      if ("error" in res && res.error) {
        setError(describeRecoverableMutationError(res.error));
        return;
      }
      router.refresh();
    });
  }

  function onTogglePin(noteId: string, nextPinned: boolean) {
    if (!canEdit || isPending) return;
    setError(null);
    startTransition(async () => {
      const res = await toggleContractNotePin(noteId, nextPinned);
      if ("error" in res && res.error) {
        setError(describeRecoverableMutationError(res.error));
        return;
      }
      router.refresh();
    });
  }

  function onDelete(noteId: string) {
    if (isPending) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteContractNote(noteId);
      if ("error" in res && res.error) {
        setError(describeRecoverableMutationError(res.error));
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <form action={onCreate} className="grid gap-3 rounded-xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] p-4">
        <div>
          <label className="ui-label-caps">Add note</label>
          <textarea
            name="note"
            required
            rows={3}
            maxLength={5000}
            placeholder="Capture context, decisions, blockers, or handoff details..."
            className="ui-input w-full resize-y"
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          {canEdit ? (
            <label className="inline-flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <input name="pinned" type="checkbox" className="h-4 w-4 rounded border-[var(--border-strong)]" />
              Pin this note
            </label>
          ) : (
            <span className="text-xs text-[var(--text-tertiary)]">Pinned notes require editor/admin access.</span>
          )}
          <button type="submit" disabled={isPending} className="ui-btn-primary px-4 py-2 text-[13px]">
            {isPending ? "Saving..." : "Save note"}
          </button>
        </div>
      </form>

      {error && (
        <p className="ui-alert-error text-sm" role="alert">
          {error}
        </p>
      )}

      {notes.length === 0 ? (
        <p className="text-sm text-[var(--text-tertiary)]">No notes yet.</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => {
            const isAuthor = note.author_id === currentUserId;
            const canDelete = isAuthor || canEdit;
            return (
              <li key={note.id} className="rounded-xl border border-[var(--border-subtle)] bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="whitespace-pre-wrap text-sm text-[var(--text-primary)]">{note.note}</p>
                    <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                      {note.author_id ? labelById.get(note.author_id) ?? "Member" : "Unknown"}
                      <span className="text-[var(--text-tertiary)]"> · </span>
                      {format(new Date(note.created_at), "MMM d, yyyy h:mm a")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {note.pinned && (
                      <span className="rounded-full border border-[color:color-mix(in_oklab,var(--warning)_42%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning)_12%,var(--surface))] px-2 py-0.5 text-xs font-semibold text-[var(--warning-ink)]">
                        Pinned
                      </span>
                    )}
                    {canEdit && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => onTogglePin(note.id, !note.pinned)}
                        className="ui-btn-secondary px-3 py-1.5 text-xs"
                      >
                        {note.pinned ? "Unpin" : "Pin"}
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => onDelete(note.id)}
                        className="ui-btn-secondary px-3 py-1.5 text-xs"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
