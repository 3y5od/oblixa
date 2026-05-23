"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AsyncActionButton } from "@/components/ui/async-action-button";
import { InlineMutationStatus } from "@/components/ui/inline-mutation-status";
import { LiveRegion } from "@/components/ui/live-region";
import { mutateJson } from "@/lib/http/client-json";
import { pushAppHref } from "@/lib/navigation/client-navigation";
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
      const result = await mutateJson<{ error?: string; decision?: { id: string } }>("/api/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          decisionType,
          requiredInputs,
        }),
      });
      if (!result.ok) throw new Error(result.message);
      if (result.data.decision?.id) {
        if (!pushAppHref(router, `/decisions/${result.data.decision.id}`)) {
          setError("The decision workspace was created, but it could not be opened automatically.");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3">
      <LiveRegion message={busy ? "Creating decision workspace." : error ?? undefined} politeness={error ? "assertive" : "polite"} />
      <InlineMutationStatus message={error} variant="error" />
      <label className="block text-[11px] font-medium text-[var(--text-tertiary)]">
        Title
        <input
          className="ui-input-compact mt-1 w-full text-sm"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={busy}
          required
        />
      </label>
      <label className="block text-[11px] font-medium text-[var(--text-tertiary)]">
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
      <label className="block text-[11px] font-medium text-[var(--text-tertiary)]">
        Required inputs (JSON object, optional)
        <textarea
          className="ui-input-compact mt-1 min-h-[56px] w-full font-mono text-[11px]"
          value={requiredJson}
          onChange={(e) => setRequiredJson(e.target.value)}
          disabled={busy}
        />
      </label>
      <AsyncActionButton type="submit" className="ui-btn-secondary px-4 py-2 text-[12.5px]" pending={busy} pendingLabel="Creating…">
        Create workspace
      </AsyncActionButton>
    </form>
  );
}
