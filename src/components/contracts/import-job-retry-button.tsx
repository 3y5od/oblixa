"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { interpretHttpMutationFailure } from "@/lib/v9-api-client-errors";

export function ImportJobRetryButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={isPending}
        className="ui-btn-secondary px-2.5 py-1 text-[11px] disabled:opacity-60"
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            const response = await fetch(`/api/import/contracts/${jobId}`, { method: "POST" });
            const payload = (await response.json().catch(() => null)) as
              | { error?: string; jobId?: string }
              | null;
            if (!response.ok) {
              const mapped = interpretHttpMutationFailure({
                status: response.status,
                message: payload?.error ?? null,
              });
              setMessage(mapped.userMessage);
              return;
            }
            setMessage("Retry started.");
            router.refresh();
          });
        }}
      >
        {isPending ? "Retrying..." : "Retry failed rows"}
      </button>
      {message ? (
        <span
          className={`text-[11px] ${message === "Retry started." ? "text-emerald-700" : "text-amber-700"}`}
          role="status"
        >
          {message}
        </span>
      ) : null}
    </div>
  );
}
