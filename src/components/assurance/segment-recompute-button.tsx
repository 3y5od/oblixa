"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AsyncActionButton } from "@/components/ui/async-action-button";
import { InlineMutationStatus } from "@/components/ui/inline-mutation-status";
import { mutateJson } from "@/lib/http/client-json";

export function SegmentRecomputeButton({ segmentId }: { segmentId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onRecompute() {
    setPending(true);
    setErr(null);
    try {
      const result = await mutateJson(`/api/segments/${encodeURIComponent(segmentId)}/recompute`, {
        method: "POST",
      });
      if (!result.ok) {
        setErr(result.message || "Recompute failed");
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-2">
      <AsyncActionButton
        type="button"
        className="rounded border border-[var(--border-strong)] px-2 py-1 text-xs text-[var(--text-primary)] disabled:opacity-50"
        pending={pending}
        pendingLabel="Recomputing…"
        onClick={() => void onRecompute()}
      >
        Recompute memberships
      </AsyncActionButton>
      <InlineMutationStatus message={err} variant="error" className="mt-1 text-xs" />
    </div>
  );
}
