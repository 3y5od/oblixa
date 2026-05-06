"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AsyncActionButton } from "@/components/ui/async-action-button";
import { InlineMutationStatus } from "@/components/ui/inline-mutation-status";
import { mutateJson } from "@/lib/http/client-json";

type SimEval = {
  evaluation_unit_key: string;
  pass: boolean;
  scope_label: string;
  breach_codes: string[];
  breach_details: string[];
  enforcement_mode: string;
};

export function ControlPolicyDetailActions(props: { policyId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "sim" | "pub">(null);
  const [simResult, setSimResult] = useState<SimEval[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function runSimulate() {
    setBusy("sim");
    setErr(null);
    try {
      const result = await mutateJson<{ evaluations?: SimEval[] }>(`/api/control-policies/${props.policyId}/simulate`, {
        method: "POST",
      });
      if (!result.ok) {
        setErr(result.message || "Simulate failed");
        setSimResult(null);
        return;
      }
      setSimResult(Array.isArray(result.data.evaluations) ? result.data.evaluations : []);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function runPublish() {
    setBusy("pub");
    setErr(null);
    try {
      const result = await mutateJson(`/api/control-policies/${props.policyId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!result.ok) {
        setErr(result.message || "Publish failed");
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <AsyncActionButton
          type="button"
          className="ui-btn-secondary rounded-lg px-3 py-2 text-xs font-medium"
          pending={busy === "sim"}
          pendingLabel="Simulating…"
          disabled={busy === "pub"}
          onClick={() => void runSimulate()}
        >
          Run simulation
        </AsyncActionButton>
        <AsyncActionButton
          type="button"
          className="rounded-lg bg-[var(--text-primary)] px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
          pending={busy === "pub"}
          pendingLabel="Publishing…"
          disabled={busy === "sim"}
          onClick={() => void runPublish()}
        >
          Publish new version
        </AsyncActionButton>
      </div>
      <InlineMutationStatus message={err} variant="error" className="text-xs" />
      {simResult && simResult.length > 0 ? (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] p-3 text-xs">
          <p className="font-semibold text-[var(--text-primary)]">Latest simulation</p>
          <ul className="mt-2 space-y-2">
            {simResult.map((e) => (
              <li key={e.evaluation_unit_key} className="border-t border-[var(--border-subtle)] pt-2 first:border-t-0 first:pt-0">
                <span className={e.pass ? "text-emerald-700" : "text-amber-800"}>
                  {e.pass ? "Pass" : "Breach"} · {e.scope_label}
                </span>
                <span className="ml-2 text-[var(--text-tertiary)]">({e.enforcement_mode})</span>
                {!e.pass && e.breach_details.length > 0 ? (
                  <ul className="mt-1 list-disc pl-4 text-[var(--text-secondary)]">
                    {e.breach_details.slice(0, 4).map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
