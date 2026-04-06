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
        <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          {disabledReason}
        </div>
      )}
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <p className="text-xs text-gray-500">
        Supported: PDF and DOCX, up to 20 MB per file. Files are validated on the server;
        unsupported types are rejected with an error.
      </p>

      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700">
          Contract title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          placeholder="e.g., Acme Corp MSA 2025"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="counterparty" className="block text-sm font-medium text-gray-700">
            Counterparty
          </label>
          <input
            id="counterparty"
            name="counterparty"
            type="text"
            placeholder="e.g., Acme Corp"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="contractType" className="block text-sm font-medium text-gray-700">
            Contract type
          </label>
          <select
            id="contractType"
            name="contractType"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
        <label className="block text-sm font-medium text-gray-700">
          Contract files (PDF or DOCX)
        </label>
        <div
          className={`mt-1 flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 px-6 py-10 ${
            disabled
              ? "cursor-not-allowed opacity-50"
              : "cursor-pointer hover:border-blue-400"
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
            <Upload className="mx-auto h-10 w-10 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">
              Drag and drop files here, or click to browse
            </p>
            <p className="mt-1 text-xs text-gray-500">PDF or DOCX up to 20 MB</p>
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
                className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-700">{file.name}</span>
                  <span className="text-xs text-gray-400">
                    ({formatFileSize(file.size)})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex justify-end gap-3">
        <Link
          href="/contracts"
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending || disabled}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? "Uploading..." : "Create contract"}
        </button>
      </div>
    </form>
  );
}
