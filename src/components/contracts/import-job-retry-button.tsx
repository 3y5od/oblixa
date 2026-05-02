"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { mutateV10 } from "@/lib/v10-api-client";

// mutateV10 centralizes interpretHttpMutationFailure for HTTP, rate-limit, and network copy.
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
            const result = await mutateV10({ url: `/api/import/contracts/${jobId}` });
            if (!result.ok) {
              setMessage(result.userMessage);
              return;
            }
            setMessage(result.response.user_visible_message || "Retry started.");
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
