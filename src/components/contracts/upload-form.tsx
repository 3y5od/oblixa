"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Upload, X, FileText } from "lucide-react";
import { createContract } from "@/actions/contracts";
import { formatFileSize } from "@/lib/format-file-size";

interface UploadFormProps {
  organizationId: string;
  /** When true, form cannot be submitted (e.g. subscription required). */
  disabled?: boolean;
  disabledReason?: string;
}

export function UploadForm({
  organizationId,
  disabled,
  disabledReason,
}: UploadFormProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFiles(newFiles: FileList | null) {
    if (!newFiles) return;
    const accepted = Array.from(newFiles).filter(
      (f) =>
        f.type === "application/pdf" ||
        f.type ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    setFiles((prev) => [...prev, ...accepted]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit() {
    if (disabled) return;
    const form = formRef.current;
    if (!form) return;

    const formData = new FormData(form);
    formData.delete("files");
    formData.set("organizationId", organizationId);
    for (const file of files) {
      formData.append("files", file);
    }

    setError(null);
    startTransition(async () => {
      const result = await createContract(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-6">
      {disabled && disabledReason && (
        <div className="rounded-lg border border-amber-200/70 bg-amber-50/80 px-3 py-2.5 text-sm text-amber-950">
          {disabledReason}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200/70 bg-red-50/80 px-3 py-2.5 text-sm text-red-800">
          {error}
        </div>
      )}
      <p className="text-xs text-zinc-500">
        Supported: PDF and DOCX, up to 20 MB per file. Files are validated on the server;
        unsupported types are rejected with an error.
      </p>

      <div>
        <label htmlFor="title" className="ui-label">
          Contract title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          placeholder="e.g., Acme Corp MSA 2025"
          className="ui-input mt-1"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="counterparty" className="ui-label">
            Counterparty
          </label>
          <input
            id="counterparty"
            name="counterparty"
            type="text"
            placeholder="e.g., Acme Corp"
            className="ui-input mt-1"
          />
        </div>
        <div>
          <label htmlFor="contractType" className="ui-label">
            Contract type
          </label>
          <select
            id="contractType"
            name="contractType"
            className="ui-input mt-1"
          >
            <option value="">Select type</option>
            <option value="MSA">Master Service Agreement</option>
            <option value="SOW">Statement of Work</option>
            <option value="NDA">Non-Disclosure Agreement</option>
            <option value="SaaS">SaaS Agreement</option>
            <option value="Employment">Employment Agreement</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      <div>
        <label className="ui-label">Contract files (PDF or DOCX)</label>
        <div
          className={`mt-1 flex items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/30 px-6 py-10 transition-colors ${
            disabled
              ? "cursor-not-allowed opacity-50"
              : "cursor-pointer hover:border-sky-300/80 hover:bg-sky-50/20"
          }`}
          onClick={() => !disabled && fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!disabled) handleFiles(e.dataTransfer.files);
          }}
        >
          <div className="text-center">
            <Upload className="mx-auto h-10 w-10 text-zinc-400" />
            <p className="mt-2 text-sm text-zinc-600">
              Drag and drop files here, or click to browse
            </p>
            <p className="mt-1 text-xs text-zinc-500">PDF or DOCX up to 20 MB</p>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {files.length > 0 && (
          <ul className="mt-3 space-y-2">
            {files.map((file, i) => (
              <li
                key={`${file.name}-${i}`}
                className="flex items-center justify-between rounded-lg border border-zinc-200/90 bg-white px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-zinc-400" />
                  <span className="text-sm text-zinc-700">{file.name}</span>
                  <span className="text-xs text-zinc-400">
                    ({formatFileSize(file.size)})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="text-zinc-400 hover:text-zinc-600"
                >
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Link href="/contracts" className="ui-btn-secondary px-4 py-2">
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending || disabled}
          className="ui-btn-primary px-4 py-2 disabled:opacity-50"
        >
          {isPending ? "Uploading..." : "Create contract"}
        </button>
      </div>
    </form>
  );
}
