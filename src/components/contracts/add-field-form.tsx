"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { addManualField } from "@/actions/contracts";
import { describeRecoverableMutationError } from "@/lib/recoverable-mutation-error";
import { FIELD_NAMES } from "@/lib/types";
import { FormSelect } from "@/components/ui/form-select";

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
        className="inline-flex max-w-max items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2.5 py-1 text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
      >
        <Plus size={12} strokeWidth={2.2} />
        Add detail
      </button>
    );
  }

  function handleSubmit() {
    if (!fieldName || !fieldValue.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await addManualField(contractId, fieldName, fieldValue.trim());
      if (result && "error" in result && result.error) {
        setError(describeRecoverableMutationError(result.error));
      } else {
        setFieldName("");
        setFieldValue("");
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))]/30 p-4">
      {error && (
        <div className="ui-alert-error text-sm" role="alert">
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormSelect
          className="min-w-0"
          label="Detail"
          value={fieldName}
          onChange={setFieldName}
          placeholder="Select a detail..."
          searchThreshold={8}
          options={availableFields.map((f) => ({
            value: f,
            label: f.replace(/_/g, " "),
          }))}
        />
        <div className="flex min-w-0 flex-col gap-1.5">
          <label
            htmlFor="add-field-value"
            className="text-[12.5px] font-medium leading-none text-[var(--text-secondary)]"
          >
            Value
          </label>
          <input
            id="add-field-value"
            type="text"
            value={fieldValue}
            onChange={(e) => setFieldValue(e.target.value)}
            placeholder="Enter value..."
            className="ui-input-compact w-full min-w-0"
          />
        </div>
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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
          {isPending ? "Adding..." : "Add detail"}
        </button>
      </div>
    </div>
  );
}
