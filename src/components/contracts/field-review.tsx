"use client";

import {
  memo,
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
  const [reviewState, setReviewState] = useState(() => ({
    sourceFields: fields,
    rows: fields,
  }));
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const currentFields = reviewState.sourceFields === fields ? reviewState.rows : fields;

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
        <CriticalDateReviewNotice
          pendingLabels={criticalSummary.pendingLabels}
          missingLabels={criticalSummary.missingLabels}
          canEdit={canEdit}
        />
      )}
      <div className="ui-table-shell">
        <div className="overflow-x-auto">
          <table className="min-w-[1080px] table-fixed border-collapse text-[13px]">
            <caption className="sr-only">
              Extracted contract fields — approve, reject, or edit pending rows
            </caption>
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))]/90">
                <th className="ui-table-header w-[22%] whitespace-nowrap px-4 py-3.5 text-left first:pl-6">
                  Field
                </th>
                <th className="ui-table-header w-[20%] whitespace-nowrap px-4 py-3.5 text-left">
                  Value
                </th>
                <th className="ui-table-header w-[13%] whitespace-nowrap px-4 py-3.5 text-left">
                  Model confidence
                </th>
                <th className="ui-table-header w-[25%] whitespace-nowrap px-4 py-3.5 text-left">
                  Source evidence
                </th>
                <th className="ui-table-header w-[10%] whitespace-nowrap px-4 py-3.5 text-left">
                  Status
                </th>
                {canEdit && (
                  <th className="ui-table-header w-[10%] whitespace-nowrap px-4 py-3.5 pr-6 text-right">
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
                    const next = currentFields.map((candidate) =>
                      candidate.id === nextField.id ? nextField : candidate
                    );
                    const nextPendingCount = next.filter((candidate) => candidate.status === "pending").length;
                    setReviewState({ sourceFields: fields, rows: next });
                    setStatusMessage(
                      buildFieldReviewStatusMessage({
                        pendingCount: nextPendingCount,
                        action,
                        fieldLabel: nextField.field_name.replace(/_/g, " "),
                      })
                    );
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

function CriticalDateReviewNotice({
  pendingLabels,
  missingLabels,
  canEdit,
}: {
  pendingLabels: string[];
  missingLabels: string[];
  canEdit: boolean;
}) {
  return (
    <section
      className="rounded-2xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--warning-soft)_32%,var(--surface))] px-4 py-3 text-sm text-[var(--warning-ink)]"
      role="status"
      aria-labelledby="critical-date-review-title"
      data-testid="critical-date-review-notice"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1">
          <p id="critical-date-review-title" className="font-semibold text-[var(--text-primary)]">
            Date automation is blocked until key dates are approved
          </p>
          <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
            Reminders, renewals, and downstream workflow should not rely on this contract until the fields below have approved values.
          </p>
        </div>
        <p className="shrink-0 text-[12px] font-medium text-[var(--text-secondary)]">
          {canEdit ? "Approve, edit, or add the missing values below." : "Ask an editor to approve or add the missing values."}
        </p>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {pendingLabels.length > 0 ? (
          <div className="min-w-0 rounded-xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface)_72%,transparent)] px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Needs review</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {pendingLabels.map((label) => (
                <span key={`pending-${label}`} className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-2 py-0.5 text-[12px] font-medium text-[var(--text-secondary)]">
                  {label}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        {missingLabels.length > 0 ? (
          <div className="min-w-0 rounded-xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface)_72%,transparent)] px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Missing approved value</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {missingLabels.map((label) => (
                <span key={`missing-${label}`} className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-2 py-0.5 text-[12px] font-medium text-[var(--text-secondary)]">
                  {label}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
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
  const [actionError, setActionError] = useState<string | null>(null);

  const hasValue =
    field.field_value != null &&
    String(field.field_value).trim().length > 0;
  const hasSnippet =
    field.source_snippet != null &&
    String(field.source_snippet).trim().length > 0;
  const needsCitation =
    field.status === "pending" &&
    field.source === "ai" &&
    hasValue &&
    !hasSnippet;

  function handleAction(action: "approved" | "rejected" | "edited", newValue?: string) {
    setActionError(null);
    startTransition(async () => {
      const result = await updateContractField(field.id, action, newValue);
      if (result && "error" in result && result.error) {
        setActionError(describeRecoverableMutationError(result.error));
        return;
      }
      if (result && "success" in result && result.success) {
        const wasPending = field.status === "pending";
        const nextField = {
          ...field,
          status: action,
          ...(action === "edited" && newValue !== undefined
            ? { field_value: newValue, source: "human" as const }
            : {}),
        };
        onUpdated(nextField, action);
        setEditing(false);
        if (wasPending && (action === "approved" || action === "rejected" || action === "edited")) {
          focusNextPendingRow(rowRef.current);
        }
      }
    });
  }

  const rowBg =
    field.status === "pending"
      ? "bg-[color:color-mix(in_oklab,var(--warning-soft)_34%,transparent)]"
      : field.status === "approved"
        ? "bg-[color:color-mix(in_oklab,var(--success-soft)_28%,transparent)]"
        : field.status === "rejected"
          ? "bg-[color:color-mix(in_oklab,var(--danger-soft)_30%,transparent)]"
          : "bg-[color:color-mix(in_oklab,var(--accent-soft)_30%,transparent)]";

  const rowKeyDown = (e: KeyboardEvent<HTMLTableRowElement>) => {
    if (!canEdit || field.status !== "pending" || editing) return;
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
      setEditValue(field.field_value || "");
    }
  };

  const fieldLabel = field.field_name.replace(/_/g, " ");
  const provenanceLabel = fieldReviewProvenanceLabel({
    status: field.status,
    confidence:
      field.confidence == null
        ? null
        : Math.round(Math.min(1, Math.max(0, field.confidence)) * 100),
  });

  return (
    <tr
      ref={rowRef}
      id={`field-${field.id}`}
      className={`scroll-mt-28 outline-none transition-colors focus-visible:bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/20 ${rowBg}`}
      tabIndex={canEdit && field.status === "pending" && !editing ? 0 : -1}
      onKeyDown={rowKeyDown}
    >
      <td className="px-4 py-4 align-top first:pl-6">
        <p className="font-semibold capitalize text-[var(--text-primary)]">{fieldLabel}</p>
        <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
          {field.source === "ai" ? "AI extraction" : "Human entry"}
        </p>
        <p className="mt-2 rounded-lg border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_62%,transparent)] px-2.5 py-2 text-[11px] leading-snug text-[var(--text-secondary)] break-words">
          {provenanceLabel}
        </p>
      </td>
      <td className="px-4 py-4 align-top text-[var(--text-primary)]">
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
            <span className="block break-words font-medium leading-relaxed">
              {field.field_value || (
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
          className={`text-[13px] font-semibold tabular-nums ${confidenceTone(field.confidence)}`}
          title="Model-reported certainty (0–100%)"
        >
          {confidenceLabel(field.confidence)}
        </span>
        <p className="mt-2 text-[11px] leading-snug text-[var(--text-tertiary)]">
          Model signal only
        </p>
      </td>
      <td className="px-4 py-4 align-top">
        {field.source_snippet ? (
          <blockquote className="ui-source-quote max-h-28 overflow-y-auto rounded-r-lg text-[13px] leading-snug break-words">
            <span className="italic text-[var(--text-secondary)]">
              &ldquo;{field.source_snippet}&rdquo;
            </span>
          </blockquote>
        ) : (
          <span className="text-[13px] text-[var(--text-tertiary)]">—</span>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-4 align-top">
        <span
          className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
            statusBadge[field.status] ?? "ui-status-badge ui-status-badge-in-review"
          }`}
        >
          {field.status === "pending"
            ? "Pending"
            : field.status === "approved"
              ? "Approved"
              : field.status === "rejected"
                ? "Rejected"
                : "Edited"}
        </span>
      </td>
      {canEdit && (
        <td className="whitespace-nowrap px-4 py-4 pr-6 align-top text-right">
          {field.status === "pending" && !editing && (
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
                  setEditValue(field.field_value || "");
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
