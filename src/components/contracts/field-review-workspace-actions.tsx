"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { AlertTriangle, Check, CircleHelp, Pencil, SkipForward } from "lucide-react";
import { updateContractField } from "@/actions/contracts";
import { describeRecoverableMutationError } from "@/lib/recoverable-mutation-error";
import { UiSpinner } from "@/components/ui/ui-spinner";

interface FieldReviewWorkspaceActionsProps {
  fieldId: string;
  fieldLabel: string;
  suggestedValue: string | null;
  canEdit: boolean;
  needsCitation: boolean;
  /** AI value whose snippet exists but was NOT located in the source preview.
   *  Approval stays possible (derived values legitimately differ from prose) but
   *  is gated behind an explicit confirmation so it is not one-click "encouraged". */
  sourceUnverified: boolean;
  nextHref: string | null;
  skipHref: string | null;
}

type PendingAction = "approved" | "rejected" | "edited" | null;

export function FieldReviewWorkspaceActions({
  fieldId,
  fieldLabel,
  suggestedValue,
  canEdit,
  needsCitation,
  sourceUnverified,
  nextHref,
  skipHref,
}: FieldReviewWorkspaceActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [editValue, setEditValue] = useState(suggestedValue ?? "");
  const [error, setError] = useState<string | null>(null);

  const skipTarget = skipHref ?? "/contracts/review";

  const moveAfterMutation = useCallback(() => {
    if (nextHref) {
      router.push(nextHref);
      return;
    }
    router.refresh();
  }, [nextHref, router]);

  const save = useCallback(
    (action: "approved" | "rejected" | "edited", value?: string) => {
      setError(null);
      setPendingAction(action);
      startTransition(async () => {
        const result = await updateContractField(fieldId, action, value);
        if (result && "error" in result && result.error) {
          setError(describeRecoverableMutationError(result.error));
          setPendingAction(null);
          return;
        }
        setIsEditing(false);
        setConfirmApprove(false);
        moveAfterMutation();
      });
    },
    [fieldId, moveAfterMutation]
  );

  // Approve directly when source support is clear; require one confirmation
  // when the suggestion was not located in the source.
  const handleApprove = useCallback(() => {
    if (sourceUnverified && !confirmApprove) {
      setConfirmApprove(true);
      return;
    }
    save("approved");
  }, [sourceUnverified, confirmApprove, save]);

  useEffect(() => {
    if (!canEdit) return;
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const target = e.target;
      if (target instanceof HTMLElement) {
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
      }
      if (e.key === "Escape" && confirmApprove) {
        e.preventDefault();
        setConfirmApprove(false);
        return;
      }
      if (isEditing || isPending) return;
      const k = e.key.toLowerCase();
      if (k === "a" && !needsCitation) {
        e.preventDefault();
        handleApprove();
      } else if (k === "e") {
        e.preventDefault();
        setConfirmApprove(false);
        setIsEditing(true);
      } else if (k === "u") {
        e.preventDefault();
        setConfirmApprove(false);
        save("rejected");
      } else if (k === "s") {
        e.preventDefault();
        router.push(skipTarget);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canEdit, isEditing, isPending, needsCitation, confirmApprove, handleApprove, router, save, skipTarget]);

  if (!canEdit) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={skipTarget}
          className="ui-btn-ghost inline-flex min-w-[6.5rem] items-center justify-center gap-1.5 rounded-full px-4 py-2 text-[13px]"
        >
          <SkipForward className="h-4 w-4" strokeWidth={2} aria-hidden />
          Skip
        </Link>
      </div>
    );
  }

  const approving = pendingAction === "approved";
  const rejecting = pendingAction === "rejected";
  const saving = pendingAction === "edited";

  return (
    <div className="space-y-3">
      {isEditing ? (
        <div className="space-y-3">
          <label className="block">
            <span className="ui-caps-3 mb-1 block leading-none text-[var(--text-tertiary)]">Edit suggested value</span>
            <input
              className="ui-input"
              value={editValue}
              onChange={(event) => setEditValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  setIsEditing(false);
                  setError(null);
                }
              }}
              aria-label={`Edit ${fieldLabel}`}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="ui-btn-primary inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] disabled:opacity-50"
              disabled={isPending}
              onClick={() => save("edited", editValue)}
            >
              {saving ? <UiSpinner size="sm" /> : null}
              {saving ? "Saving…" : "Save edit"}
            </button>
            <button
              type="button"
              className="ui-btn-secondary rounded-full px-4 py-2 text-[13px] disabled:opacity-50"
              disabled={isPending}
              onClick={() => {
                setIsEditing(false);
                setError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={
              confirmApprove
                ? "inline-flex min-w-[7rem] items-center justify-center gap-1.5 rounded-full border border-[color:color-mix(in_oklab,var(--warning)_45%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning-soft)_45%,var(--surface-raised))] px-4 py-2 text-[13px] font-semibold text-[var(--warning-ink)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-50"
                : sourceUnverified
                  ? // De-emphasized to equal weight with Edit when the source is not
                    // verified — approval stays possible but is not "encouraged".
                    "ui-btn-secondary inline-flex min-w-[7rem] items-center justify-center gap-1.5 rounded-full px-4 py-2 text-[13px] disabled:cursor-not-allowed disabled:opacity-40"
                  : "ui-btn-primary inline-flex min-w-[7rem] items-center justify-center gap-1.5 rounded-full px-4 py-2 text-[13px] disabled:cursor-not-allowed disabled:opacity-40"
            }
            disabled={isPending || needsCitation}
            onClick={handleApprove}
            title={
              needsCitation
                ? "Add a source citation by editing first"
                : confirmApprove
                  ? "Approve without a verified source match"
                  : "Approve (A)"
            }
            aria-label={`Approve ${fieldLabel}, keyboard shortcut A`}
            aria-keyshortcuts="A"
          >
            {approving ? (
              <UiSpinner size="sm" />
            ) : confirmApprove ? (
              <AlertTriangle className="h-4 w-4" strokeWidth={2} aria-hidden />
            ) : (
              <Check className="h-4 w-4" strokeWidth={2} aria-hidden />
            )}
            {approving ? "Approving…" : confirmApprove ? "Confirm approve" : "Approve"}
          </button>
          <button
            type="button"
            className="ui-btn-secondary inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-[13px] disabled:opacity-50"
            disabled={isPending}
            onClick={() => {
              setConfirmApprove(false);
              setIsEditing(true);
            }}
            title="Edit (E)"
            aria-label={`Edit ${fieldLabel}, keyboard shortcut E`}
            aria-keyshortcuts="E"
          >
            <Pencil className="h-4 w-4" strokeWidth={2} aria-hidden />
            Edit
          </button>
          <button
            type="button"
            className="ui-btn-secondary inline-flex min-w-[8rem] items-center justify-center gap-1.5 rounded-full px-4 py-2 text-[13px] disabled:opacity-50"
            disabled={isPending}
            onClick={() => {
              setConfirmApprove(false);
              save("rejected");
            }}
            title="Mark unknown (U)"
            aria-label={`Mark unknown ${fieldLabel}, keyboard shortcut U`}
            aria-keyshortcuts="U"
          >
            {rejecting ? <UiSpinner size="sm" /> : <CircleHelp className="h-4 w-4" strokeWidth={2} aria-hidden />}
            {rejecting ? "Marking…" : "Mark unknown"}
          </button>
          {/* Skip defers rather than decides — its quiet ghost treatment (vs the
              bordered decision buttons) sets it apart, so no divider line is needed. */}
          <Link
            href={skipTarget}
            className="ui-btn-ghost inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-[13px]"
            title="Skip (S)"
            aria-label={`Skip ${fieldLabel}, keyboard shortcut S`}
            aria-keyshortcuts="S"
          >
            <SkipForward className="h-4 w-4" strokeWidth={2} aria-hidden />
            Skip
          </Link>
        </div>
      )}

      {confirmApprove && !approving ? (
        <p className="text-[12px] font-medium text-[var(--warning-ink)]">
          This value was not found in the source preview. Approve only if you have verified it another way.
        </p>
      ) : null}
      {needsCitation ? (
        <p className="text-[12px] font-medium text-[var(--warning-ink)]">
          Add source text before approving this AI-suggested value.
        </p>
      ) : null}
      {error ? <p className="text-[12px] font-medium text-[var(--danger-ink)]">{error}</p> : null}
    </div>
  );
}
