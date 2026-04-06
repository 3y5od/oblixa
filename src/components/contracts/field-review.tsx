"use client";

import { useState, useTransition, type KeyboardEvent } from "react";
import { Check, X, Pencil } from "lucide-react";
import { updateContractField } from "@/actions/contracts";
import type { ExtractedField } from "@/lib/types";

const statusBadge: Record<string, string> = {
  pending: "border border-amber-200/70 bg-amber-50/90 text-amber-900",
  approved: "border border-emerald-200/70 bg-emerald-50/90 text-emerald-900",
  rejected: "border border-red-200/70 bg-red-50/90 text-red-800",
  edited: "border border-sky-200/70 bg-sky-50/90 text-sky-900",
};

function confidenceLabel(c: number | null): string {
  if (c == null || Number.isNaN(c)) return "—";
  const pct = Math.round(Math.min(1, Math.max(0, c)) * 100);
  return `${pct}%`;
}

function confidenceTone(c: number | null): string {
  if (c == null) return "text-zinc-400";
  if (c >= 0.75) return "text-emerald-800";
  if (c >= 0.45) return "text-amber-700";
  return "text-red-700";
}

interface FieldReviewProps {
  fields: ExtractedField[];
  /** When false, hide approve/edit/reject (viewer role). */
  canEdit?: boolean;
}

export function FieldReview({ fields, canEdit = true }: FieldReviewProps) {
  if (fields.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-200/90 bg-zinc-50/20 p-8 text-center">
        <p className="text-sm text-zinc-500">
          No extracted fields yet. Fields will appear after the document is processed.
        </p>
      </div>
    );
  }

  const hasPending = fields.some((f) => f.status === "pending");

  return (
    <div className="space-y-2">
      {canEdit && hasPending && (
        <p className="text-xs text-zinc-500">
          <span className="font-medium text-zinc-700">Keyboard:</span> Focus a
          pending row (Tab), then{" "}
          <kbd className="rounded border border-zinc-300 bg-zinc-50 px-1 font-mono text-[0.7rem]">
            A
          </kbd>{" "}
          approve,{" "}
          <kbd className="rounded border border-zinc-300 bg-zinc-50 px-1 font-mono text-[0.7rem]">
            R
          </kbd>{" "}
          reject,{" "}
          <kbd className="rounded border border-zinc-300 bg-zinc-50 px-1 font-mono text-[0.7rem]">
            E
          </kbd>{" "}
          edit. Disabled while typing in an input.
        </p>
      )}
      <div className="overflow-x-auto rounded-xl border border-zinc-200/85 bg-surface">
      <table className="min-w-full divide-y divide-zinc-200/80 text-sm">
        <thead>
          <tr>
            <th className="ui-table-header px-4 py-3">Field</th>
            <th className="ui-table-header px-4 py-3">Value</th>
            <th className="ui-table-header px-4 py-3">Confidence</th>
            <th className="ui-table-header px-4 py-3">Source</th>
            <th className="ui-table-header px-4 py-3">Status</th>
            {canEdit && (
              <th className="ui-table-header px-4 py-3 text-right">Actions</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200/60 bg-surface">
          {fields.map((field) => (
            <FieldRow key={field.id} field={field} canEdit={canEdit} />
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function FieldRow({ field, canEdit }: { field: ExtractedField; canEdit: boolean }) {
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
        setCurrentField((prev) => ({
          ...prev,
          status: action,
          ...(action === "edited" && newValue !== undefined
            ? { field_value: newValue, source: "human" as const }
            : {}),
        }));
        setEditing(false);
      }
    });
  }

  const rowBg =
    currentField.status === "pending"
      ? "bg-amber-50/40"
      : currentField.status === "approved"
        ? "bg-green-50/30"
        : currentField.status === "rejected"
          ? "bg-red-50/30"
          : "bg-sky-50/35";

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

  return (
    <tr
      id={`field-${currentField.id}`}
      className={`scroll-mt-24 outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30 focus-visible:ring-offset-2 ${rowBg}`}
      tabIndex={canEdit && currentField.status === "pending" && !editing ? 0 : -1}
      onKeyDown={rowKeyDown}
    >
      <td className="whitespace-nowrap px-3 py-3 align-top font-medium text-zinc-900">
        {currentField.field_name.replace(/_/g, " ")}
        <div className="mt-0.5 text-xs font-normal text-zinc-400">
          {currentField.source === "ai" ? "AI" : "Human"}
        </div>
      </td>
      <td className="max-w-[220px] px-3 py-3 align-top text-zinc-800">
        {editing ? (
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="ui-input py-1.5 text-sm"
            />
            {actionError && (
              <p className="text-xs text-red-600">{actionError}</p>
            )}
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleAction("edited", editValue)}
                disabled={isPending}
                className="ui-btn-primary px-2.5 py-1 text-xs disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="ui-btn-secondary px-2.5 py-1 text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            {currentField.field_value || (
              <span className="italic text-zinc-400">Unknown</span>
            )}
            {needsCitation && (
              <p className="mt-1 text-xs text-amber-800">
                Add a source by saving an edit (marks the value as human-verified), or reject
                this AI extraction.
              </p>
            )}
            {actionError && (
              <p className="mt-1 text-xs text-red-600">{actionError}</p>
            )}
          </>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-3 align-top">
        <span
          className={`text-xs font-medium ${confidenceTone(currentField.confidence)}`}
          title="Model-reported certainty (0–100%)"
        >
          {confidenceLabel(currentField.confidence)}
        </span>
      </td>
      <td className="max-w-[280px] px-3 py-3 align-top text-xs text-zinc-600">
        {currentField.source_snippet ? (
          <span className="italic">&ldquo;{currentField.source_snippet}&rdquo;</span>
        ) : (
          <span className="text-zinc-400">—</span>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-3 align-top">
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
            statusBadge[currentField.status]
          }`}
        >
          {currentField.status}
        </span>
      </td>
      {canEdit && (
        <td className="whitespace-nowrap px-3 py-3 align-top text-right">
          {currentField.status === "pending" && !editing && (
            <div className="flex justify-end gap-0.5">
              <button
                type="button"
                onClick={() => handleAction("approved")}
                disabled={isPending || needsCitation}
                className="rounded-lg p-1.5 text-emerald-700 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
                title={
                  needsCitation
                    ? "Add a source citation by editing the field first"
                    : "Approve"
                }
              >
                <Check size={16} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(true);
                  setEditValue(currentField.field_value || "");
                }}
                disabled={isPending}
                className="rounded-lg p-1.5 text-sky-700 transition-colors hover:bg-sky-50 disabled:opacity-50"
                title="Edit"
              >
                <Pencil size={16} strokeWidth={1.75} />
              </button>
              <button
                type="button"
                onClick={() => handleAction("rejected")}
                disabled={isPending}
                className="rounded-lg p-1.5 text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
                title="Reject"
              >
                <X size={16} />
              </button>
            </div>
          )}
        </td>
      )}
    </tr>
  );
}
