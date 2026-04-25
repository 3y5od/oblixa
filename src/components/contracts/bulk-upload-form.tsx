"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { bulkCreateContractsFromFiles } from "@/actions/contracts";
import { describeRecoverableMutationError } from "@/lib/recoverable-mutation-error";

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
    jobId?: string | null;
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
        setResult({ type: "error", text: describeRecoverableMutationError(res.error) });
        return;
      }
      if (res && "success" in res && res.success) {
        const errPart =
          res.errors?.length
            ? ` Some files failed: ${res.errors.map(describeRecoverableMutationError).join("; ")}`
            : "";
        setResult({
          type: "success",
          text: `Created ${res.created} contract(s).${errPart}`,
          jobId: res.job_id ?? null,
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
        <label className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">
          PDF or DOCX files (one contract per file, max 20 MB each)
        </label>
        <input
          name="files"
          type="file"
          multiple
          required
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          disabled={disabled || isPending}
          className="block w-full text-sm text-[var(--text-secondary)] file:mr-3 file:rounded-lg file:border file:border-[var(--border-subtle)] file:bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] file:px-3 file:py-2 file:text-sm file:font-medium file:text-[var(--text-primary)] hover:file:border-[var(--border-strong)] hover:file:bg-surface disabled:opacity-50"
        />
        <p className="mt-2 text-xs text-[var(--text-tertiary)]">
          Each file becomes its own contract titled from the filename. Extraction runs in the
          background when OpenAI is configured.
        </p>
      </div>

      {disabledReason && (
        <p className="text-sm text-amber-800">{disabledReason}</p>
      )}

      {result && (
        <div className={`text-sm ${result.type === "error" ? "text-red-600" : "text-green-700"}`}>
          <p>{result.text}</p>
          {result.jobId && (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <a className="ui-link" href="#recent-imports">
                Review import status
              </a>
              <span className="text-[var(--text-tertiary)]">·</span>
              <a className="ui-link" href={`/api/import/contracts/${result.jobId}`}>
                Open job details JSON
              </a>
            </div>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={disabled || isPending}
        className="ui-btn-primary disabled:opacity-50"
      >
        {isPending ? "Importing…" : "Import contracts"}
      </button>
    </form>
  );
}
