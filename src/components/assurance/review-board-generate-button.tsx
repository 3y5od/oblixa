"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AsyncActionButton } from "@/components/ui/async-action-button";
import { InlineMutationStatus } from "@/components/ui/inline-mutation-status";
import { mutateJson } from "@/lib/http/client-json";

export function ReviewBoardGenerateButton({ boardId }: { boardId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onGen() {
    setPending(true);
    setErr(null);
    try {
      const result = await mutateJson(`/api/review-boards/${encodeURIComponent(boardId)}/generate-run`, {
        method: "POST",
      });
      if (!result.ok) {
        setErr(result.message || "Generate failed");
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-2">
      <AsyncActionButton type="button" className="rounded border border-[var(--border-strong)] px-2 py-1 text-xs text-[var(--text-primary)] disabled:opacity-50" pending={pending} pendingLabel="Generating…" onClick={() => void onGen()}>
        Generate run
      </AsyncActionButton>
      <InlineMutationStatus message={err} variant="error" className="mt-1 text-xs" />
    </div>
  );
}
