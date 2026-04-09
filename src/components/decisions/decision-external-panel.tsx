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
      <p className="ui-label-caps">External collaboration</p>
      <p className="mt-2 text-xs text-zinc-500">
        Time-bound links for counterparties. Submissions are scope-limited to this decision.
      </p>
      {error && (
        <p className="mt-2 text-sm text-rose-700" role="alert">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex-1 text-xs font-medium text-zinc-600">
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
        <label className="w-full text-xs font-medium text-zinc-600 sm:w-32">
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
      <div className="mt-4 border-t border-zinc-100 pt-4">
        <p className="text-xs font-semibold text-zinc-600">Recent links for this decision</p>
        <ul className="mt-2 space-y-2 text-xs text-zinc-700">
          {initialLinks.length === 0 ? (
            <li className="text-zinc-500">None yet.</li>
          ) : (
            initialLinks.map((l) => (
              <li key={l.id} className="rounded-lg border border-zinc-100 bg-zinc-50/80 px-2 py-2 font-mono">
                <span className="text-zinc-800">{l.action_type}</span> · {l.status} · exp{" "}
                {new Date(l.expires_at).toLocaleString()}
                <div className="mt-1 break-all text-[11px] text-zinc-500">
                  Page:{" "}
                  {appOrigin
                    ? `${appOrigin.replace(/\/$/, "")}/external/${l.token}`
                    : `/external/${l.token}`}
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </section>
  );
}
