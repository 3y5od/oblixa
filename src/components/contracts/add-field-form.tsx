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
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-dashed border-zinc-200 px-3 py-2 text-sm text-zinc-500 transition-colors hover:border-zinc-300 hover:bg-zinc-50/50 hover:text-zinc-700"
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
    <div className="space-y-3 rounded-xl border border-zinc-200/90 bg-zinc-50/30 p-4">
      {error && (
        <div className="rounded-lg border border-red-200/70 bg-red-50/80 p-2 text-sm text-red-800">
          {error}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">Field</label>
          <select
            value={fieldName}
            onChange={(e) => setFieldName(e.target.value)}
            className="ui-input py-1.5"
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
          <label className="block text-xs font-medium text-zinc-600 mb-1">Value</label>
          <input
            type="text"
            value={fieldValue}
            onChange={(e) => setFieldValue(e.target.value)}
            placeholder="Enter value..."
            className="ui-input py-1.5"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="ui-btn-secondary py-1.5"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || !fieldName || !fieldValue.trim()}
          className="ui-btn-primary py-1.5 disabled:opacity-50"
        >
          {isPending ? "Adding..." : "Add field"}
        </button>
      </div>
    </div>
  );
}
