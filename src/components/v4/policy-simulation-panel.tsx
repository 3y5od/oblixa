"use client";

import { useMemo, useState } from "react";
import { fetchJson } from "@/lib/http/client-json";
import { captureClientException } from "@/lib/observability/sentry-client";
import { analyzePolicyRegistry, validatePolicyRegistry } from "@/lib/v4/policy-registry";

export type PolicySimulationContractOption = { id: string; title: string };
type PolicySimulationMode = "preview" | "diagnostics";

function formatPreviewResponse(responseText: string): { title: string; lines: string[] } {
  try {
    const parsed = JSON.parse(responseText) as {
      simulation?: {
        contract_title?: string;
        registry_entry_count?: number;
        approval_sla_fallback_hours?: number | null;
        contract_missing_critical_dates?: boolean;
      };
      warnings?: string[];
    };
    const simulation = parsed.simulation;
    if (!simulation) return { title: "Preview could not be completed", lines: [responseText] };
    const lines = [
      `Contract: ${simulation.contract_title || "Selected contract"}`,
      `Policies checked: ${simulation.registry_entry_count ?? 0}`,
      simulation.approval_sla_fallback_hours
        ? `Approval timing fallback: ${simulation.approval_sla_fallback_hours} hours`
        : "Approval timing fallback: none",
      simulation.contract_missing_critical_dates
        ? "Contract needs critical date review before relying on policy automation."
        : "No critical date blocker was found for this contract.",
    ];
    if (Array.isArray(parsed.warnings) && parsed.warnings.length > 0) {
      lines.push(`${parsed.warnings.length} policy warning${parsed.warnings.length === 1 ? "" : "s"} returned.`);
    }
    return { title: "Preview result", lines };
  } catch {
    return { title: "Preview result", lines: [responseText] };
  }
}

export function PolicySimulationPanel({
  contracts,
  mode = "diagnostics",
}: {
  contracts: PolicySimulationContractOption[];
  mode?: PolicySimulationMode;
}) {
  const [contractId, setContractId] = useState(contracts[0]?.id ?? "");
  const [draftJson, setDraftJson] = useState("");
  const [loading, setLoading] = useState(false);
  const [responseText, setResponseText] = useState<string | null>(null);
  const isDiagnostics = mode === "diagnostics";
  const responsePreview = responseText && !isDiagnostics ? formatPreviewResponse(responseText) : null;

  const localDraftCheck = useMemo(() => {
    if (!isDiagnostics) return null;
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
  }, [draftJson, isDiagnostics]);

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
        <h2 className="ui-section-title mt-1 text-base">
          {isDiagnostics ? "Policy simulation" : "Preview impact"}
        </h2>
        <p className="ui-muted-tight mt-2">
          Add at least one contract to your workspace to preview policy impact against a real record.
        </p>
      </section>
    );
  }

  return (
    <section className="ui-card p-5 space-y-4">
      <div>
        <p className="ui-eyebrow">Governance</p>
        <h2 className="ui-section-title mt-1 text-base">
          {isDiagnostics ? "Policy simulation" : "Preview impact"}
        </h2>
        <p className="ui-muted-tight mt-1">
          {isDiagnostics ? (
            <>
              Calls <code className="text-[11px]">POST /api/policy/simulate</code> with no writes. Leave draft empty to
              use the saved registry from the database.
            </>
          ) : (
            "Preview only. Select a contract to see which policy behavior would apply before changing settings."
          )}
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

      {isDiagnostics ? (
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
      ) : null}

      <button
        type="button"
        disabled={loading || !contractId || localDraftCheck?.kind === "error"}
        onClick={() => void runSimulation()}
        className="ui-btn-primary px-4 py-2 text-sm disabled:opacity-50"
      >
        {loading ? "Running…" : isDiagnostics ? "Run simulation" : "Preview impact"}
      </button>

      {responsePreview ? (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{responsePreview.title}</p>
          <ul className="mt-2 space-y-1 text-sm text-[var(--text-secondary)]">
            {responsePreview.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {responseText && isDiagnostics ? (
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
