"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { mutateV10 } from "@/lib/api-client";

// mutateV10 centralizes interpretHttpMutationFailure for HTTP, rate-limit, and network copy.
export function V10JobRetryButton({
  url,
  label,
  successFallbackMessage = "Retry started.",
  testId,
}: {
  url: string;
  label: string;
  successFallbackMessage?: string;
  testId?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const successMessage = message === successFallbackMessage;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        data-testid={testId}
        disabled={isPending}
        className="ui-btn-secondary px-2.5 py-1 text-[11px] disabled:opacity-60"
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            const result = await mutateV10({ url });
            if (!result.ok) {
              setMessage(result.userMessage);
              return;
            }
            setMessage(result.response.user_visible_message || successFallbackMessage);
            router.refresh();
          });
        }}
      >
        {isPending ? "Retrying..." : label}
      </button>
      {message ? (
        <span
          className={`text-[11px] ${successMessage ? "ui-alert-success" : "ui-alert-warning"}`}
          role="status"
        >
          {message}
        </span>
      ) : null}
    </div>
  );
}

export function ImportJobRetryButton({ jobId }: { jobId: string }) {
  return (
    <V10JobRetryButton
      url={`/api/import/contracts/${jobId}`}
      label="Retry failed rows"
      successFallbackMessage="Retry started."
      testId="import-retry"
    />
  );
}

// Version-name compatibility aliases. Prefer neutral exports in new code.
export { V10JobRetryButton as JobRetryButton };
// End version-name compatibility aliases.
