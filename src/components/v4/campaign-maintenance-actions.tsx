"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CampaignRollbackButton({ campaignId }: { campaignId: string }) {
  const [pending, setPending] = useState(false);
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        if (!window.confirm("Mark this campaign as rolled back? This is an audit marker; verify data separately.")) {
          return;
        }
        setPending(true);
        try {
          await fetch(`/api/maintenance/campaigns/${campaignId}/rollback`, {
            method: "POST",
            credentials: "same-origin",
          });
          router.refresh();
        } finally {
          setPending(false);
        }
      }}
      className="ui-btn-secondary px-3 py-1.5 text-xs"
    >
      {pending ? "Saving…" : "Mark rollback"}
    </button>
  );
}
