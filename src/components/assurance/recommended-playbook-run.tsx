"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RecommendedPlaybookRun(props: {
  playbookId: string;
  playbookName: string | null;
  findingId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<null | "preview" | "run">(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function preview() {
    setPending("preview");
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/playbooks/${encodeURIComponent(props.playbookId)}/preview`, {
        method: "POST",
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; run?: { id?: string } };
      if (!res.ok) {
        setErr(j.error ?? "Preview failed");
        return;
      }
      setMsg(j.run?.id ? `Preview run recorded (${j.run.id}).` : "Preview recorded.");
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  async function run() {
    setPending("run");
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/playbooks/${encodeURIComponent(props.playbookId)}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceFindingId: props.findingId }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(j.error ?? "Run failed (you may need maintenance access).");
        return;
      }
      setMsg("Playbook started. Check Playbooks for run status.");
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2 border-t border-amber-100 pt-3">
      <button
        type="button"
        disabled={pending !== null}
        className="ui-btn-secondary rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
        onClick={() => void preview()}
      >
        {pending === "preview" ? "Preview…" : "Preview run"}
      </button>
      <button
        type="button"
        disabled={pending !== null}
        className="rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        onClick={() => void run()}
      >
        {pending === "run" ? "Starting…" : `Run ${props.playbookName ?? "playbook"}`}
      </button>
      {msg ? <p className="w-full text-xs text-emerald-800">{msg}</p> : null}
      {err ? <p className="w-full text-xs text-red-600">{err}</p> : null}
    </div>
  );
}
