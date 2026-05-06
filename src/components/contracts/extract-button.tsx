"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";
import { runExtraction } from "@/actions/contracts";
import { isExtractionActivelyBlocking } from "@/lib/extraction/constants";
import { describeRecoverableMutationError } from "@/lib/recoverable-mutation-error";
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
  /** Blocks double-clicks before `isPending` flips (same-tick duplicate requests). */
  const [requestLock, setRequestLock] = useState(false);

  const router = useRouter();

  if (!canEdit || !hasFiles) return null;

  const extractionQueued = extractionJob?.status === "pending";
  const extractionProcessing =
    extractionJob?.status === "processing" &&
    isExtractionActivelyBlocking(extractionJob.started_at);
  const extractionInFlight = extractionQueued || extractionProcessing;

  function handleExtract() {
    if (requestLock || extractionInFlight) return;
    setRequestLock(true);
    setResult(null);
    startTransition(async () => {
      try {
        const res = await runExtraction(contractId);
        if ("error" in res && res.error) {
          setResult({ message: describeRecoverableMutationError(res.error), type: "error" });
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
      } finally {
        setRequestLock(false);
      }
    });
  }

  return (
    <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-start">
      <button
        type="button"
        onClick={handleExtract}
        disabled={isPending || extractionInFlight || requestLock}
        aria-busy={isPending || requestLock}
        title={
          extractionInFlight
            ? "An extraction is already queued or running. Wait or refresh the page."
            : undefined
        }
        className="ui-btn-primary w-full whitespace-nowrap px-3 py-2 text-sm disabled:pointer-events-none disabled:opacity-45 sm:w-auto"
      >
        {isPending ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Extracting...
          </>
        ) : extractionQueued ? (
          <>
            <Sparkles size={14} />
            Extraction queued
          </>
        ) : extractionProcessing ? (
          <>
            <Sparkles size={14} />
            Extraction running
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
          className={`max-w-sm text-xs leading-snug ${
            result.type === "error" ? "ui-alert-error" : "ui-alert-success"
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
