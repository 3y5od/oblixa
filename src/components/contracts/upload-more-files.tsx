"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { uploadAdditionalFiles } from "@/actions/contracts";

interface UploadMoreFilesProps {
  contractId: string;
  canEdit?: boolean;
}

export function UploadMoreFiles({ contractId, canEdit = true }: UploadMoreFilesProps) {
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
        setResult({ message: res.error, type: "error" });
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
    <div className="mt-3 space-y-2">
      <button
        onClick={() => inputRef.current?.click()}
        disabled={isPending}
        className="flex items-center gap-1.5 rounded-lg border border-dashed border-zinc-200 px-3 py-2 text-sm text-zinc-500 transition-colors hover:border-zinc-300 hover:bg-zinc-50/50 hover:text-zinc-700 disabled:opacity-50"
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
        <p className={`text-xs ${result.type === "error" ? "text-red-600" : "text-green-600"}`}>
          {result.message}
        </p>
      )}
    </div>
  );
}
