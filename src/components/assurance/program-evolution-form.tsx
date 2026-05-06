"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AsyncActionButton } from "@/components/ui/async-action-button";
import { InlineMutationStatus } from "@/components/ui/inline-mutation-status";
import { mutateJson } from "@/lib/http/client-json";

export function ProgramEvolutionCreateForm() {
  const router = useRouter();
  const [hypothesis, setHypothesis] = useState("");
  const [programId, setProgramId] = useState("");
  const [baselineVersionId, setBaselineVersionId] = useState("");
  const [candidateVersionId, setCandidateVersionId] = useState("");
  const [targetSegmentId, setTargetSegmentId] = useState("");
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setErr(null);
    try {
      const result = await mutateJson("/api/program-evolution/experiments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          hypothesis: hypothesis || undefined,
          programId: programId || undefined,
          baselineVersionId: baselineVersionId || undefined,
          candidateVersionId: candidateVersionId || undefined,
          targetSegmentId: targetSegmentId || undefined,
        }),
      });
      if (!result.ok) {
        setErr(result.message || "Create failed");
        return;
      }
      setHypothesis("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-2 rounded-lg border border-[var(--border-subtle)] p-3 text-sm">
      <p className="text-xs font-semibold text-[var(--text-secondary)]">New experiment</p>
      <input
        className="w-full rounded border border-[var(--border-subtle)] px-2 py-1 text-sm"
        placeholder="Hypothesis (optional)"
        value={hypothesis}
        onChange={(e) => setHypothesis(e.target.value)}
      />
      <input
        className="w-full rounded border border-[var(--border-subtle)] px-2 py-1 text-sm"
        placeholder="Program UUID (optional)"
        value={programId}
        onChange={(e) => setProgramId(e.target.value)}
      />
      <input
        className="w-full rounded border border-[var(--border-subtle)] px-2 py-1 text-sm"
        placeholder="Baseline program version UUID (optional)"
        value={baselineVersionId}
        onChange={(e) => setBaselineVersionId(e.target.value)}
      />
      <input
        className="w-full rounded border border-[var(--border-subtle)] px-2 py-1 text-sm"
        placeholder="Candidate program version UUID (optional)"
        value={candidateVersionId}
        onChange={(e) => setCandidateVersionId(e.target.value)}
      />
      <input
        className="w-full rounded border border-[var(--border-subtle)] px-2 py-1 text-sm"
        placeholder="Target segment UUID (optional)"
        value={targetSegmentId}
        onChange={(e) => setTargetSegmentId(e.target.value)}
      />
      <AsyncActionButton
        type="submit"
        className="rounded-lg bg-[var(--text-primary)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        pending={pending}
        pendingLabel="Creating…"
      >
        Create experiment
      </AsyncActionButton>
      <InlineMutationStatus message={err} variant="error" className="text-xs" />
    </form>
  );
}

export function ProgramEvolutionRecordResultButton({ experimentId }: { experimentId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onRecord() {
    setPending(true);
    setErr(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const result = await mutateJson(`/api/program-evolution/experiments/${encodeURIComponent(experimentId)}/results`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          periodStart: today,
          healthImpact: { source: "ui_manual_snapshot", recorded_at: new Date().toISOString() },
        }),
      });
      if (!result.ok) {
        setErr(result.message || "Record failed");
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-2">
      <AsyncActionButton
        type="button"
        className="rounded border border-emerald-300 bg-emerald-50/80 px-2 py-1 text-xs text-emerald-900 disabled:opacity-50"
        pending={pending}
        pendingLabel="Recording…"
        onClick={() => void onRecord()}
      >
        Record result snapshot
      </AsyncActionButton>
      <InlineMutationStatus message={err} variant="error" className="mt-1 text-xs" />
    </div>
  );
}

export function ProgramEvolutionAdvanceRolloutButton({ experimentId }: { experimentId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onAdvance() {
    setPending(true);
    setErr(null);
    try {
      const result = await mutateJson(
        `/api/program-evolution/experiments/${encodeURIComponent(experimentId)}/advance-rollout`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ stage: "segment_expansion" }),
        }
      );
      if (!result.ok) {
        setErr(result.message || "Advance failed");
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-2">
      <AsyncActionButton
        type="button"
        className="ui-btn-secondary px-2 py-1 text-xs disabled:opacity-50"
        pending={pending}
        pendingLabel="Advancing…"
        onClick={() => void onAdvance()}
      >
        Advance rollout stage
      </AsyncActionButton>
      <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">
        Marks experiment running, logs a program_evolution_results milestone with live portfolio metrics.
      </p>
      <InlineMutationStatus message={err} variant="error" className="mt-1 text-xs" />
    </div>
  );
}

export function ProgramEvolutionSimulateButton({ experimentId }: { experimentId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSim() {
    setPending(true);
    setErr(null);
    try {
      const result = await mutateJson(`/api/program-evolution/experiments/${encodeURIComponent(experimentId)}/simulate`, {
        method: "POST",
      });
      if (!result.ok) {
        setErr(result.message || "Simulate failed");
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-2">
      <AsyncActionButton
        type="button"
        className="rounded border border-[var(--border-strong)] px-2 py-1 text-xs text-[var(--text-primary)] disabled:opacity-50"
        pending={pending}
        pendingLabel="Simulating…"
        onClick={() => void onSim()}
      >
        Run simulate
      </AsyncActionButton>
      <InlineMutationStatus message={err} variant="error" className="mt-1 text-xs" />
    </div>
  );
}
