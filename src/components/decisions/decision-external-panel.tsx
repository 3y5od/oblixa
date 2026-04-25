"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  EXTERNAL_ACTION_TYPES,
  type ExternalActionType,
} from "@/lib/v5/external-action-types";

type LinkRow = {
  id: string;
  token: string;
  action_type: string;
  status: string;
  expires_at: string;
  submitted_at: string | null;
  workflowStepCount?: number;
  workflowDeadlineIso?: string | null;
  lastWorkflowStepType?: string | null;
  correctionMessage?: string | null;
};

type Props = {
  decisionId: string;
  /** Optional absolute origin for copy/paste; relative `/api/...` paths work in-app. */
  appOrigin?: string;
  initialLinks: LinkRow[];
};

export function DecisionExternalPanel({ decisionId, appOrigin, initialLinks }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionType, setActionType] = useState<ExternalActionType>("submit_evidence");
  const [expiresHours, setExpiresHours] = useState(72);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);

  async function createLink() {
    setBusy(true);
    setError(null);
    setCreatedUrl(null);
    try {
      const res = await fetch("/api/external-actions/create-link", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType,
          expiresInHours: expiresHours,
          scope: { decisionWorkspaceId: decisionId },
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        externalAction?: { token?: string };
      };
      if (!res.ok) throw new Error(data.error || res.statusText);
      const token = data.externalAction?.token;
      if (!token) throw new Error("Missing token");
      const prefix = appOrigin?.replace(/\/$/, "") ?? "";
      setCreatedUrl(prefix ? `${prefix}/external/${token}` : `/external/${token}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ui-card p-5">
      <p className="ui-eyebrow">Collaboration</p>
      <h2 className="ui-section-title mt-1 text-base">External collaboration</h2>
      <p className="ui-muted-tight mt-2">
        Time-bound links for counterparties. Submissions are scope-limited to this decision.
      </p>
      {error && (
        <p className="mt-2 text-sm text-rose-700" role="alert">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex-1 text-xs font-medium text-[var(--text-secondary)]">
          Action type
          <select
            className="ui-input-compact mt-1 w-full"
            value={actionType}
            onChange={(e) => setActionType(e.target.value as ExternalActionType)}
            disabled={busy}
          >
            {EXTERNAL_ACTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="w-full text-xs font-medium text-[var(--text-secondary)] sm:w-32">
          Expires (h)
          <input
            type="number"
            min={1}
            max={720}
            className="ui-input-compact mt-1 w-full"
            value={expiresHours}
            onChange={(e) => setExpiresHours(Number(e.target.value))}
            disabled={busy}
          />
        </label>
        <button
          type="button"
          className="ui-btn-secondary px-3 py-2 text-xs"
          disabled={busy}
          onClick={() => void createLink()}
        >
          {busy ? "Creating…" : "Create link"}
        </button>
      </div>
      {createdUrl && (
        <p className="mt-3 break-all text-xs text-emerald-800">
          Share submit URL: <span className="font-mono">{createdUrl}</span>
        </p>
      )}
      <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
        <p className="text-xs font-semibold text-[var(--text-secondary)]">Recent links for this decision</p>
        <ul className="mt-2 space-y-2 text-xs text-[var(--text-secondary)]">
          {initialLinks.length === 0 ? (
            <li className="text-[var(--text-tertiary)]">None yet.</li>
          ) : (
            initialLinks.map((l) => (
              <li key={l.id} className="rounded-lg border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] px-2 py-2 font-mono">
                <span className="text-[var(--text-primary)]">{l.action_type}</span> · {l.status} · exp{" "}
                {new Date(l.expires_at).toLocaleString()}
                <div className="mt-1 break-all text-[11px] text-[var(--text-tertiary)]">
                  Page:{" "}
                  {appOrigin
                    ? `${appOrigin.replace(/\/$/, "")}/external/${l.token}`
                    : `/external/${l.token}`}
                </div>
                {(l.workflowStepCount ?? 0) > 0 || l.workflowDeadlineIso ? (
                  <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                    Workflow: {l.workflowStepCount ?? 0} step(s)
                    {l.lastWorkflowStepType ? ` · last: ${l.lastWorkflowStepType}` : ""}
                    {l.workflowDeadlineIso
                      ? ` · acknowledge by ${new Date(l.workflowDeadlineIso).toLocaleString()}`
                      : ""}
                  </p>
                ) : null}
                {l.correctionMessage ? (
                  <p className="mt-1 text-[11px] text-rose-700">Correction: {l.correctionMessage}</p>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </div>
    </section>
  );
}
