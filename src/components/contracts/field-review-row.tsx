"use client";

import { memo, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { ArrowRight, Check, CircleHelp, Pencil } from "lucide-react";
import { updateContractField } from "@/actions/contracts";
import { formatBusinessDateAtNoon } from "@/lib/business-dates";
import type { ExtractedField } from "@/lib/types";
import { KeyValueChip } from "@/components/ui/key-value-chip";
import { fieldReviewProvenanceLabel } from "@/lib/compatibility-field-provenance";
import { describeRecoverableMutationError } from "@/lib/recoverable-mutation-error";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const statusBadge: Record<string, string> = {
  pending: "ui-status-badge ui-status-badge-warning",
  approved: "ui-status-badge ui-status-badge-healthy",
  rejected: "ui-status-badge ui-status-badge-critical",
  edited: "ui-status-badge ui-status-badge-in-review",
};

export const ROW_GRID =
  "lg:grid lg:grid-cols-[minmax(0,0.84fr)_minmax(0,1.05fr)_minmax(0,0.7fr)_auto] lg:items-start lg:gap-4";

function formatFieldValue(raw: string | null | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (ISO_DATE_RE.test(trimmed)) {
    return formatBusinessDateAtNoon(trimmed, raw);
  }
  return raw;
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

export const FieldRow = memo(function FieldRow({
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
  const [snippetExpanded, setSnippetExpanded] = useState(false);
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

  const rowRail =
    field.status === "pending"
      ? "border-l-[color:color-mix(in_oklab,var(--warning-ink)_55%,transparent)]"
      : field.status === "rejected"
        ? "border-l-[color:color-mix(in_oklab,var(--danger-ink)_55%,transparent)]"
        : field.status === "edited"
          ? "border-l-[color:color-mix(in_oklab,var(--accent)_55%,transparent)]"
          : "border-l-transparent";

  const rowKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!canEdit || field.status !== "pending" || editing) return;
    const target = e.target as HTMLElement;
    if (target.closest("input, textarea, button")) return;

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
  const confidencePct =
    field.confidence == null
      ? null
      : Math.round(Math.min(1, Math.max(0, field.confidence)) * 100);
  const provenanceLabel = fieldReviewProvenanceLabel({
    status: field.status,
    confidence: confidencePct,
  });
  const longSnippet = (field.source_snippet ?? "").length > 140;

  return (
    <article
      ref={rowRef}
      id={`field-${field.id}`}
      role="listitem"
      data-review-focus-row={canEdit && field.status === "pending" && !editing ? "true" : undefined}
      className={`scroll-mt-28 border-l-2 px-3 py-2.5 outline-none transition-colors hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_28%,transparent)] focus-visible:bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)] sm:px-4 sm:py-3 ${rowRail}`}
      tabIndex={canEdit && field.status === "pending" && !editing ? 0 : -1}
      onKeyDown={rowKeyDown}
    >
      <div className={ROW_GRID}>
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
                  ? "Confirmed"
                  : field.status === "rejected"
                    ? "Marked unknown"
                    : "Edited"}
            </span>
          </div>
          <div className="mt-1.5">
            {confidencePct != null ? (
              <KeyValueChip label={field.source === "ai" ? "AI" : "Human"} value={`${confidencePct}%`} />
            ) : (
              <span className="ui-caps-3 text-[var(--text-tertiary)]">
                {field.source === "ai" ? "AI suggestion" : "Human entry"}
              </span>
            )}
          </div>
          {field.status !== "approved" ? (
            <p className="mt-2 max-w-sm text-[11px] leading-snug text-[var(--text-tertiary)]">
              {provenanceLabel}
            </p>
          ) : null}
        </div>

        <div className="mt-3 min-w-0 text-[var(--text-primary)] lg:mt-0">
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
                  Source required: edit to add source text, or mark this value unknown.
                </p>
              )}
              {actionError && (
                <p className="mt-2 text-xs font-medium text-[var(--danger-ink)]">{actionError}</p>
              )}
            </>
          )}
        </div>

        <div className="mt-3 min-w-0 lg:mt-0">
          {hasSnippet ? (
            <>
              <p
                className={`text-[12px] leading-snug text-[var(--text-secondary)] ${
                  snippetExpanded ? "" : "line-clamp-3"
                }`}
              >
                {field.source_snippet}
              </p>
              {longSnippet ? (
                <button
                  type="button"
                  onClick={() => setSnippetExpanded((value) => !value)}
                  className="ui-chip-focus mt-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-strong)]"
                >
                  {snippetExpanded ? "Show less" : "Show more"}
                </button>
              ) : null}
            </>
          ) : (
            <span className="text-[12px] text-[var(--text-tertiary)]">—</span>
          )}
        </div>

        {canEdit ? (
          <div className="mt-3 flex justify-start lg:mt-0 lg:justify-end">
            {field.status === "pending" && !editing ? (
              <div className="inline-flex rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] p-0.5 shadow-[var(--shadow-1)]">
                <button
                  type="button"
                  onClick={() => handleAction("approved")}
                  disabled={isPending || needsCitation}
                  className="ui-icon-button min-h-0 min-w-0 rounded-[calc(var(--radius-lg)-0.1rem)] border-transparent bg-transparent p-2 text-[var(--success-ink)] shadow-none transition-colors hover:bg-[color:color-mix(in_oklab,var(--success)_20%,transparent)] hover:text-[var(--success-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_oklab,var(--success)_55%,transparent)] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
                  title={needsCitation ? "Add a source citation by editing first" : "Confirm"}
                  aria-label={`Confirm ${fieldLabel}`}
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
