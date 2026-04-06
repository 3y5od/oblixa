"use client";

import { useState, useTransition } from "react";
import { Check, X, Pencil } from "lucide-react";
import { updateContractField } from "@/actions/contracts";
import type { ExtractedField } from "@/lib/types";

const statusBadge: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  edited: "bg-blue-100 text-blue-700",
};

function confidenceLabel(c: number | null): string {
  if (c == null || Number.isNaN(c)) return "—";
  const pct = Math.round(Math.min(1, Math.max(0, c)) * 100);
  return `${pct}%`;
}

function confidenceTone(c: number | null): string {
  if (c == null) return "text-gray-400";
  if (c >= 0.75) return "text-green-700";
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
      <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center">
        <p className="text-sm text-gray-500">
          No extracted fields yet. Fields will appear after the document is processed.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              Field
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              Value
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              Confidence
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              Source
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              Status
            </th>
            {canEdit && (
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {fields.map((field) => (
            <FieldRow key={field.id} field={field} canEdit={canEdit} />
          ))}
        </tbody>
      </table>
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
          : "bg-blue-50/30";

  return (
    <tr id={`field-${currentField.id}`} className={`scroll-mt-24 ${rowBg}`}>
      <td className="whitespace-nowrap px-3 py-3 align-top font-medium text-gray-900">
        {currentField.field_name.replace(/_/g, " ")}
        <div className="mt-0.5 text-xs font-normal text-gray-400">
          {currentField.source === "ai" ? "AI" : "Human"}
        </div>
      </td>
      <td className="max-w-[220px] px-3 py-3 align-top text-gray-800">
        {editing ? (
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {actionError && (
              <p className="text-xs text-red-600">{actionError}</p>
            )}
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => handleAction("edited", editValue)}
                disabled={isPending}
                className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            {currentField.field_value || (
              <span className="italic text-gray-400">Unknown</span>
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
      <td className="max-w-[280px] px-3 py-3 align-top text-xs text-gray-600">
        {currentField.source_snippet ? (
          <span className="italic">&ldquo;{currentField.source_snippet}&rdquo;</span>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-3 align-top">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
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
                className="rounded p-1.5 text-green-600 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-40"
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
                className="rounded p-1.5 text-blue-600 hover:bg-blue-100 disabled:opacity-50"
                title="Edit"
              >
                <Pencil size={16} />
              </button>
              <button
                type="button"
                onClick={() => handleAction("rejected")}
                disabled={isPending}
                className="rounded p-1.5 text-red-600 hover:bg-red-100 disabled:opacity-50"
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
