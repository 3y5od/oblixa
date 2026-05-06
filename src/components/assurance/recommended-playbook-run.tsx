"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AsyncActionButton } from "@/components/ui/async-action-button";
import { InlineMutationStatus } from "@/components/ui/inline-mutation-status";
import { mutateJson } from "@/lib/http/client-json";

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
      const result = await mutateJson<{ error?: string; run?: { id?: string } }>(
        `/api/playbooks/${encodeURIComponent(props.playbookId)}/preview`,
        {
        method: "POST",
        }
      );
      if (!result.ok) {
        setErr(result.message || "Preview failed");
        return;
      }
      setMsg(result.data.run?.id ? `Preview run recorded (${result.data.run.id}).` : "Preview recorded.");
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
      const result = await mutateJson(`/api/playbooks/${encodeURIComponent(props.playbookId)}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceFindingId: props.findingId }),
      });
      if (!result.ok) {
        setErr(result.message || "Run failed (you may need maintenance access).");
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
      <AsyncActionButton
        type="button"
        className="ui-btn-secondary rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
        pending={pending === "preview"}
        pendingLabel="Preview…"
        disabled={pending === "run"}
        onClick={() => void preview()}
      >
        Preview run
      </AsyncActionButton>
      <AsyncActionButton
        type="button"
        className="rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        pending={pending === "run"}
        pendingLabel="Starting…"
        disabled={pending === "preview"}
        onClick={() => void run()}
      >
        {`Run ${props.playbookName ?? "playbook"}`}
      </AsyncActionButton>
      <InlineMutationStatus message={msg} variant="success" className="w-full text-xs" />
      <InlineMutationStatus message={err} variant="error" className="w-full text-xs" />
    </div>
  );
}
