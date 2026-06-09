"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { uploadAdditionalFiles } from "@/actions/contracts";
import { describeRecoverableMutationError } from "@/lib/recoverable-mutation-error";

interface UploadMoreFilesProps {
  contractId: string;
  canEdit?: boolean;
  className?: string;
}

export function UploadMoreFiles({ contractId, canEdit = true, className = "mt-3" }: UploadMoreFilesProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  if (!canEdit) return null;

  function handleFiles(fileList: FileList | null) {
    if (!fileList?.length) return;

    const formData = new FormData();
    for (const file of Array.from(fileList)) {
      formData.append("files", file);
    }

    setResult(null);
    startTransition(async () => {
      const res = await uploadAdditionalFiles(contractId, formData);
      if (res && "error" in res && res.error) {
        setResult({ message: describeRecoverableMutationError(res.error), type: "error" });
      } else if (res && "uploaded" in res) {
        setResult({
          message: `Uploaded ${res.uploaded} file${res.uploaded === 1 ? "" : "s"}.`,
          type: "success",
        });
        router.refresh();
      }
    });

    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className={`${className} space-y-2`.trim()}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isPending}
        className="ui-btn-secondary inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] disabled:opacity-50"
      >
        {isPending ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <Plus size={14} />
            Add files
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {result && (
        <p
          className={`text-xs ${result.type === "error" ? "ui-alert-error" : "ui-alert-success"}`}
          role={result.type === "error" ? "alert" : "status"}
          aria-live={result.type === "error" ? "assertive" : "polite"}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}
