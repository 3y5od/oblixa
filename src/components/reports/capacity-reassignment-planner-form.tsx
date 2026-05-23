"use client";

import { useState } from "react";
import { AsyncActionButton } from "@/components/ui/async-action-button";
import { InlineMutationStatus } from "@/components/ui/inline-mutation-status";
import { mutateJson } from "@/lib/http/client-json";

export function CapacityReassignmentPlannerForm({
  defaultCurrentLoad,
  defaultTargetLoad,
  enabled,
}: {
  defaultCurrentLoad: number;
  defaultTargetLoad: number;
  enabled: boolean;
}) {
  const [teamKey, setTeamKey] = useState("ops");
  const [currentLoad, setCurrentLoad] = useState(String(defaultCurrentLoad));
  const [targetLoad, setTargetLoad] = useState(String(defaultTargetLoad));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultJson, setResultJson] = useState<string | null>(null);

  async function onGenerate() {
    setPending(true);
    setError(null);
    setResultJson(null);
    try {
      const result = await mutateJson("/api/capacity/reassignment-plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          teamKey: teamKey.trim(),
          currentLoad: Number(currentLoad),
          targetLoad: Number(targetLoad),
        }),
      });
      if (!result.ok) {
        setError(result.message || "Could not generate reassignment plan.");
        return;
      }
      setResultJson(JSON.stringify(result.data, null, 2));
    } finally {
      setPending(false);
    }
  }

  if (!enabled) {
    return <p className="mt-2 text-xs text-[var(--text-tertiary)]">Reassignment planner is hidden for this workspace.</p>;
  }

  return (
    <div className="mt-4 grid gap-2">
      <label className="text-xs text-[var(--text-secondary)]">
        Team key
        <input value={teamKey} onChange={(e) => setTeamKey(e.target.value)} className="ui-input-compact mt-1 w-full" required />
      </label>
      <label className="text-xs text-[var(--text-secondary)]">
        Current load
        <input value={currentLoad} onChange={(e) => setCurrentLoad(e.target.value)} type="number" className="ui-input-compact mt-1 w-full" required />
      </label>
      <label className="text-xs text-[var(--text-secondary)]">
        Target load
        <input value={targetLoad} onChange={(e) => setTargetLoad(e.target.value)} type="number" className="ui-input-compact mt-1 w-full" required />
      </label>
      <AsyncActionButton type="button" className="ui-btn-secondary mt-2 px-3 py-2 text-xs" pending={pending} pendingLabel="Generating…" onClick={() => void onGenerate()}>
        Generate reassignment plan
      </AsyncActionButton>
      <InlineMutationStatus message={error} variant="error" className="text-xs" />
      {resultJson ? (
        <pre className="max-h-56 overflow-auto rounded border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_54%,transparent)] p-3 text-[11px] text-[var(--text-primary)]">
          {resultJson}
        </pre>
      ) : null}
    </div>
  );
}