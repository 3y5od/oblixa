"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";
import { runExtraction } from "@/actions/contracts";
import { isExtractionActivelyBlocking } from "@/lib/extraction/constants";
import type { ContractExtractionJob } from "@/lib/types";

interface ExtractButtonProps {
  contractId: string;
  hasFiles: boolean;
  canEdit?: boolean;
  extractionJob?: ContractExtractionJob | null;
}

export function ExtractButton({
  contractId,
  hasFiles,
  canEdit = true,
  extractionJob = null,
}: ExtractButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const router = useRouter();

  if (!canEdit || !hasFiles) return null;

  const extractionInFlight =
    extractionJob?.status === "processing" &&
    isExtractionActivelyBlocking(extractionJob.started_at);

  function handleExtract() {
    setResult(null);
    startTransition(async () => {
      const res = await runExtraction(contractId);
      if ("error" in res && res.error) {
        setResult({ message: res.error, type: "error" });
      } else if ("success" in res && res.success) {
        if ("async" in res && res.async) {
          setResult({
            message:
              "Extraction started. This page will refresh while the run completes.",
            type: "success",
          });
          router.refresh();
          return;
        }
        const ins = res.inserted ?? 0;
        const total = res.extracted ?? 0;
        const chars = res.textChars;
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
        if (typeof chars === "number" && chars > 0) {
          message += ` Analyzed ${chars.toLocaleString()} characters of text.`;
        }
        setResult({ message, type: "success" });
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleExtract}
        disabled={isPending || extractionInFlight}
        title={
          extractionInFlight
            ? "An extraction is already running. Wait or refresh the page."
            : undefined
        }
        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-violet-400/30 bg-violet-950 px-3 py-2 text-sm font-medium text-white transition-[background-color,border-color] hover:border-violet-400/50 hover:bg-violet-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/25 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45"
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
          role={result.type === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {result.message}
        </p>
      )}
    </div>
  );
}
