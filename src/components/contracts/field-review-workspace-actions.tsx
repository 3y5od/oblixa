"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { AlertTriangle, Check, CircleHelp, Pencil, SkipForward } from "lucide-react";
import { updateContractField } from "@/actions/contracts";
import { describeRecoverableMutationError } from "@/lib/recoverable-mutation-error";
import { UiSpinner } from "@/components/ui/ui-spinner";
import { ActionAlert, isoDateSeed } from "@/components/contracts/field-review-workspace-action-parts";

interface FieldReviewWorkspaceActionsProps {
  fieldId: string;
  fieldLabel: string;
  suggestedValue: string | null;
  canEdit: boolean;
  hasValue: boolean;
  isDate: boolean;
  needsCitation: boolean;
  sourceUnverified: boolean;
  approveIsPrimary?: boolean;
  nextHref: string | null;
  skipHref: string | null;
  variant?: "default" | "flat";
}

type PendingAction = "approved" | "rejected" | "edited" | null;

const WARNING_APPROVE_CLASS =
  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md border border-[color:color-mix(in_oklab,var(--warning-ink)_45%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning-soft)_45%,var(--surface-raised))] px-4 py-2 text-[13px] font-semibold text-[var(--warning-ink)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-50";

export function FieldReviewWorkspaceActions({
  fieldId,
  fieldLabel,
  suggestedValue,
  canEdit,
  hasValue,
  isDate,
  needsCitation,
  sourceUnverified,
  approveIsPrimary,
  nextHref,
  skipHref,
  variant = "default",
}: FieldReviewWorkspaceActionsProps) {
  const router = useRouter();
  const rowBorderClass = variant === "flat" ? "" : "border-t border-[var(--border-subtle)] pt-4";
  const approveCanBePrimary = approveIsPrimary ?? hasValue;
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [editValue, setEditValue] = useState(() =>
    isDate ? (isoDateSeed(suggestedValue) ?? suggestedValue ?? "") : (suggestedValue ?? "")
  );
  const [error, setError] = useState<string | null>(null);

  const skipTarget = skipHref ?? "/contracts/review";
  const dateSeed = isDate ? isoDateSeed(suggestedValue) : null;
  const useDateInput = isDate && dateSeed !== null;

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
      <div className="space-y-2.5">
        <p className="text-[12px] leading-snug text-[var(--text-tertiary)]">
          You have read-only access to this workspace. Confirming, editing, or marking details unknown needs a
          Member or Admin role. You can still move through the queue.
        </p>
        <div className={`flex flex-wrap items-center gap-2 ${rowBorderClass}`}>
          <Link
            href={skipTarget}
            className="ui-btn-secondary border-[var(--border-strong)] inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2 text-[13px]"
          >
            <SkipForward className="h-4 w-4" strokeWidth={2} aria-hidden />
            Skip this detail
          </Link>
        </div>
      </div>
    );
  }

  const approving = pendingAction === "approved";
  const rejecting = pendingAction === "rejected";
  const saving = pendingAction === "edited";
  const fieldNoun = fieldLabel.toLowerCase();
  const dateOrValue = isDate ? "date" : "value";
  const confirmLabel = `Confirm ${fieldNoun}`;
  const editLabel = `Edit suggested ${dateOrValue}`;
  const unknownLabel = `Mark ${dateOrValue} unknown`;

  const approveWarning = sourceUnverified || confirmApprove;
  const approveClass = approveWarning
    ? WARNING_APPROVE_CLASS
    : approveCanBePrimary
      ? "ui-btn-primary inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2 text-[13px] disabled:cursor-not-allowed disabled:opacity-40"
      : "ui-btn-secondary border-[var(--border-strong)] inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2 text-[13px] disabled:cursor-not-allowed disabled:opacity-40";
  const unknownClass = hasValue
    ? "ui-btn-secondary inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2 text-[13px] disabled:opacity-50"
    : "ui-btn-primary inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2 text-[13px] disabled:opacity-50";

  if (isEditing) {
    return (
      <div className="space-y-3 rounded-xl border border-[var(--border-card)] bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--surface))] p-3.5">
        <label className="block">
          <span className="ui-caps-3 mb-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1 leading-none text-[var(--text-tertiary)]">
            <span>Edit {fieldLabel}</span>
            {suggestedValue?.trim() ? (
              <span className="inline-flex items-baseline gap-1 normal-case tracking-normal">
                <span className="ui-caps-3 text-[9px] text-[var(--text-tertiary)]">was</span>
                <span className="font-mono text-[10.5px] tabular-nums text-[var(--text-secondary)]">
                  {suggestedValue}
                </span>
              </span>
            ) : null}
          </span>
          <input
            type={useDateInput ? "date" : "text"}
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
            autoFocus
          />
          {isDate && !useDateInput ? (
            <span className="mt-1 block text-[10.5px] leading-snug text-[var(--text-tertiary)]">
              Use a clear date such as YYYY-MM-DD.
            </span>
          ) : null}
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="ui-btn-primary inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-[13px] disabled:opacity-50"
            disabled={isPending}
            onClick={() => save("edited", editValue)}
          >
            {saving ? <UiSpinner size="sm" /> : null}
            {saving ? "Saving…" : nextHref ? "Save and next" : "Save"}
          </button>
          <button
            type="button"
            className="ui-btn-secondary border-[var(--border-strong)] rounded-md px-4 py-2 text-[13px] disabled:opacity-50"
            disabled={isPending}
            onClick={() => {
              setIsEditing(false);
              setError(null);
            }}
          >
            Cancel
          </button>
        </div>
        {error ? <ActionAlert tone="danger">{error}</ActionAlert> : null}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {hasValue && !needsCitation && !sourceUnverified && !confirmApprove ? (
        <p className="text-[11.5px] leading-snug text-[var(--text-tertiary)]">
          <span className="font-semibold text-[var(--text-secondary)]">Mark unknown</span> when the contract does not
          provide this detail. <span className="font-semibold text-[var(--text-secondary)]">Skip</span> to decide later.
        </p>
      ) : null}
      <div className={`flex flex-wrap items-center gap-2 ${rowBorderClass}`}>
        <button
          type="button"
          className={approveClass}
          disabled={isPending || needsCitation}
          onClick={handleApprove}
          title={
            needsCitation
              ? "Add a source citation by editing first"
              : confirmApprove
                ? "Confirm without a verified source match"
                : "Confirm detail (A)"
          }
          aria-label={`Confirm ${fieldLabel}, keyboard shortcut A`}
          aria-keyshortcuts="A"
        >
          {approving ? (
            <UiSpinner size="sm" />
          ) : approveWarning ? (
            <AlertTriangle className="h-4 w-4" strokeWidth={2} aria-hidden />
          ) : (
            <Check className="h-4 w-4" strokeWidth={2} aria-hidden />
          )}
          {approving ? "Confirming…" : confirmApprove ? "Confirm anyway" : confirmLabel}
        </button>
        {confirmApprove && !approving ? (
          <button
            type="button"
            className="ui-btn-ghost inline-flex items-center justify-center rounded-md px-3 py-2 text-[13px]"
            disabled={isPending}
            onClick={() => setConfirmApprove(false)}
            title="Cancel confirmation (Esc)"
          >
            Cancel
          </button>
        ) : null}
        <button
          type="button"
          className="ui-btn-secondary inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2 text-[13px] disabled:opacity-50"
          disabled={isPending}
          onClick={() => {
            setConfirmApprove(false);
            setIsEditing(true);
          }}
          title="Edit suggested value (E)"
          aria-label={`Edit suggested ${fieldLabel}, keyboard shortcut E`}
          aria-keyshortcuts="E"
        >
          <Pencil className="h-4 w-4" strokeWidth={2} aria-hidden />
          {editLabel}
        </button>
        <button
          type="button"
          className={unknownClass}
          disabled={isPending}
          onClick={() => {
            setConfirmApprove(false);
            save("rejected");
          }}
          title="Mark unknown — use when the contract does not provide this detail (U)"
          aria-label={`Mark ${fieldLabel} unknown, keyboard shortcut U`}
          aria-keyshortcuts="U"
        >
          {rejecting ? <UiSpinner size="sm" /> : <CircleHelp className="h-4 w-4" strokeWidth={2} aria-hidden />}
          {rejecting ? "Marking…" : unknownLabel}
        </button>
        <Link
          href={skipTarget}
          className="ui-btn-ghost inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-2 text-[12.5px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
          title="Skip this detail — leaves this suggestion unconfirmed and moves to the next detail (S)"
          aria-label={`Skip ${fieldLabel}, leaves it unconfirmed and moves to the next detail, keyboard shortcut S`}
          aria-keyshortcuts="S"
        >
          <SkipForward className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          Skip this detail
        </Link>
      </div>

      {confirmApprove && !approving ? (
        <ActionAlert tone="warning">
          This value was not found in the source preview. Confirm only if you have verified it another way.
        </ActionAlert>
      ) : null}
      {needsCitation ? (
        <ActionAlert tone="warning">Add source text before confirming this AI-suggested value.</ActionAlert>
      ) : null}
      {!hasValue ? (
        <ActionAlert tone="warning">
          No value was suggested for this contract detail. Mark it unknown, or edit to enter the value yourself.
        </ActionAlert>
      ) : null}
      {error ? <ActionAlert tone="danger">{error}</ActionAlert> : null}
    </div>
  );
}
