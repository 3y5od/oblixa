"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  recommendationId: string;
  accepted: boolean;
  dismissed: boolean;
};

export function RecommendationRowActions({ recommendationId, accepted, dismissed }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function patch(action: "accept" | "dismiss") {
    setBusy(true);
    try {
      const res = await fetch(`/api/intelligence/recommendations/${recommendationId}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || res.statusText);
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (accepted || dismissed) {
    return <span className="text-zinc-400">—</span>;
  }

  return (
    <span className="flex gap-1">
      <button
        type="button"
        className="rounded-md border border-zinc-200 px-2 py-0.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        disabled={busy}
        onClick={() => void patch("accept")}
      >
        Accept
      </button>
      <button
        type="button"
        className="rounded-md border border-zinc-200 px-2 py-0.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        disabled={busy}
        onClick={() => void patch("dismiss")}
      >
        Dismiss
      </button>
    </span>
  );
}
