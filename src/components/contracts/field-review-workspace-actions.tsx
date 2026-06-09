"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition, type ReactNode } from "react";
import { AlertTriangle, Check, CircleHelp, Pencil, SkipForward } from "lucide-react";
import { updateContractField } from "@/actions/contracts";
import { describeRecoverableMutationError } from "@/lib/recoverable-mutation-error";
import { UiSpinner } from "@/components/ui/ui-spinner";

/** Structured alert row — replaces loose helper prose under the action bar so a
 *  gating message reads as a bordered status row, not stray text (§10.7). */
function ActionAlert({ tone, children }: { tone: "warning" | "danger"; children: ReactNode }) {
  const ink = tone === "danger" ? "var(--danger-ink)" : "var(--warning-ink)";
  const accent = tone === "danger" ? "var(--danger)" : "var(--warning)";
  const soft = tone === "danger" ? "var(--danger-soft)" : "var(--warning-soft)";
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-lg border px-3 py-2"
      style={{
        borderColor: `color-mix(in oklab, ${accent} 30%, var(--border-subtle))`,
        background: `color-mix(in oklab, ${soft} 26%, var(--surface))`,
      }}
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden style={{ color: ink }} />
      <p className="text-[12px] font-medium leading-snug" style={{ color: ink }}>
        {children}
      </p>
    </div>
  );
}

/** Compact right-aligned keyboard legend. The real shortcut semantics live on the
 *  buttons (aria-keyshortcuts); this is a quiet visual reminder, hidden where
 *  there is no physical keyboard. Replaces per-button keycaps that crowded the row. */
function KeyLegend() {
  const keys: Array<[string, string]> = [
    ["A", "Confirm"],
    ["E", "Edit"],
    ["U", "Mark unknown"],
    ["S", "Skip"],
  ];
  return (
    <span className="ml-auto hidden items-center gap-1.5 self-center sm:inline-flex" aria-hidden>
      <span className="ui-caps-3 text-[10px] leading-none text-[var(--text-tertiary)]">Keys</span>
      {keys.map(([k, label]) => (
        <kbd
          key={k}
          title={label}
          className="rounded border border-[var(--border-card)] bg-[var(--surface)] px-1 font-mono text-[9px] font-normal not-italic leading-[1.5] text-[var(--text-tertiary)]"
        >
          {k}
        </kbd>
      ))}
    </span>
  );
}

/** Returns a `<input type="date">`-compatible `YYYY-MM-DD` seed only when the
 *  stored value is already an ISO date; otherwise null so callers fall back to a
 *  text input (avoids timezone-shifted reformatting of free-text dates). */
function isoDateSeed(value: string | null): string | null {
  if (!value) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  return m ? m[1] : null;
}

interface FieldReviewWorkspaceActionsProps {
  fieldId: string;
  fieldLabel: string;
  suggestedValue: string | null;
  canEdit: boolean;
  /** False when there is no suggested value to confirm — Mark unknown becomes the
   *  emphasized safe action and Confirm is de-emphasized. */
  hasValue: boolean;
  /** Date-typed field — the editor offers a native date picker when the stored
   *  value is ISO. */
  isDate: boolean;
  needsCitation: boolean;
  /** AI value whose snippet exists but was NOT located in the source preview.
   *  Confirmation stays possible (derived values legitimately differ from prose) but
   *  is warning-toned from the start and gated behind an explicit confirmation. */
  sourceUnverified: boolean;
  /** Confirm is emphasized as the primary action only when the value is trusted
   *  to use (source-backed or manually entered, with a value). Otherwise it
   *  renders secondary so the user is nudged to verify, edit, or mark unknown. */
  approveIsPrimary?: boolean;
  nextHref: string | null;
  skipHref: string | null;
  /** `flat` drops the component's own top border + padding when it is hosted in
   *  the sticky `ReviewActionBar` (which supplies the separation). */
  variant?: "default" | "flat";
}

type PendingAction = "approved" | "rejected" | "edited" | null;

const WARNING_APPROVE_CLASS =
  "inline-flex min-w-[7rem] items-center justify-center gap-1.5 rounded-full border border-[color:color-mix(in_oklab,var(--warning)_45%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning-soft)_45%,var(--surface-raised))] px-4 py-2 text-[13px] font-semibold text-[var(--warning-ink)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-50";

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
  // Default to the historic behavior (primary when there is a value) when the
  // caller does not pass an explicit emphasis.
  const approveCanBePrimary = approveIsPrimary ?? hasValue;
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [editValue, setEditValue] = useState(suggestedValue ?? "");
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

  // Confirm directly when source support is clear; require one extra confirmation when
  // the suggestion was not located in the source.
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
      <div className={`flex flex-wrap items-center gap-2 ${rowBorderClass}`}>
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

  // Confirm is warning-toned the moment the source is unverified (telegraphs the
  // gate) and primary only when there is a value with clear source support.
  const approveWarning = sourceUnverified || confirmApprove;
  const approveClass = approveWarning
    ? WARNING_APPROVE_CLASS
    : approveCanBePrimary
      ? "ui-btn-primary inline-flex min-w-[7rem] items-center justify-center gap-1.5 rounded-full px-4 py-2 text-[13px] disabled:cursor-not-allowed disabled:opacity-40"
      : "ui-btn-secondary inline-flex min-w-[7rem] items-center justify-center gap-1.5 rounded-full px-4 py-2 text-[13px] disabled:cursor-not-allowed disabled:opacity-40";
  // With no value to approve, Mark unknown is the emphasized safe decision.
  const unknownClass = hasValue
    ? "ui-btn-secondary inline-flex min-w-[8rem] items-center justify-center gap-1.5 rounded-full px-4 py-2 text-[13px] disabled:opacity-50"
    : "ui-btn-primary inline-flex min-w-[8rem] items-center justify-center gap-1.5 rounded-full px-4 py-2 text-[13px] disabled:opacity-50";

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
            className="ui-btn-primary inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] disabled:opacity-50"
            disabled={isPending}
            onClick={() => save("edited", editValue)}
          >
            {saving ? <UiSpinner size="sm" /> : null}
            {saving ? "Saving…" : nextHref ? "Save and next" : "Save"}
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
        {error ? <ActionAlert tone="danger">{error}</ActionAlert> : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
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
                : "Confirm (A)"
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
          {approving ? "Confirming…" : confirmApprove ? "Confirm anyway" : "Confirm"}
        </button>
        {confirmApprove && !approving ? (
          <button
            type="button"
            className="ui-btn-ghost inline-flex items-center justify-center rounded-full px-3 py-2 text-[13px]"
            disabled={isPending}
            onClick={() => setConfirmApprove(false)}
            title="Cancel confirmation (Esc)"
          >
            Cancel
          </button>
        ) : null}
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
          className={unknownClass}
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
        {/* Skip defers rather than decides — quiet ghost treatment sets it apart
            from the bordered decision buttons, so no divider is needed. */}
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
        <KeyLegend />
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
