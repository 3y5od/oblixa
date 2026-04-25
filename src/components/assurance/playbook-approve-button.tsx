"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PlaybookApproveButton({ runId }: { runId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onApprove() {
    setPending(true);
    setErr(null);
    try {
      const res = await fetch(`/api/playbooks/runs/${encodeURIComponent(runId)}/approve`, {
        method: "POST",
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(j.error ?? res.statusText);
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="rounded-lg bg-[var(--text-primary)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        disabled={pending}
        onClick={() => void onApprove()}
      >
        {pending ? "Approving…" : "Approve & run"}
      </button>
      {err ? <span className="text-xs text-red-600">{err}</span> : null}
    </div>
  );
}
