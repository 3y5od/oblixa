"use client";

import { useMemo, useState } from "react";
import { analyzePolicyRegistry, validatePolicyRegistry } from "@/lib/v4/policy-registry";

export type PolicySimulationContractOption = { id: string; title: string };

export function PolicySimulationPanel({ contracts }: { contracts: PolicySimulationContractOption[] }) {
  const [contractId, setContractId] = useState(contracts[0]?.id ?? "");
  const [draftJson, setDraftJson] = useState("");
  const [loading, setLoading] = useState(false);
  const [responseText, setResponseText] = useState<string | null>(null);

  const localDraftCheck = useMemo(() => {
    const t = draftJson.trim();
    if (!t) return null;
    try {
      const parsed: unknown = JSON.parse(t);
      const v = validatePolicyRegistry(parsed);
      if (!v.ok) return { kind: "error" as const, message: v.error };
      return { kind: "ok" as const, warnings: analyzePolicyRegistry(parsed) };
    } catch {
      return { kind: "error" as const, message: "Draft is not valid JSON." };
    }
  }, [draftJson]);

  async function runSimulation() {
    if (!contractId) return;
    setLoading(true);
    setResponseText(null);
    try {
      const body: Record<string, unknown> = { contractId };
      if (draftJson.trim()) {
        body.registryDraft = JSON.parse(draftJson);
      }
      const res = await fetch("/api/policy/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setResponseText(JSON.stringify(data, null, 2));
    } catch (e) {
      setResponseText(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  if (contracts.length === 0) {
    return (
      <section className="ui-card p-5">
        <p className="ui-label-caps">Policy simulation</p>
        <p className="mt-2 text-sm text-zinc-600">
          Add at least one contract to your workspace to run a simulation against a real record.
        </p>
      </section>
    );
  }

  return (
    <section className="ui-card p-5 space-y-4">
      <div>
        <p className="ui-label-caps">Policy simulation</p>
        <p className="mt-1 text-xs text-zinc-500">
          Calls <code className="text-[10px]">POST /api/policy/simulate</code> with no writes. Leave draft empty to use
          the saved registry from the database.
        </p>
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-medium text-zinc-600">Contract</label>
        <select
          className="ui-input text-sm"
          value={contractId}
          onChange={(e) => setContractId(e.target.value)}
        >
          {contracts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title || "Untitled"} · {c.id.slice(0, 8)}…
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-medium text-zinc-600">Optional draft registry JSON</label>
        <textarea
          value={draftJson}
          onChange={(e) => setDraftJson(e.target.value)}
          rows={8}
          placeholder='Paste a registry array to preview without saving, e.g. [{"id":"x","applies_to":["approval"],"sla_hours":48}]'
          className="ui-input font-mono text-[11px]"
        />
        {localDraftCheck?.kind === "error" ? (
          <p className="text-xs text-rose-600">{localDraftCheck.message}</p>
        ) : null}
        {localDraftCheck?.kind === "ok" && localDraftCheck.warnings.length > 0 ? (
          <div className="rounded-lg border border-amber-200/80 bg-amber-50/50 p-3 text-xs text-amber-950">
            <p className="font-semibold">Draft warnings (before run)</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              {localDraftCheck.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        disabled={loading || !contractId || localDraftCheck?.kind === "error"}
        onClick={() => void runSimulation()}
        className="ui-btn-primary px-4 py-2 text-sm disabled:opacity-50"
      >
        {loading ? "Running…" : "Run simulation"}
      </button>

      {responseText ? (
        <div className="space-y-1">
          <p className="text-xs font-medium text-zinc-600">Response</p>
          <pre className="max-h-80 overflow-auto rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-[11px] text-zinc-800">
            {responseText}
          </pre>
        </div>
      ) : null}
    </section>
  );
}
