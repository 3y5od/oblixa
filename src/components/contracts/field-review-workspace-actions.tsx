"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, CircleHelp, Pencil, ArrowRight } from "lucide-react";
import { updateContractField } from "@/actions/contracts";
import { describeRecoverableMutationError } from "@/lib/recoverable-mutation-error";

interface FieldReviewWorkspaceActionsProps {
  fieldId: string;
  fieldLabel: string;
  suggestedValue: string | null;
  canEdit: boolean;
  needsCitation: boolean;
  nextHref: string | null;
  skipHref: string | null;
}

export function FieldReviewWorkspaceActions({
  fieldId,
  fieldLabel,
  suggestedValue,
  canEdit,
  needsCitation,
  nextHref,
  skipHref,
}: FieldReviewWorkspaceActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(suggestedValue ?? "");
  const [error, setError] = useState<string | null>(null);

  function moveAfterMutation() {
    if (nextHref) {
      router.push(nextHref);
      return;
    }
    router.refresh();
  }

  function save(action: "approved" | "rejected" | "edited", value?: string) {
    setError(null);
    startTransition(async () => {
      const result = await updateContractField(fieldId, action, value);
      if (result && "error" in result && result.error) {
        setError(describeRecoverableMutationError(result.error));
        return;
      }
      setIsEditing(false);
      moveAfterMutation();
    });
  }

  const skipTarget = skipHref ?? "/contracts/review";

  if (!canEdit) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Link href={skipTarget} className="ui-btn-secondary inline-flex items-center gap-1.5 px-4 py-2 text-[13px]">
          Skip
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {isEditing ? (
        <div className="space-y-3">
          <label className="block">
            <span className="ui-caps-3 mb-1 block text-[var(--text-tertiary)]">Edit suggested value</span>
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
              className="ui-btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-[13px] disabled:opacity-50"
              disabled={isPending}
              onClick={() => save("edited", editValue)}
            >
              Save edit
            </button>
            <button
              type="button"
              className="ui-btn-secondary px-4 py-2 text-[13px]"
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
            className="ui-btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-[13px] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={isPending || needsCitation}
            onClick={() => save("approved")}
            title={needsCitation ? "Add a source citation by editing first" : "Approve"}
            aria-label={`Approve ${fieldLabel}`}
          >
            <Check className="h-4 w-4" aria-hidden />
            Approve
          </button>
          <button
            type="button"
            className="ui-btn-secondary inline-flex items-center gap-1.5 px-4 py-2 text-[13px] disabled:opacity-50"
            disabled={isPending}
            onClick={() => setIsEditing(true)}
            aria-label={`Edit ${fieldLabel}`}
          >
            <Pencil className="h-4 w-4" aria-hidden />
            Edit
          </button>
          <button
            type="button"
            className="ui-btn-secondary inline-flex items-center gap-1.5 px-4 py-2 text-[13px] disabled:opacity-50"
            disabled={isPending}
            onClick={() => save("rejected")}
            aria-label={`Mark unknown ${fieldLabel}`}
          >
            <CircleHelp className="h-4 w-4" aria-hidden />
            Mark unknown
          </button>
          <Link href={skipTarget} className="ui-btn-ghost inline-flex items-center gap-1.5 px-4 py-2 text-[13px]" aria-label={`Skip ${fieldLabel}`}>
            Skip
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      )}

      {needsCitation ? (
        <p className="text-[12px] font-medium text-[var(--warning-ink)]">
          Add source text before approving this AI-suggested value.
        </p>
      ) : null}
      {error ? <p className="text-[12px] font-medium text-[var(--danger-ink)]">{error}</p> : null}
    </div>
  );
}
