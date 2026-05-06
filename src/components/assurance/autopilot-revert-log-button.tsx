"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import { InlineMutationStatus } from "@/components/ui/inline-mutation-status";
import { mutateJson } from "@/lib/http/client-json";

export function AutopilotRevertLogButton(props: { logId: string; canRevert: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!props.canRevert) return null;

  async function revert() {
    setPending(true);
    setErr(null);
    try {
      const result = await mutateJson(`/api/autopilot/run-logs/${encodeURIComponent(props.logId)}/revert`, {
        method: "POST",
      });
      if (!result.ok) {
        setErr(result.message || "Revert failed");
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-2">
      <ConfirmActionButton
        type="button"
        className="rounded border border-[var(--border-strong)] px-2 py-1 text-[11px] text-[var(--text-primary)] disabled:opacity-50"
        pending={pending}
        pendingLabel="Reverting…"
        confirmMessage="Revert this autopilot log entry?"
        onConfirm={revert}
      >
        Revert (best effort)
      </ConfirmActionButton>
      <InlineMutationStatus message={err} variant="error" className="mt-1 text-[11px]" />
    </div>
  );
}
