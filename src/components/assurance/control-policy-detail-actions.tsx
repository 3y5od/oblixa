"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
      const res = await fetch(`/api/control-policies/${props.policyId}/simulate`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(typeof j.error === "string" ? j.error : "Simulate failed");
        setSimResult(null);
        return;
      }
      setSimResult(Array.isArray(j.evaluations) ? j.evaluations : []);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function runPublish() {
    setBusy("pub");
    setErr(null);
    try {
      const res = await fetch(`/api/control-policies/${props.policyId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(typeof j.error === "string" ? j.error : "Publish failed");
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
        <button
          type="button"
          className="ui-btn-secondary rounded-lg px-3 py-2 text-xs font-medium"
          disabled={busy !== null}
          onClick={() => void runSimulate()}
        >
          {busy === "sim" ? "Simulating…" : "Run simulation"}
        </button>
        <button
          type="button"
          className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
          disabled={busy !== null}
          onClick={() => void runPublish()}
        >
          {busy === "pub" ? "Publishing…" : "Publish new version"}
        </button>
      </div>
      {err ? <p className="text-xs text-red-600">{err}</p> : null}
      {simResult && simResult.length > 0 ? (
        <div className="rounded-lg border border-zinc-100 bg-zinc-50/80 p-3 text-xs">
          <p className="font-semibold text-zinc-800">Latest simulation</p>
          <ul className="mt-2 space-y-2">
            {simResult.map((e) => (
              <li key={e.evaluation_unit_key} className="border-t border-zinc-200/80 pt-2 first:border-t-0 first:pt-0">
                <span className={e.pass ? "text-emerald-700" : "text-amber-800"}>
                  {e.pass ? "Pass" : "Breach"} · {e.scope_label}
                </span>
                <span className="ml-2 text-zinc-500">({e.enforcement_mode})</span>
                {!e.pass && e.breach_details.length > 0 ? (
                  <ul className="mt-1 list-disc pl-4 text-zinc-600">
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
