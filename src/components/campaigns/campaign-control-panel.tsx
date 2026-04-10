"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  campaignId: string;
  status: string;
  rolledBackAt?: string | null;
};

async function post(url: string) {
  const res = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export function CampaignControlPanel({ campaignId, status, rolledBackAt }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(key: string, url: string) {
    setBusy(key);
    setError(null);
    try {
      await post(url);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(null);
    }
  }

  const isClosed = status === "closed";
  const isActive = status === "active";
  const isPaused = status === "paused";
  const wasRolledBack = Boolean(rolledBackAt);

  return (
    <section className="ui-card p-5">
      <p className="ui-eyebrow">Campaign</p>
      <h2 className="ui-section-title mt-1 text-base">Campaign controls</h2>
      {error && (
        <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
          {error}
        </p>
      )}
      <p className="ui-muted-tight mt-2">
        Preview refreshes contract rows from eligibility filters. Starting the campaign creates one open task per
        pending contract and moves those rows to in progress. Progress summaries count contract rows only.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="ui-btn-secondary px-3 py-2 text-xs"
          disabled={isClosed || busy !== null}
          onClick={() => run("preview", `/api/campaigns/${campaignId}/preview`)}
        >
          {busy === "preview" ? "…" : "Run preview"}
        </button>
        <button
          type="button"
          className="ui-btn-secondary px-3 py-2 text-xs"
          disabled={isClosed || isActive || isPaused || busy !== null}
          onClick={() => run("start", `/api/campaigns/${campaignId}/start`)}
        >
          {busy === "start" ? "…" : "Start"}
        </button>
        <button
          type="button"
          className="ui-btn-secondary px-3 py-2 text-xs"
          disabled={isClosed || !isActive || busy !== null}
          onClick={() => run("pause", `/api/campaigns/${campaignId}/pause`)}
        >
          {busy === "pause" ? "…" : "Pause"}
        </button>
        <button
          type="button"
          className="ui-btn-secondary px-3 py-2 text-xs"
          disabled={isClosed || !isPaused || busy !== null}
          onClick={() => run("resume", `/api/campaigns/${campaignId}/resume`)}
        >
          {busy === "resume" ? "…" : "Resume"}
        </button>
        <button
          type="button"
          className="ui-btn-secondary px-3 py-2 text-xs"
          disabled={isClosed || busy !== null}
          onClick={() => run("close", `/api/campaigns/${campaignId}/close`)}
        >
          {busy === "close" ? "…" : "Close"}
        </button>
        <Link href={`/campaigns/compare?campaignA=${campaignId}`} className="ui-btn-ghost px-3 py-2 text-xs">
          Compare
        </Link>
        <Link
          href={`/api/campaigns/${campaignId}/export?format=json`}
          className="ui-btn-ghost px-3 py-2 text-xs"
          target="_blank"
        >
          Export JSON
        </Link>
        <Link
          href={`/api/campaigns/${campaignId}/export?format=csv`}
          className="ui-btn-ghost px-3 py-2 text-xs"
          target="_blank"
        >
          Export CSV
        </Link>
        <button
          type="button"
          className="ui-btn-ghost px-3 py-2 text-xs text-rose-800"
          disabled={isClosed || wasRolledBack || busy !== null}
          onClick={() => run("rollback", `/api/campaigns/${campaignId}/rollback`)}
        >
          {busy === "rollback" ? "…" : "Rollback (safe)"}
        </button>
      </div>
    </section>
  );
}
