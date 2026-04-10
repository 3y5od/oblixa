"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AutopilotRevertLogButton(props: { logId: string; canRevert: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!props.canRevert) return null;

  async function revert() {
    setPending(true);
    setErr(null);
    try {
      const res = await fetch(`/api/autopilot/run-logs/${encodeURIComponent(props.logId)}/revert`, {
        method: "POST",
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(j.error ?? "Revert failed");
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
        className="rounded border border-zinc-300 px-2 py-1 text-[11px] text-zinc-800 disabled:opacity-50"
        onClick={() => void revert()}
      >
        {pending ? "Reverting…" : "Revert (best effort)"}
      </button>
      {err ? <p className="mt-1 text-[11px] text-red-600">{err}</p> : null}
    </div>
  );
}
