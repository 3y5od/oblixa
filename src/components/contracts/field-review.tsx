"use client";

import {
  memo,
  useState,
  useTransition,
  useRef,
  type KeyboardEvent,
} from "react";
import { Check, X, Pencil } from "lucide-react";
import { updateContractField } from "@/actions/contracts";
import type { ExtractedField } from "@/lib/types";
import { EmptyState } from "@/components/ui/empty-state";

const statusBadge: Record<string, string> = {
  pending: "border border-amber-200/70 bg-amber-50/90 text-amber-950",
  approved: "border border-emerald-200/60 bg-emerald-50/80 text-emerald-900",
  rejected: "border border-red-200/60 bg-red-50/80 text-red-900",
  edited: "border border-indigo-200/50 bg-indigo-50/70 text-indigo-950",
};

function confidenceLabel(c: number | null): string {
  if (c == null || Number.isNaN(c)) return "—";
  const pct = Math.round(Math.min(1, Math.max(0, c)) * 100);
  return `${pct}%`;
}

function confidenceTone(c: number | null): string {
  if (c == null) return "text-zinc-400";
  if (c >= 0.75) return "text-emerald-700";
  if (c >= 0.45) return "text-amber-700";
  return "text-rose-700";
}

interface FieldReviewProps {
  fields: ExtractedField[];
  /** When false, hide approve/edit/reject (viewer role). */
  canEdit?: boolean;
}

export function FieldReview({ fields, canEdit = true }: FieldReviewProps) {
  if (fields.length === 0) {
    return (
      <EmptyState
        title="No extracted fields"
        copy="Run Extract fields with AI after upload. Use text-based PDF or DOCX."
      />
    );
  }

  const hasPending = fields.some((f) => f.status === "pending");

  return (
    <div className="space-y-4">
      {canEdit && hasPending && (
        <div className="ui-toolbar">
          <span className="font-semibold text-zinc-700">Shortcuts</span>
          <span className="hidden sm:inline text-zinc-300">·</span>
          <span>
            <kbd className="ui-kbd">A</kbd> approve · <kbd className="ui-kbd">R</kbd> reject ·{" "}
            <kbd className="ui-kbd">E</kbd> edit · <kbd className="ui-kbd">Esc</kbd> cancel
          </span>
        </div>
      )}
      <div className="ui-table-shell">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-[13px]">
            <caption className="sr-only">
              Extracted contract fields — approve, reject, or edit pending rows
            </caption>
            <thead>
              <tr className="border-b border-zinc-200/80 bg-zinc-50/90">
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
              {fields.map((field) => (
                <FieldRow key={field.id} field={field} canEdit={canEdit} />
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
}: {
  field: ExtractedField;
  canEdit: boolean;
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
        setActionError(result.error);
        return;
      }
      if (result && "success" in result && result.success) {
        const wasPending = currentField.status === "pending";
        setCurrentField((prev) => ({
          ...prev,
          status: action,
          ...(action === "edited" && newValue !== undefined
            ? { field_value: newValue, source: "human" as const }
            : {}),
        }));
        setEditing(false);
        if (wasPending && (action === "approved" || action === "rejected" || action === "edited")) {
          focusNextPendingRow(rowRef.current);
        }
      }
    });
  }

  const rowBg =
    currentField.status === "pending"
      ? "bg-amber-50/25"
      : currentField.status === "approved"
        ? "bg-emerald-50/15"
        : currentField.status === "rejected"
          ? "bg-rose-50/20"
          : "bg-indigo-50/15";

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
      className={`scroll-mt-28 outline-none transition-colors focus-visible:bg-zinc-50/80 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/20 ${rowBg}`}
      tabIndex={canEdit && currentField.status === "pending" && !editing ? 0 : -1}
      onKeyDown={rowKeyDown}
    >
      <td className="whitespace-nowrap px-4 py-4 align-top first:pl-6">
        <p className="font-semibold capitalize text-zinc-900">{fieldLabel}</p>
        <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
          {currentField.source === "ai" ? "AI extraction" : "Human entry"}
        </p>
      </td>
      <td className="max-w-[min(280px,32vw)] px-4 py-4 align-top text-zinc-800">
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
            {actionError && <p className="text-xs font-medium text-red-700">{actionError}</p>}
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
                <span className="font-normal italic text-zinc-400">Unknown</span>
              )}
            </span>
            {needsCitation && (
              <p className="mt-2 rounded-lg border border-amber-200/60 bg-amber-50/50 px-2.5 py-2 text-[11px] leading-snug text-amber-950">
                Citation required: edit to add source text, or reject this extraction.
              </p>
            )}
            {actionError && (
              <p className="mt-2 text-xs font-medium text-red-700">{actionError}</p>
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
      </td>
      <td className="max-w-[min(320px,40vw)] px-4 py-4 align-top">
        {currentField.source_snippet ? (
          <blockquote className="ui-source-quote rounded-r-lg text-[13px] leading-snug">
            <span className="italic text-zinc-700">
              &ldquo;{currentField.source_snippet}&rdquo;
            </span>
          </blockquote>
        ) : (
          <span className="text-[13px] text-zinc-400">—</span>
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
            <div className="inline-flex rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() => handleAction("approved")}
                disabled={isPending || needsCitation}
                className="rounded-lg p-2 text-emerald-700 transition-colors hover:bg-surface hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-35"
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
                className="rounded-lg p-2 text-[var(--accent)] transition-colors hover:bg-surface hover:shadow-sm disabled:opacity-50"
                title="Edit"
                aria-label={`Edit ${fieldLabel}`}
              >
                <Pencil size={17} strokeWidth={1.75} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => handleAction("rejected")}
                disabled={isPending}
                className="rounded-lg p-2 text-rose-700 transition-colors hover:bg-surface hover:shadow-sm disabled:opacity-50"
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
