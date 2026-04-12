"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { deleteContract } from "@/actions/contracts";
import { Trash2, Loader2 } from "lucide-react";

interface DeleteContractButtonProps {
  contractId: string;
  contractTitle: string;
  canEdit?: boolean;
}

export function DeleteContractButton({
  contractId,
  contractTitle,
  canEdit = true,
}: DeleteContractButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const prevConfirmOpen = useRef(false);

  useEffect(() => {
    if (confirmOpen) {
      requestAnimationFrame(() => cancelButtonRef.current?.focus());
    } else if (prevConfirmOpen.current) {
      triggerRef.current?.focus();
    }
    prevConfirmOpen.current = confirmOpen;
  }, [confirmOpen]);

  useEffect(() => {
    if (!confirmOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) {
        setConfirmOpen(false);
        setError(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmOpen, isPending]);

  function closeDialog() {
    if (isPending) return;
    setConfirmOpen(false);
    setError(null);
  }

  useEffect(() => {
    if (!confirmOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [confirmOpen]);

  if (!canEdit) return null;

  const label = contractTitle.trim() || "this contract";

  function performDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteContract(contractId);
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      setConfirmOpen(false);
    });
  }

  return (
    <div className="mt-6 border-t border-[var(--border-subtle)] pt-4">
      <p className="mb-2 text-xs font-medium uppercase text-zinc-500">Danger zone</p>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setError(null);
          setConfirmOpen(true);
        }}
        disabled={isPending || confirmOpen}
        className="ui-btn-danger inline-flex w-full items-center justify-center gap-2 disabled:opacity-50"
      >
        {isPending ? (
          <Loader2 size={16} className="animate-spin" aria-hidden />
        ) : (
          <Trash2 size={16} aria-hidden />
        )}
        {isPending ? "Deleting…" : "Delete contract"}
      </button>

      {confirmOpen && (
        <div
          className="ui-overlay-scrim fixed inset-0 z-50 flex items-center justify-center p-4"
          role="presentation"
          onClick={closeDialog}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-contract-dialog-title"
            className="w-full max-w-md rounded-xl border border-[var(--border-subtle)] bg-surface p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="delete-contract-dialog-title"
              className="text-lg font-semibold text-zinc-900"
            >
              Delete contract?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600">
              <span className="font-medium text-zinc-900">&ldquo;{label}&rdquo;</span>{" "}
              will be removed along with uploaded files, extracted fields, and reminders.
              This cannot be undone.
            </p>
            {error && (
              <p className="ui-alert-error mt-3 text-sm" role="alert">
                {error}
              </p>
            )}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                ref={cancelButtonRef}
                type="button"
                disabled={isPending}
                onClick={closeDialog}
                className="ui-btn-secondary disabled:pointer-events-none disabled:opacity-45"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={performDelete}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/30 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45"
              >
                {isPending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" aria-hidden />
                    Deleting…
                  </>
                ) : (
                  "Delete permanently"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
