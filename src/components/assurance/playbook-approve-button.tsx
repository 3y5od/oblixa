"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AsyncActionButton } from "@/components/ui/async-action-button";
import { InlineMutationStatus } from "@/components/ui/inline-mutation-status";
import { mutateJson } from "@/lib/http/client-json";

export function PlaybookApproveButton({ runId }: { runId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onApprove() {
    setPending(true);
    setErr(null);
    try {
      const result = await mutateJson(`/api/playbooks/runs/${encodeURIComponent(runId)}/approve`, {
        method: "POST",
      });
      if (!result.ok) {
        setErr(result.message);
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <AsyncActionButton
        type="button"
        className="rounded-lg bg-[var(--text-primary)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        pending={pending}
        pendingLabel="Approving…"
        onClick={() => void onApprove()}
      >
        Approve & run
      </AsyncActionButton>
      <InlineMutationStatus message={err} variant="error" className="text-xs" />
    </div>
  );
}
