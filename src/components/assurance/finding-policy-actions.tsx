"use client";

import Link from "next/link";
import { useState } from "react";
import { AsyncActionButton } from "@/components/ui/async-action-button";
import { InlineMutationStatus } from "@/components/ui/inline-mutation-status";
import { mutateJson } from "@/lib/http/client-json";

type Props = {
  policyId: string;
  canSimulate: boolean;
};

export function FindingPolicyActions({ policyId, canSimulate }: Props) {
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [variant, setVariant] = useState<"success" | "error">("success");

  async function runSimulate() {
    setPending(true);
    setMsg(null);
    setVariant("success");
    try {
      const result = await mutateJson(`/api/control-policies/${encodeURIComponent(policyId)}/simulate`, {
        method: "POST",
      });
      if (!result.ok) {
        setVariant("error");
        setMsg(result.message || "Simulation failed");
        return;
      }
      setMsg("What-if simulation recorded. See control policy detail for results.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/40 p-3 text-xs text-[var(--text-primary)]">
      <p className="font-semibold text-[var(--text-primary)]">Linked control policy</p>
      <p className="mt-1 font-mono text-[11px] text-[var(--text-secondary)]">{policyId}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Link className="ui-link" href={`/assurance/control-policies/${encodeURIComponent(policyId)}`}>
          Open policy
        </Link>
        {canSimulate ? (
          <AsyncActionButton
            type="button"
            className="rounded border border-[var(--border-strong)] px-2 py-1 text-[11px] text-[var(--text-primary)] disabled:opacity-50"
            pending={pending}
            pendingLabel="Running…"
            onClick={() => void runSimulate()}
          >
            Run policy what-if simulate
          </AsyncActionButton>
        ) : null}
      </div>
      <InlineMutationStatus message={msg} variant={variant} className="mt-2 text-[11px]" />
    </div>
  );
}
