"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import { InlineMutationStatus } from "@/components/ui/inline-mutation-status";
import { mutateJson } from "@/lib/http/client-json";

export function CampaignRollbackButton({ campaignId }: { campaignId: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function onRollback() {
    setPending(true);
    setError(null);
    try {
      const result = await mutateJson(`/api/maintenance/campaigns/${campaignId}/rollback`, {
        method: "POST",
      });
      if (!result.ok) {
        setError(result.message || "Rollback failed");
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-1">
      <ConfirmActionButton
        type="button"
        className="ui-btn-secondary px-3 py-1.5 text-xs"
        pending={pending}
        pendingLabel="Saving…"
        confirmMessage="Mark this campaign as rolled back? This is an audit marker; verify data separately."
        onConfirm={onRollback}
      >
        Mark rollback
      </ConfirmActionButton>
      <InlineMutationStatus message={error} variant="error" className="text-xs" />
    </div>
  );
}
