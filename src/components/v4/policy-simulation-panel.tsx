"use client";

import { useMemo, useState } from "react";
import { fetchJson } from "@/lib/http/client-json";
import { captureClientException } from "@/lib/observability/sentry";
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
        let registryDraft: unknown;
        try {
          registryDraft = JSON.parse(draftJson);
        } catch {
          setResponseText("Draft is not valid JSON.");
          setLoading(false);
          return;
        }
        body.registryDraft = registryDraft;
      }
      const result = await fetchJson("/api/policy/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!result.ok) {
        setResponseText(`Request failed (${result.status}): ${result.message}`);
        if (result.status >= 500) {
          captureClientException(new Error(result.message), {
            extra: { surface: "PolicySimulationPanel", status: result.status },
          });
        }
        return;
      }
      setResponseText(JSON.stringify(result.data, null, 2));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Request failed";
      setResponseText(msg);
      captureClientException(e, { extra: { surface: "PolicySimulationPanel", phase: "network" } });
    } finally {
      setLoading(false);
    }
  }

  if (contracts.length === 0) {
    return (
      <section className="ui-card p-5">
        <p className="ui-eyebrow">Governance</p>
        <h2 className="ui-section-title mt-1 text-base">Policy simulation</h2>
        <p className="ui-muted-tight mt-2">
          Add at least one contract to your workspace to run a simulation against a real record.
        </p>
      </section>
    );
  }

  return (
    <section className="ui-card p-5 space-y-4">
      <div>
        <p className="ui-eyebrow">Governance</p>
        <h2 className="ui-section-title mt-1 text-base">Policy simulation</h2>
        <p className="ui-muted-tight mt-1">
          Calls <code className="text-[10px]">POST /api/policy/simulate</code> with no writes. Leave draft empty to use
          the saved registry from the database.
        </p>
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-medium text-[var(--text-secondary)]">Contract</label>
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
        <label className="block text-xs font-medium text-[var(--text-secondary)]">Optional draft registry JSON</label>
        <textarea
          value={draftJson}
          onChange={(e) => setDraftJson(e.target.value)}
          rows={8}
          placeholder='Paste a registry array to preview without saving, e.g. [{"id":"x","applies_to":["approval"],"sla_hours":48}]'
          className="ui-input font-mono text-[11px]"
        />
        {localDraftCheck?.kind === "error" ? (
          <p className="ui-alert-error text-xs">{localDraftCheck.message}</p>
        ) : null}
        {localDraftCheck?.kind === "ok" && localDraftCheck.warnings.length > 0 ? (
          <div className="ui-alert-warning p-3 text-xs">
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
          <p className="text-xs font-medium text-[var(--text-secondary)]">Response</p>
          <pre className="ui-soft-details max-h-80 overflow-auto p-3 text-[11px] text-[var(--text-primary)]">
            {responseText}
          </pre>
        </div>
      ) : null}
    </section>
  );
}
