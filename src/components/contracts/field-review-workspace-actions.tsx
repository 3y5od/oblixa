"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Check, CircleHelp, Pencil, SkipForward } from "lucide-react";
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
      startTransition(async () => {
        const result = await updateContractField(fieldId, action, value);
        if (result && "error" in result && result.error) {
          setError(describeRecoverableMutationError(result.error));
          return;
        }
        setIsEditing(false);
        moveAfterMutation();
      });
    },
    [fieldId, moveAfterMutation]
  );

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
      if (isEditing || isPending) return;
      const k = e.key.toLowerCase();
      if (k === "a" && !needsCitation) {
        e.preventDefault();
        save("approved");
      } else if (k === "e") {
        e.preventDefault();
        setIsEditing(true);
      } else if (k === "u") {
        e.preventDefault();
        save("rejected");
      } else if (k === "s") {
        e.preventDefault();
        router.push(skipTarget);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canEdit, isEditing, isPending, needsCitation, router, save, skipTarget]);

  if (!canEdit) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={skipTarget}
          className="inline-flex min-w-[6.5rem] items-center justify-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-2 text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
        >
          <SkipForward className="h-4 w-4" aria-hidden />
          Skip
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
              className="ui-btn-primary inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] disabled:opacity-50"
              disabled={isPending}
              onClick={() => save("edited", editValue)}
            >
              Save edit
            </button>
            <button
              type="button"
              className="ui-btn-secondary rounded-full px-4 py-2 text-[13px]"
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
            className="ui-btn-primary inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-[13px] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={isPending || needsCitation}
            onClick={() => save("approved")}
            title={needsCitation ? "Add a source citation by editing first" : "Approve (A)"}
            aria-label={`Approve ${fieldLabel}, keyboard shortcut A`}
            aria-keyshortcuts="A"
          >
            <Check className="h-4 w-4" aria-hidden />
            Approve
          </button>
          <button
            type="button"
            className="ui-btn-secondary inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-[13px] disabled:opacity-50"
            disabled={isPending}
            onClick={() => setIsEditing(true)}
            title="Edit (E)"
            aria-label={`Edit ${fieldLabel}, keyboard shortcut E`}
            aria-keyshortcuts="E"
          >
            <Pencil className="h-4 w-4" aria-hidden />
            Edit
          </button>
          <button
            type="button"
            className="ui-btn-secondary inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-[13px] disabled:opacity-50"
            disabled={isPending}
            onClick={() => save("rejected")}
            title="Mark unknown (U)"
            aria-label={`Mark unknown ${fieldLabel}, keyboard shortcut U`}
            aria-keyshortcuts="U"
          >
            <CircleHelp className="h-4 w-4" aria-hidden />
            Mark unknown
          </button>
          {/* Defer, not decide — set apart from the decision cluster with a
              divider, but keep a real control affordance (§15). */}
          <span
            aria-hidden
            className="mx-0.5 hidden h-7 w-px self-center bg-[var(--border-subtle)] sm:inline-block"
          />
          <Link
            href={skipTarget}
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-2 text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
            title="Skip (S)"
            aria-label={`Skip ${fieldLabel}, keyboard shortcut S`}
            aria-keyshortcuts="S"
          >
            <SkipForward className="h-4 w-4" aria-hidden />
            Skip
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
