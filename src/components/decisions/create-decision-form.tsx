"use client";
// V7 exempt: create flow only mounted from decisions surfaces; post-create router targets decisions routes.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DECISION_TYPES, DECISION_TYPE_LABELS, type DecisionType } from "@/lib/v5/decision-types";

export function CreateDecisionForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [decisionType, setDecisionType] = useState<DecisionType>("renewal");
  const [requiredJson, setRequiredJson] = useState("{}");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    let requiredInputs: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(requiredJson) as unknown;
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("Must be a JSON object");
      }
      requiredInputs = parsed as Record<string, unknown>;
    } catch {
      setError("Required inputs must be valid JSON object.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/decisions", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          decisionType,
          requiredInputs,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; decision?: { id: string } };
      if (!res.ok) throw new Error(data.error || res.statusText);
      if (data.decision?.id) {
        router.push(`/decisions/${data.decision.id}`);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3">
      {error ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
          {error}
        </p>
      ) : null}
      <label className="block text-[11px] font-medium text-zinc-500">
        Title
        <input
          className="ui-input-compact mt-1 w-full text-sm"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={busy}
          required
        />
      </label>
      <label className="block text-[11px] font-medium text-zinc-500">
        Decision type
        <select
          className="ui-input-compact mt-1 w-full text-sm"
          value={decisionType}
          onChange={(e) => setDecisionType(e.target.value as DecisionType)}
          disabled={busy}
        >
          {DECISION_TYPES.map((t) => (
            <option key={t} value={t}>
              {DECISION_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-[11px] font-medium text-zinc-500">
        Required inputs (JSON object, optional)
        <textarea
          className="ui-input-compact mt-1 min-h-[56px] w-full font-mono text-[11px]"
          value={requiredJson}
          onChange={(e) => setRequiredJson(e.target.value)}
          disabled={busy}
        />
      </label>
      <button type="submit" className="ui-btn-secondary px-4 py-2 text-[13px]" disabled={busy}>
        {busy ? "Creating…" : "Create workspace"}
      </button>
    </form>
  );
}
