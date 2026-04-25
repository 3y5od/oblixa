"use client";

import {
  memo,
  useEffect,
  useMemo,
  useState,
  useTransition,
  useRef,
  type KeyboardEvent,
} from "react";
import { Check, X, Pencil } from "lucide-react";
import { updateContractField } from "@/actions/contracts";
import {
  buildFieldReviewStatusMessage,
  getCriticalFieldReviewSummary,
  sortFieldsForReview,
} from "@/lib/review-feedback";
import type { ExtractedField } from "@/lib/types";
import { EmptyState } from "@/components/ui/empty-state";
import { describeRecoverableMutationError } from "@/lib/recoverable-mutation-error";
import { fieldReviewProvenanceLabel } from "@/lib/v9-field-provenance";

const statusBadge: Record<string, string> = {
  pending: "ui-status-badge ui-status-badge-warning",
  approved: "ui-status-badge ui-status-badge-healthy",
  rejected: "ui-status-badge ui-status-badge-critical",
  edited: "ui-status-badge ui-status-badge-in-review",
};

function confidenceLabel(c: number | null): string {
  if (c == null || Number.isNaN(c)) return "—";
  const pct = Math.round(Math.min(1, Math.max(0, c)) * 100);
  return `${pct}%`;
}

function confidenceTone(c: number | null): string {
  if (c == null) return "text-[var(--text-tertiary)]";
  if (c >= 0.75) return "text-[var(--success-ink)]";
  if (c >= 0.45) return "text-[var(--warning-ink)]";
  return "text-[var(--danger-ink)]";
}

interface FieldReviewProps {
  fields: ExtractedField[];
  /** When false, hide approve/edit/reject (viewer role). */
  canEdit?: boolean;
}

export function FieldReview({ fields, canEdit = true }: FieldReviewProps) {
  const [currentFields, setCurrentFields] = useState(fields);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    setCurrentFields(fields);
  }, [fields]);

  const pendingCount = currentFields.filter((f) => f.status === "pending").length;
  const hasPending = pendingCount > 0;
  const orderedFields = useMemo(() => sortFieldsForReview(currentFields), [currentFields]);
  const criticalSummary = useMemo(
    () => getCriticalFieldReviewSummary(currentFields),
    [currentFields]
  );

  if (currentFields.length === 0) {
    return (
      <EmptyState
        title="No extracted fields"
        copy="Run Extract fields with AI after upload. Use text-based PDF or DOCX."
      />
    );
  }

  return (
    <div className="space-y-4">
      {statusMessage ? (
        <div
          className="ui-alert-success"
          role="status"
          aria-live="polite"
        >
          {statusMessage}
        </div>
      ) : null}
      {canEdit && hasPending && (
        <div className="ui-toolbar">
          <span className="font-semibold text-[var(--text-secondary)]">Shortcuts</span>
          <span className="hidden sm:inline text-[var(--text-tertiary)]">·</span>
          <span>
            <kbd className="ui-kbd">A</kbd> approve · <kbd className="ui-kbd">R</kbd> reject ·{" "}
            <kbd className="ui-kbd">E</kbd> edit · <kbd className="ui-kbd">Esc</kbd> cancel
          </span>
          <span className="hidden sm:inline text-[var(--text-tertiary)]">·</span>
          <span>{pendingCount} pending</span>
        </div>
      )}
      {(criticalSummary.pendingLabels.length > 0 || criticalSummary.missingLabels.length > 0) && (
        <div className="ui-alert-warning px-4 py-3 text-sm">
          <p className="font-semibold">Key date coverage still needs review</p>
          <p className="mt-1 text-[13px] leading-relaxed">
            Approve or add end, renewal, and notice values before reminders, renewal reporting, or downstream work should rely on this contract.
          </p>
          <div className="mt-2 flex flex-col gap-1 text-[12px]">
            {criticalSummary.pendingLabels.length > 0 ? (
              <p>Pending now: {criticalSummary.pendingLabels.join(", ")}.</p>
            ) : null}
            {criticalSummary.missingLabels.length > 0 ? (
              <p>Still missing an approved value: {criticalSummary.missingLabels.join(", ")}.</p>
            ) : null}
          </div>
        </div>
      )}
      <div className="ui-table-shell">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-[13px]">
            <caption className="sr-only">
              Extracted contract fields — approve, reject, or edit pending rows
            </caption>
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))]/90">
                <th className="ui-table-header whitespace-nowrap px-4 py-3.5 text-left first:pl-6">
                  Field
                </th>
                <th className="ui-table-header whitespace-nowrap px-4 py-3.5 text-left">
                  Value
                </th>
                <th className="ui-table-header whitespace-nowrap px-4 py-3.5 text-left">
                  Model confidence
                </th>
                <th className="ui-table-header min-w-[220px] whitespace-nowrap px-4 py-3.5 text-left">
                  Source evidence
                </th>
                <th className="ui-table-header whitespace-nowrap px-4 py-3.5 text-left">
                  Status
                </th>
                {canEdit && (
                  <th className="ui-table-header whitespace-nowrap px-4 py-3.5 pr-6 text-right">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {orderedFields.map((field) => (
                <FieldRow
                  key={field.id}
                  field={field}
                  canEdit={canEdit}
                  onUpdated={(nextField, action) => {
                    setCurrentFields((prev) => {
                      const next = prev.map((candidate) =>
                        candidate.id === nextField.id ? nextField : candidate
                      );
                      const nextPendingCount = next.filter((candidate) => candidate.status === "pending").length;
                      setStatusMessage(
                        buildFieldReviewStatusMessage({
                          pendingCount: nextPendingCount,
                          action,
                          fieldLabel: nextField.field_name.replace(/_/g, " "),
                        })
                      );
                      return next;
                    });
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function focusNextPendingRow(row: HTMLTableRowElement | null) {
  if (!row?.parentElement) return;
  const parent = row.parentElement;
  queueMicrotask(() => {
    requestAnimationFrame(() => {
      let el: Element | null = row.nextElementSibling;
      while (el) {
        if (el instanceof HTMLTableRowElement && el.tabIndex === 0) {
          el.focus();
          return;
        }
        el = el.nextElementSibling;
      }
      parent.querySelector<HTMLTableRowElement>("tr[tabindex='0']")?.focus();
    });
  });
}

const FieldRow = memo(function FieldRow({
  field,
  canEdit,
  onUpdated,
}: {
  field: ExtractedField;
  canEdit: boolean;
  onUpdated: (field: ExtractedField, action: "approved" | "rejected" | "edited") => void;
}) {
  const rowRef = useRef<HTMLTableRowElement>(null);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(field.field_value || "");
  const [isPending, startTransition] = useTransition();
  const [currentField, setCurrentField] = useState(field);
  const [actionError, setActionError] = useState<string | null>(null);

  const hasValue =
    currentField.field_value != null &&
    String(currentField.field_value).trim().length > 0;
  const hasSnippet =
    currentField.source_snippet != null &&
    String(currentField.source_snippet).trim().length > 0;
  const needsCitation =
    currentField.status === "pending" &&
    currentField.source === "ai" &&
    hasValue &&
    !hasSnippet;

  function handleAction(action: "approved" | "rejected" | "edited", newValue?: string) {
    setActionError(null);
    startTransition(async () => {
      const result = await updateContractField(currentField.id, action, newValue);
      if (result && "error" in result && result.error) {
        setActionError(describeRecoverableMutationError(result.error));
        return;
      }
      if (result && "success" in result && result.success) {
        const wasPending = currentField.status === "pending";
        const nextField = {
          ...currentField,
          status: action,
          ...(action === "edited" && newValue !== undefined
            ? { field_value: newValue, source: "human" as const }
            : {}),
        };
        setCurrentField(nextField);
        onUpdated(nextField, action);
        setEditing(false);
        if (wasPending && (action === "approved" || action === "rejected" || action === "edited")) {
          focusNextPendingRow(rowRef.current);
        }
      }
    });
  }

  const rowBg =
    currentField.status === "pending"
      ? "bg-[color:color-mix(in_oklab,var(--warning-soft)_34%,transparent)]"
      : currentField.status === "approved"
        ? "bg-[color:color-mix(in_oklab,var(--success-soft)_28%,transparent)]"
        : currentField.status === "rejected"
          ? "bg-[color:color-mix(in_oklab,var(--danger-soft)_30%,transparent)]"
          : "bg-[color:color-mix(in_oklab,var(--accent-soft)_30%,transparent)]";

  const rowKeyDown = (e: KeyboardEvent<HTMLTableRowElement>) => {
    if (!canEdit || currentField.status !== "pending" || editing) return;
    const t = e.target as HTMLElement;
    if (t.closest("input, textarea, button")) return;

    const key = e.key.toLowerCase();
    if (key === "a") {
      if (needsCitation) return;
      e.preventDefault();
      handleAction("approved");
    } else if (key === "r") {
      e.preventDefault();
      handleAction("rejected");
    } else if (key === "e") {
      e.preventDefault();
      setEditing(true);
      setEditValue(currentField.field_value || "");
    }
  };

  const fieldLabel = currentField.field_name.replace(/_/g, " ");

  return (
    <tr
      ref={rowRef}
      id={`field-${currentField.id}`}
      className={`scroll-mt-28 outline-none transition-colors focus-visible:bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/20 ${rowBg}`}
      tabIndex={canEdit && currentField.status === "pending" && !editing ? 0 : -1}
      onKeyDown={rowKeyDown}
    >
      <td className="whitespace-nowrap px-4 py-4 align-top first:pl-6">
        <p className="font-semibold capitalize text-[var(--text-primary)]">{fieldLabel}</p>
        <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
          {currentField.source === "ai" ? "AI extraction" : "Human entry"}
        </p>
      </td>
      <td className="max-w-[min(280px,32vw)] px-4 py-4 align-top text-[var(--text-primary)]">
        {editing ? (
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  setEditing(false);
                  setActionError(null);
                }
              }}
              className="ui-input py-2 text-[13px]"
              aria-label={`Edit ${fieldLabel}`}
            />
            {actionError && <p className="text-xs font-medium text-[var(--danger-ink)]">{actionError}</p>}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleAction("edited", editValue)}
                disabled={isPending}
                className="ui-btn-primary px-3 py-1.5 text-xs disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="ui-btn-secondary px-3 py-1.5 text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <span className="font-medium">
              {currentField.field_value || (
                <span className="font-normal italic text-[var(--text-tertiary)]">Unknown</span>
              )}
            </span>
            {needsCitation && (
              <p className="ui-alert-warning mt-2 px-2.5 py-2 text-[11px] leading-snug">
                Citation required: edit to add source text, or reject this extraction.
              </p>
            )}
            {actionError && (
              <p className="mt-2 text-xs font-medium text-[var(--danger-ink)]">{actionError}</p>
            )}
          </>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-4 align-top">
        <span
          className={`text-[13px] font-semibold tabular-nums ${confidenceTone(currentField.confidence)}`}
          title="Model-reported certainty (0–100%)"
        >
          {confidenceLabel(currentField.confidence)}
        </span>
        <p className="mt-2 max-w-[14rem] text-[11px] leading-snug text-[var(--text-tertiary)]">
          {fieldReviewProvenanceLabel({
            status: currentField.status,
            confidence:
              currentField.confidence == null
                ? null
                : Math.round(Math.min(1, Math.max(0, currentField.confidence)) * 100),
          })}
        </p>
      </td>
      <td className="max-w-[min(320px,40vw)] px-4 py-4 align-top">
        {currentField.source_snippet ? (
          <blockquote className="ui-source-quote rounded-r-lg text-[13px] leading-snug">
            <span className="italic text-[var(--text-secondary)]">
              &ldquo;{currentField.source_snippet}&rdquo;
            </span>
          </blockquote>
        ) : (
          <span className="text-[13px] text-[var(--text-tertiary)]">—</span>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-4 align-top">
        <span
          className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
            statusBadge[currentField.status]
          }`}
        >
          {currentField.status === "pending"
            ? "Pending"
            : currentField.status === "approved"
              ? "Approved"
              : currentField.status === "rejected"
                ? "Rejected"
                : "Edited"}
        </span>
      </td>
      {canEdit && (
        <td className="whitespace-nowrap px-4 py-4 pr-6 align-top text-right">
          {currentField.status === "pending" && !editing && (
            <div className="inline-flex rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] p-0.5 shadow-[var(--shadow-1)]">
              <button
                type="button"
                onClick={() => handleAction("approved")}
                disabled={isPending || needsCitation}
                className="ui-icon-button min-h-0 min-w-0 rounded-[calc(var(--radius-lg)-0.1rem)] border-transparent bg-transparent p-2 text-[var(--success-ink)] shadow-none hover:bg-surface disabled:cursor-not-allowed disabled:opacity-35"
                title={
                  needsCitation
                    ? "Add a source citation by editing first"
                    : "Approve"
                }
                aria-label={`Approve ${fieldLabel}`}
              >
                <Check size={17} aria-hidden strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(true);
                  setEditValue(currentField.field_value || "");
                }}
                disabled={isPending}
                className="ui-icon-button min-h-0 min-w-0 rounded-[calc(var(--radius-lg)-0.1rem)] border-transparent bg-transparent p-2 text-[var(--accent)] shadow-none hover:bg-surface disabled:opacity-50"
                title="Edit"
                aria-label={`Edit ${fieldLabel}`}
              >
                <Pencil size={17} strokeWidth={1.75} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => handleAction("rejected")}
                disabled={isPending}
                className="ui-icon-button min-h-0 min-w-0 rounded-[calc(var(--radius-lg)-0.1rem)] border-transparent bg-transparent p-2 text-[var(--danger-ink)] shadow-none hover:bg-surface disabled:opacity-50"
                title="Reject"
                aria-label={`Reject ${fieldLabel}`}
              >
                <X size={17} aria-hidden />
              </button>
            </div>
          )}
        </td>
      )}
    </tr>
  );
});
