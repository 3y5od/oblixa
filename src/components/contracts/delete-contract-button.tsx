"use client";

import { useEffect, useState, useTransition } from "react";
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
    <div className="mt-6 border-t border-zinc-100 pt-4">
      <p className="mb-2 text-xs font-medium uppercase text-zinc-500">Danger zone</p>
      <button
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4 backdrop-blur-[2px]"
          role="presentation"
          onClick={closeDialog}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-contract-dialog-title"
            className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl"
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
              <p className="mt-3 rounded-lg border border-red-200/70 bg-red-50/80 px-3 py-2 text-sm text-red-800">
                {error}
              </p>
            )}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={isPending}
                onClick={closeDialog}
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={performDelete}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
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
