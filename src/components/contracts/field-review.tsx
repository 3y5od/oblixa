"use client";

import { useState, useTransition } from "react";
import { Check, X, Pencil } from "lucide-react";
import { updateContractField } from "@/actions/contracts";
import type { ExtractedField } from "@/lib/types";

const statusStyles: Record<string, string> = {
  pending: "border-amber-200 bg-amber-50",
  approved: "border-green-200 bg-green-50",
  rejected: "border-red-200 bg-red-50",
  edited: "border-blue-200 bg-blue-50",
};

const statusBadge: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  edited: "bg-blue-100 text-blue-700",
};

interface FieldReviewProps {
  fields: ExtractedField[];
}

export function FieldReview({ fields }: FieldReviewProps) {
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
    <div className="space-y-3">
      {fields.map((field) => (
        <FieldRow key={field.id} field={field} />
      ))}
    </div>
  );
}

function FieldRow({ field }: { field: ExtractedField }) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(field.field_value || "");
  const [isPending, startTransition] = useTransition();
  const [currentField, setCurrentField] = useState(field);

  function handleAction(action: "approved" | "rejected" | "edited", newValue?: string) {
    startTransition(async () => {
      const result = await updateContractField(currentField.id, action, newValue);
      if (!result?.error) {
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

  return (
    <div
      className={`rounded-lg border p-4 ${statusStyles[currentField.status] || "border-gray-200"}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-900">
              {currentField.field_name.replace(/_/g, " ")}
            </p>
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                statusBadge[currentField.status]
              }`}
            >
              {currentField.status}
            </span>
            <span className="text-xs text-gray-400">
              {currentField.source === "ai" ? "AI-extracted" : "Human-entered"}
            </span>
          </div>

          {editing ? (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={() => handleAction("edited", editValue)}
                disabled={isPending}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => setEditing(false)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <p className="mt-1 text-sm text-gray-700">
              {currentField.field_value || (
                <span className="italic text-gray-400">Unknown</span>
              )}
            </p>
          )}

          {currentField.source_snippet && (
            <div className="mt-2 rounded bg-white/50 px-3 py-2">
              <p className="text-xs font-medium text-gray-500">Source</p>
              <p className="mt-0.5 text-xs text-gray-600 italic">
                &ldquo;{currentField.source_snippet}&rdquo;
              </p>
            </div>
          )}
        </div>

        {currentField.status === "pending" && !editing && (
          <div className="ml-4 flex items-center gap-1">
            <button
              onClick={() => handleAction("approved")}
              disabled={isPending}
              className="rounded p-1.5 text-green-600 hover:bg-green-100 disabled:opacity-50"
              title="Approve"
            >
              <Check size={16} />
            </button>
            <button
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
              onClick={() => handleAction("rejected")}
              disabled={isPending}
              className="rounded p-1.5 text-red-600 hover:bg-red-100 disabled:opacity-50"
              title="Reject"
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
