"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { addManualField } from "@/actions/contracts";
import { FIELD_NAMES } from "@/lib/types";

interface AddFieldFormProps {
  contractId: string;
  existingFieldNames: string[];
  canEdit?: boolean;
}

export function AddFieldForm({
  contractId,
  existingFieldNames,
  canEdit = true,
}: AddFieldFormProps) {
  const [open, setOpen] = useState(false);
  const [fieldName, setFieldName] = useState("");
  const [fieldValue, setFieldValue] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const availableFields = FIELD_NAMES.filter(
    (f) => !existingFieldNames.includes(f)
  );

  if (!canEdit) return null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700"
      >
        <Plus size={14} />
        Add field manually
      </button>
    );
  }

  function handleSubmit() {
    if (!fieldName || !fieldValue.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await addManualField(contractId, fieldName, fieldValue.trim());
      if (result && "error" in result && result.error) {
        setError(result.error);
      } else {
        setFieldName("");
        setFieldValue("");
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-lg border border-gray-200 p-4 space-y-3">
      {error && (
        <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Field</label>
          <select
            value={fieldName}
            onChange={(e) => setFieldName(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Select field...</option>
            {availableFields.map((f) => (
              <option key={f} value={f}>
                {f.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Value</label>
          <input
            type="text"
            value={fieldValue}
            onChange={(e) => setFieldValue(e.target.value)}
            placeholder="Enter value..."
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button
          onClick={() => { setOpen(false); setError(null); }}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={isPending || !fieldName || !fieldValue.trim()}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? "Adding..." : "Add field"}
        </button>
      </div>
    </div>
  );
}
