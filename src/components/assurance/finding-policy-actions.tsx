"use client";

import Link from "next/link";
import { useState } from "react";

type Props = {
  policyId: string;
  canSimulate: boolean;
};

export function FindingPolicyActions({ policyId, canSimulate }: Props) {
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function runSimulate() {
    setPending(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/control-policies/${encodeURIComponent(policyId)}/simulate`, {
        method: "POST",
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setMsg(j.error ?? "Simulation failed");
        return;
      }
      setMsg("What-if simulation recorded. See control policy detail for results.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/40 p-3 text-xs text-zinc-800">
      <p className="font-semibold text-zinc-900">Linked control policy</p>
      <p className="mt-1 font-mono text-[11px] text-zinc-600">{policyId}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Link className="ui-link" href={`/assurance/control-policies/${encodeURIComponent(policyId)}`}>
          Open policy
        </Link>
        {canSimulate ? (
          <button
            type="button"
            disabled={pending}
            className="rounded border border-zinc-300 px-2 py-1 text-[11px] text-zinc-800 disabled:opacity-50"
            onClick={() => void runSimulate()}
          >
            {pending ? "Running…" : "Run policy what-if simulate"}
          </button>
        ) : null}
      </div>
      {msg ? <p className="mt-2 text-[11px] text-zinc-600">{msg}</p> : null}
    </div>
  );
}
