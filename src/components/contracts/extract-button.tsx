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
  const [result, setResult] = useState<{
    message: string;
    type: "success" | "error" | "warning";
  } | null>(null);

  const router = useRouter();

  if (!canEdit || !hasFiles) return null;

  function handleExtract() {
    setResult(null);
    startTransition(async () => {
      const res = await runExtraction(contractId);
      if ("error" in res && res.error) {
        setResult({ message: res.error, type: "error" });
      } else if ("success" in res && res.success) {
        let type: "success" | "warning" = "success";
        let message: string;

        if (res.inserted > 0) {
          message = `Added ${res.inserted} new field${res.inserted === 1 ? "" : "s"}`;
          if (res.skippedExisting > 0) {
            message += ` (${res.skippedExisting} already on this contract)`;
          }
        } else if (res.extracted > 0) {
          message = `All ${res.extracted} returned field${res.extracted === 1 ? "" : "s"} already exist on this contract.`;
        } else {
          message = "No fields were added.";
        }

        if (res.warning) {
          message = `${message} ${res.warning}`;
          type = "warning";
        }

        setResult({ message: message.trim(), type });
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleExtract}
        disabled={isPending}
        className="flex items-center gap-1.5 rounded-md bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
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
            result.type === "error"
              ? "text-red-600"
              : result.type === "warning"
                ? "text-amber-800"
                : "text-green-600"
          }`}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}
