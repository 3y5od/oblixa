"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";
import { runExtraction } from "@/actions/contracts";

interface ExtractButtonProps {
  contractId: string;
  hasFiles: boolean;
  canEdit?: boolean;
}

export function ExtractButton({
  contractId,
  hasFiles,
  canEdit = true,
}: ExtractButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const router = useRouter();

  if (!canEdit || !hasFiles) return null;

  function handleExtract() {
    setResult(null);
    startTransition(async () => {
      const res = await runExtraction(contractId);
      if ("error" in res && res.error) {
        setResult({ message: res.error, type: "error" });
      } else if ("success" in res && res.success) {
        const ins = res.inserted ?? 0;
        const total = res.extracted ?? 0;
        let message: string;
        if (ins > 0) {
          message =
            ins === total
              ? `Added ${ins} field${ins === 1 ? "" : "s"} from the document.`
              : `Added ${ins} new field${ins === 1 ? "" : "s"} (${total} parsed).`;
        } else {
          message =
            total > 0
              ? "All fields were already present; nothing new to add. Delete a field to re-extract it."
              : "Extraction finished.";
        }
        setResult({ message, type: "success" });
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleExtract}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-violet-400/30 bg-violet-950 px-3 py-2 text-sm font-medium text-white transition-colors hover:border-violet-400/50 hover:bg-violet-900 disabled:opacity-50"
      >
        {isPending ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Extracting...
          </>
        ) : (
          <>
            <Sparkles size={14} />
            Extract fields with AI
          </>
        )}
      </button>
      {result && (
        <p
          className={`text-sm ${
            result.type === "error" ? "text-red-700" : "text-emerald-800"
          }`}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}
