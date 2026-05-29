"use client";

import {
  memo,
  useMemo,
  useState,
  useTransition,
  useRef,
  type KeyboardEvent,
} from "react";
import { format } from "date-fns";
import { ArrowRight, Check, CircleHelp, Pencil } from "lucide-react";
import { updateContractField } from "@/actions/contracts";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function formatFieldValue(raw: string | null | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (ISO_DATE_RE.test(trimmed)) {
    const parsed = new Date(`${trimmed}T12:00:00`);
    if (!Number.isNaN(parsed.getTime())) return format(parsed, "MMM d, yyyy");
  }
  return raw;
}
import {
  buildFieldReviewStatusMessage,
  getCriticalFieldReviewSummary,
  sortFieldsForReview,
} from "@/lib/review-feedback";
import type { ExtractedField } from "@/lib/types";
import { EmptyState } from "@/components/ui/empty-state";
import { describeRecoverableMutationError } from "@/lib/recoverable-mutation-error";
import { fieldReviewProvenanceLabel } from "@/lib/compatibility-field-provenance";
import { CriticalDateReviewNotice } from "./critical-date-review-notice";

const statusBadge: Record<string, string> = {
  pending: "ui-status-badge ui-status-badge-warning",
  approved: "ui-status-badge ui-status-badge-healthy",
  rejected: "ui-status-badge ui-status-badge-critical",
  edited: "ui-status-badge ui-status-badge-in-review",
};
const CRITICAL_DATE_REVIEW_COPY = "Key date coverage still needs review";

interface FieldReviewProps {
  fields: ExtractedField[];
  /** When false, hide approve/edit/mark unknown (viewer role). */
  canEdit?: boolean;
  emptyTitle?: string;
  emptyCopy?: string;
}

export function FieldReview({
  fields,
  canEdit = true,
  emptyTitle = "No extracted fields",
  emptyCopy = "Run Extract fields with AI after upload. Use text-based PDF or DOCX.",
}: FieldReviewProps) {
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
        title={emptyTitle}
        copy={emptyCopy}
        size="compact"
        className="min-h-40 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_34%,transparent)] px-4 py-5"
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
          <span className="ui-caps-3 text-[var(--text-tertiary)]">Shortcuts</span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="inline-flex items-center gap-1.5">
              <kbd className="ui-kbd">A</kbd> approve
            </span>
            <span className="inline-flex items-center gap-1.5">
              <kbd className="ui-kbd">E</kbd> edit
            </span>
            <span className="inline-flex items-center gap-1.5">
              <kbd className="ui-kbd">M</kbd> mark unknown
            </span>
            <span className="inline-flex items-center gap-1.5">
              <kbd className="ui-kbd">S</kbd> skip
            </span>
          </span>
          <span className="ml-auto text-[var(--text-tertiary)]">
            <span className="font-mono tabular-nums">{pendingCount}</span> pending
          </span>
        </div>
      )}
      {criticalSummary.pendingLabels.length > 0 && (
        <CriticalDateReviewNotice
          pendingLabels={criticalSummary.pendingLabels}
          missingLabels={criticalSummary.missingLabels}
          canEdit={canEdit}
          summaryCopy={CRITICAL_DATE_REVIEW_COPY}
        />
      )}
      <div className="border-t border-[var(--border-subtle)]" role="list" aria-label="Extracted contract fields">
        <div className="divide-y divide-[var(--border-subtle)]">
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
        </div>
      </div>
    </div>
  );
}

function focusNextPendingRow(row: HTMLElement | null) {
  if (!row?.parentElement) return;
  const parent = row.parentElement;
  queueMicrotask(() => {
    requestAnimationFrame(() => {
      let el: Element | null = row.nextElementSibling;
      while (el) {
        if (el instanceof HTMLElement && el.tabIndex === 0) {
          el.focus();
          return;
        }
        el = el.nextElementSibling;
      }
      parent.querySelector<HTMLElement>("[data-review-focus-row='true']")?.focus();
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
  const rowRef = useRef<HTMLDivElement>(null);
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
      ? "bg-[color:color-mix(in_oklab,var(--warning-soft)_16%,transparent)]"
      : field.status === "approved"
        ? "bg-transparent"
        : field.status === "rejected"
          ? "bg-[color:color-mix(in_oklab,var(--danger-soft)_14%,transparent)]"
          : "bg-[color:color-mix(in_oklab,var(--accent-soft)_14%,transparent)]";

  const rowKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!canEdit || field.status !== "pending" || editing) return;
    const t = e.target as HTMLElement;
    if (t.closest("input, textarea, button")) return;

    const key = e.key.toLowerCase();
    if (key === "a") {
      if (needsCitation) return;
      e.preventDefault();
      handleAction("approved");
    } else if (key === "m") {
      e.preventDefault();
      handleAction("rejected");
    } else if (key === "e") {
      e.preventDefault();
      setEditing(true);
      setEditValue(field.field_value || "");
    } else if (key === "s") {
      e.preventDefault();
      focusNextPendingRow(rowRef.current);
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
    <article
      ref={rowRef}
      id={`field-${field.id}`}
      role="listitem"
      data-review-focus-row={canEdit && field.status === "pending" && !editing ? "true" : undefined}
      className={`scroll-mt-28 px-3 py-2.5 outline-none transition-colors focus-visible:bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)] sm:px-4 sm:py-3 ${rowBg}`}
      tabIndex={canEdit && field.status === "pending" && !editing ? 0 : -1}
      onKeyDown={rowKeyDown}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.84fr)_minmax(0,1.05fr)_minmax(0,0.7fr)_auto] lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold capitalize text-[var(--text-primary)]">{fieldLabel}</p>
            <span
              className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] ${
                statusBadge[field.status] ?? "ui-status-badge ui-status-badge-in-review"
              }`}
            >
              {field.status === "pending"
                ? "Pending"
                : field.status === "approved"
                  ? "Approved"
                  : field.status === "rejected"
                    ? "Marked unknown"
                    : "Edited"}
            </span>
          </div>
          <span
            className="mt-1 inline-flex items-center overflow-hidden rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[10px] leading-none"
            aria-label={`${field.source === "ai" ? "AI extraction" : "Human entry"}${field.confidence != null ? ` at ${Math.round(Math.min(1, Math.max(0, field.confidence)) * 100)}% signal` : ""}`}
          >
            <span className="px-1.5 py-0.5 font-bold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
              {field.source === "ai" ? "AI" : "Human"}
            </span>
            {field.confidence != null ? (
              <span className="border-l border-[var(--border-subtle)] px-1.5 py-0.5 font-medium uppercase tracking-[0.12em] tabular-nums text-[var(--text-tertiary)]">
                {Math.round(Math.min(1, Math.max(0, field.confidence)) * 100)}%
              </span>
            ) : null}
          </span>
          {field.status !== "approved" ? (
            <p className="mt-2 max-w-sm text-[11px] leading-snug text-[var(--text-tertiary)]">
              {provenanceLabel}
            </p>
          ) : null}
        </div>

        <div className="min-w-0 text-[var(--text-primary)]">
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
                className="ui-input py-2 text-[12.5px]"
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
              <span className="block break-words font-medium leading-relaxed tabular-nums">
                {field.field_value ? (
                  formatFieldValue(field.field_value)
                ) : (
                  <span className="font-normal italic text-[var(--text-tertiary)]">Unknown</span>
                )}
              </span>
              {needsCitation && (
                <p className="ui-alert-warning mt-2 px-2.5 py-2 text-[11px] leading-snug">
                  Citation required: edit to add source text, or mark this value unknown.
                </p>
              )}
              {actionError && (
                <p className="mt-2 text-xs font-medium text-[var(--danger-ink)]">{actionError}</p>
              )}
            </>
          )}
        </div>

        <div className="min-w-0">
          {field.source_snippet ? (
            <>
              <p className="ui-caps-3 text-[var(--text-tertiary)]">Source excerpt</p>
              <p className="mt-1 max-h-24 overflow-y-auto text-[12px] leading-snug text-[var(--text-secondary)]">
                {field.source_snippet}
              </p>
            </>
          ) : (
            <span className="text-[12px] text-[var(--text-tertiary)]">—</span>
          )}
        </div>

        {canEdit ? (
          <div className="flex justify-start lg:justify-end">
            {field.status === "pending" && !editing ? (
              <div className="inline-flex rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] p-0.5 shadow-[var(--shadow-1)]">
                <button
                  type="button"
                  onClick={() => handleAction("approved")}
                  disabled={isPending || needsCitation}
                  className="ui-icon-button min-h-0 min-w-0 rounded-[calc(var(--radius-lg)-0.1rem)] border-transparent bg-transparent p-2 text-[var(--success-ink)] shadow-none transition-colors hover:bg-[color:color-mix(in_oklab,var(--success)_20%,transparent)] hover:text-[var(--success-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_oklab,var(--success)_55%,transparent)] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
                  title={
                    needsCitation
                      ? "Add a source citation by editing first"
                      : "Approve"
                  }
                  aria-label={`Approve ${fieldLabel}`}
                >
                  <Check size={17} aria-hidden strokeWidth={1.85} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(true);
                    setEditValue(field.field_value || "");
                  }}
                  disabled={isPending}
                  className="ui-icon-button min-h-0 min-w-0 rounded-[calc(var(--radius-lg)-0.1rem)] border-transparent bg-transparent p-2 text-[var(--accent)] shadow-none transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent)_18%,transparent)] hover:text-[var(--accent-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_oklab,var(--accent)_55%,transparent)] disabled:opacity-50 disabled:hover:bg-transparent"
                  title="Edit"
                  aria-label={`Edit ${fieldLabel}`}
                >
                  <Pencil size={17} strokeWidth={1.65} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => handleAction("rejected")}
                  disabled={isPending}
                  className="ui-icon-button min-h-0 min-w-0 rounded-[calc(var(--radius-lg)-0.1rem)] border-transparent bg-transparent p-2 text-[var(--danger-ink)] shadow-none transition-colors hover:bg-[color:color-mix(in_oklab,var(--danger)_18%,transparent)] hover:text-[var(--danger-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_oklab,var(--danger)_55%,transparent)] disabled:opacity-50 disabled:hover:bg-transparent"
                  title="Mark unknown"
                  aria-label={`Mark unknown ${fieldLabel}`}
                >
                  <CircleHelp size={17} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => focusNextPendingRow(rowRef.current)}
                  disabled={isPending}
                  className="ui-icon-button min-h-0 min-w-0 rounded-[calc(var(--radius-lg)-0.1rem)] border-transparent bg-transparent p-2 text-[var(--accent)] shadow-none transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent)_14%,transparent)] hover:text-[var(--accent-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_oklab,var(--accent)_55%,transparent)] disabled:opacity-50 disabled:hover:bg-transparent"
                  title="Skip"
                  aria-label={`Skip ${fieldLabel}`}
                >
                  <ArrowRight size={17} aria-hidden />
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
});
