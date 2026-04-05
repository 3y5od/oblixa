"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";
import { runExtraction } from "@/actions/contracts";

interface ExtractButtonProps {
  contractId: string;
  hasFiles: boolean;
}

export function ExtractButton({ contractId, hasFiles }: ExtractButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const router = useRouter();

  if (!hasFiles) return null;

  function handleExtract() {
    setResult(null);
    startTransition(async () => {
      const res = await runExtraction(contractId);
      if (res.error) {
        setResult({ message: res.error, type: "error" });
      } else {
        setResult({
          message: `Extracted ${res.extracted} fields.`,
          type: "success",
        });
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
            result.type === "error" ? "text-red-600" : "text-green-600"
          }`}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}
