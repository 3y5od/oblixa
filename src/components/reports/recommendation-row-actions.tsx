"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AsyncActionButton } from "@/components/ui/async-action-button";
import { InlineMutationStatus } from "@/components/ui/inline-mutation-status";
import { mutateJson } from "@/lib/http/client-json";

type Props = {
  recommendationId: string;
  accepted: boolean;
  dismissed: boolean;
};

export function RecommendationRowActions({ recommendationId, accepted, dismissed }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(action: "accept" | "dismiss") {
    setBusy(true);
    setError(null);
    try {
      const result = await mutateJson(`/api/intelligence/recommendations/${recommendationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (accepted || dismissed) {
    return <span className="text-[var(--text-tertiary)]">—</span>;
  }

  return (
    <span className="flex flex-col gap-1">
      <span className="flex gap-1">
        <AsyncActionButton
          type="button"
          className="rounded-md border border-[var(--border-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_50%,var(--canvas))] disabled:opacity-50"
          pending={busy}
          pendingLabel="Saving…"
          onClick={() => void patch("accept")}
        >
          Accept
        </AsyncActionButton>
        <AsyncActionButton
          type="button"
          className="rounded-md border border-[var(--border-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_50%,var(--canvas))] disabled:opacity-50"
          pending={busy}
          pendingLabel="Saving…"
          onClick={() => void patch("dismiss")}
        >
          Dismiss
        </AsyncActionButton>
      </span>
      <InlineMutationStatus message={error} variant="error" className="text-[11px]" />
    </span>
  );
}
