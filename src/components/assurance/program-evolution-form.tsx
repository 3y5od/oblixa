"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
      const res = await fetch("/api/program-evolution/experiments", {
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
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(j.error ?? "Create failed");
        return;
      }
      setHypothesis("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-2 rounded-lg border border-zinc-100 p-3 text-sm">
      <p className="text-xs font-semibold text-zinc-700">New experiment</p>
      <input
        className="w-full rounded border border-zinc-200 px-2 py-1 text-sm"
        placeholder="Hypothesis (optional)"
        value={hypothesis}
        onChange={(e) => setHypothesis(e.target.value)}
      />
      <input
        className="w-full rounded border border-zinc-200 px-2 py-1 text-sm"
        placeholder="Program UUID (optional)"
        value={programId}
        onChange={(e) => setProgramId(e.target.value)}
      />
      <input
        className="w-full rounded border border-zinc-200 px-2 py-1 text-sm"
        placeholder="Baseline program version UUID (optional)"
        value={baselineVersionId}
        onChange={(e) => setBaselineVersionId(e.target.value)}
      />
      <input
        className="w-full rounded border border-zinc-200 px-2 py-1 text-sm"
        placeholder="Candidate program version UUID (optional)"
        value={candidateVersionId}
        onChange={(e) => setCandidateVersionId(e.target.value)}
      />
      <input
        className="w-full rounded border border-zinc-200 px-2 py-1 text-sm"
        placeholder="Target segment UUID (optional)"
        value={targetSegmentId}
        onChange={(e) => setTargetSegmentId(e.target.value)}
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create experiment"}
      </button>
      {err ? <p className="text-xs text-red-600">{err}</p> : null}
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
      const res = await fetch(`/api/program-evolution/experiments/${encodeURIComponent(experimentId)}/results`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          periodStart: today,
          healthImpact: { source: "ui_manual_snapshot", recorded_at: new Date().toISOString() },
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(j.error ?? "Record failed");
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
        className="rounded border border-emerald-300 bg-emerald-50/80 px-2 py-1 text-xs text-emerald-900 disabled:opacity-50"
        onClick={() => void onRecord()}
      >
        {pending ? "Recording…" : "Record result snapshot"}
      </button>
      {err ? <p className="mt-1 text-xs text-red-600">{err}</p> : null}
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
      const res = await fetch(
        `/api/program-evolution/experiments/${encodeURIComponent(experimentId)}/advance-rollout`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ stage: "segment_expansion" }),
        }
      );
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(j.error ?? "Advance failed");
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
        className="rounded border border-amber-300 bg-amber-50/80 px-2 py-1 text-xs text-amber-950 disabled:opacity-50"
        onClick={() => void onAdvance()}
      >
        {pending ? "Advancing…" : "Advance rollout stage"}
      </button>
      <p className="mt-1 text-[10px] text-zinc-500">
        Marks experiment running, logs a program_evolution_results milestone with live portfolio metrics.
      </p>
      {err ? <p className="mt-1 text-xs text-red-600">{err}</p> : null}
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
      const res = await fetch(`/api/program-evolution/experiments/${encodeURIComponent(experimentId)}/simulate`, {
        method: "POST",
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(j.error ?? "Simulate failed");
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
        className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-800 disabled:opacity-50"
        onClick={() => void onSim()}
      >
        {pending ? "Simulating…" : "Run simulate"}
      </button>
      {err ? <p className="mt-1 text-xs text-red-600">{err}</p> : null}
    </div>
  );
}
