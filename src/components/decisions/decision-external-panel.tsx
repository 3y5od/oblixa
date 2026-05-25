"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AsyncActionButton } from "@/components/ui/async-action-button";
import { ExternalLink } from "@/components/ui/external-link";
import { InlineMutationStatus } from "@/components/ui/inline-mutation-status";
import { mutateJson } from "@/lib/http/client-json";
import {
  EXTERNAL_ACTION_TYPES,
  type ExternalActionType,
} from "@/lib/decision-intelligence/external-action-types";

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
      const result = await mutateJson<{
        error?: string;
        externalAction?: { token?: string };
      }>("/api/external-actions/create-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType,
          expiresInHours: expiresHours,
          scope: { decisionWorkspaceId: decisionId },
        }),
      });
      if (!result.ok) throw new Error(result.message || "Failed");
      const token = result.data.externalAction?.token;
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
      <InlineMutationStatus message={error} variant="error" className="mt-2 text-sm" />
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
        <AsyncActionButton
          type="button"
          className="ui-btn-secondary px-3 py-2 text-xs"
          pending={busy}
          pendingLabel="Creating…"
          onClick={() => void createLink()}
        >
          Create link
        </AsyncActionButton>
      </div>
      {createdUrl && (
        <div className="mt-3 break-all text-xs text-emerald-800">
          <p>
            Share submit URL: <span className="font-mono">{createdUrl}</span>
          </p>
          <ExternalLink href={createdUrl} className="ui-link mt-1 inline-flex items-center font-mono text-[11px]">
            Continue submit page
          </ExternalLink>
        </div>
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
                  <ExternalLink
                    href={appOrigin ? `${appOrigin.replace(/\/$/, "")}/external/${l.token}` : `/external/${l.token}`}
                    className="ui-link font-mono text-[11px]"
                  >
                    {appOrigin ? `${appOrigin.replace(/\/$/, "")}/external/${l.token}` : `/external/${l.token}`}
                  </ExternalLink>
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
                  <p className="ui-alert-error mt-2 text-[11px]">Correction: {l.correctionMessage}</p>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </div>
    </section>
  );
}
