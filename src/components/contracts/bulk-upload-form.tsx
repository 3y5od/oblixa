"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { bulkCreateContractsFromFiles } from "@/actions/contracts";

interface BulkUploadFormProps {
  organizationId: string;
  disabled?: boolean;
  disabledReason?: string;
}

export function BulkUploadForm({
  organizationId,
  disabled,
  disabledReason,
}: BulkUploadFormProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const router = useRouter();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (disabled || isPending) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.append("organizationId", organizationId);
    setResult(null);
    startTransition(async () => {
      const res = await bulkCreateContractsFromFiles(fd);
      if (res && "error" in res && res.error) {
        setResult({ type: "error", text: res.error });
        return;
      }
      if (res && "success" in res && res.success) {
        const errPart =
          res.errors?.length ? ` Some files failed: ${res.errors.join("; ")}` : "";
        setResult({
          type: "success",
          text: `Created ${res.created} contract(s).${errPart}`,
        });
        form.reset();
        router.refresh();
      } else {
        setResult({ type: "error", text: "Nothing was imported." });
      }
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          PDF or DOCX files (one contract per file, max 20 MB each)
        </label>
        <input
          name="files"
          type="file"
          multiple
          required
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          disabled={disabled || isPending}
          className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
        />
        <p className="mt-2 text-xs text-gray-500">
          Each file becomes its own contract titled from the filename. Extraction runs in the
          background when OpenAI is configured.
        </p>
      </div>

      {disabledReason && (
        <p className="text-sm text-amber-800">{disabledReason}</p>
      )}

      {result && (
        <p
          className={`text-sm ${result.type === "error" ? "text-red-600" : "text-green-700"}`}
        >
          {result.text}
        </p>
      )}

      <button
        type="submit"
        disabled={disabled || isPending}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isPending ? "Importing…" : "Import contracts"}
      </button>
    </form>
  );
}
