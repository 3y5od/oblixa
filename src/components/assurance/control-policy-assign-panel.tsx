"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type SegmentOpt = { id: string; name: string; key: string };

export function ControlPolicyAssignPanel({
  policyId,
  segments,
}: {
  policyId: string;
  segments: SegmentOpt[];
}) {
  const router = useRouter();
  const [assignmentType, setAssignmentType] = useState("global");
  const [segmentId, setSegmentId] = useState("");
  const [targetRefType, setTargetRefType] = useState("");
  const [targetRefId, setTargetRefId] = useState("");
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setErr(null);
    try {
      const body: Record<string, string> = { assignmentType };
      if (assignmentType === "segment") {
        if (!segmentId.trim()) {
          setErr("Pick a segment");
          setPending(false);
          return;
        }
        body.segmentId = segmentId.trim();
      }
      if (assignmentType !== "global" && assignmentType !== "segment") {
        if (!targetRefId.trim()) {
          setErr("Target ref id is required");
          setPending(false);
          return;
        }
        body.targetRefId = targetRefId.trim();
        body.targetRefType =
          targetRefType.trim() ||
          (assignmentType === "account"
            ? "account"
            : assignmentType === "counterparty"
              ? "counterparty"
              : assignmentType === "program"
                ? "program"
                : "contract_class");
      }
      const res = await fetch(`/api/control-policies/${encodeURIComponent(policyId)}/assign`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(j.error ?? "Assign failed");
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="mt-3 space-y-2 rounded-lg border border-zinc-100 p-3 text-sm">
      <p className="text-xs font-semibold text-zinc-800">Add assignment</p>
      <label className="block text-xs text-zinc-600">
        Scope type
        <select
          className="ui-input mt-1 w-full text-sm"
          value={assignmentType}
          onChange={(e) => setAssignmentType(e.target.value)}
        >
          <option value="global">Global (organization rollup)</option>
          <option value="segment">Segment</option>
          <option value="account">Account (target ref)</option>
          <option value="counterparty">Counterparty (target ref)</option>
          <option value="program">Program (target ref)</option>
          <option value="contract_class">Contract class (target ref)</option>
        </select>
      </label>
      {assignmentType === "segment" ? (
        <label className="block text-xs text-zinc-600">
          Segment
          <select
            className="ui-input mt-1 w-full text-sm"
            value={segmentId}
            onChange={(e) => setSegmentId(e.target.value)}
            required
          >
            <option value="">Select segment…</option>
            {segments.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.key})
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {assignmentType !== "global" && assignmentType !== "segment" ? (
        <>
          <label className="block text-xs text-zinc-600">
            Target ref type (optional override)
            <input
              className="ui-input mt-1 w-full text-sm"
              value={targetRefType}
              onChange={(e) => setTargetRefType(e.target.value)}
              placeholder="e.g. account"
            />
          </label>
          <label className="block text-xs text-zinc-600">
            Target ref id
            <input
              className="ui-input mt-1 w-full font-mono text-xs"
              value={targetRefId}
              onChange={(e) => setTargetRefId(e.target.value)}
              placeholder="UUID or key"
              required
            />
          </label>
        </>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
      >
        {pending ? "Saving…" : "Create assignment"}
      </button>
      {err ? <p className="text-xs text-red-600">{err}</p> : null}
    </form>
  );
}
