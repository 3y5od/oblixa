"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SegmentRecomputeButton({ segmentId }: { segmentId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onRecompute() {
    setPending(true);
    setErr(null);
    try {
      const res = await fetch(`/api/segments/${encodeURIComponent(segmentId)}/recompute`, {
        method: "POST",
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(j.error ?? "Recompute failed");
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        disabled={pending}
        className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-800 disabled:opacity-50"
        onClick={() => void onRecompute()}
      >
        {pending ? "Recomputing…" : "Recompute memberships"}
      </button>
      {err ? <p className="mt-1 text-xs text-red-600">{err}</p> : null}
    </div>
  );
}
