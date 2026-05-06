"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiJsonLink } from "@/components/ui/api-json-link";
import { AsyncActionButton } from "@/components/ui/async-action-button";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import { ExternalLink } from "@/components/ui/external-link";
import { InlineMutationStatus } from "@/components/ui/inline-mutation-status";
import { mutateJson } from "@/lib/http/client-json";

// V7 exempt: campaign compare href is gated by showCompareLink from caller surface eligibility.

type Props = {
  campaignId: string;
  status: string;
  rolledBackAt?: string | null;
  /** When false, hides compare deep links (V7 compare_views module / surface). */
  showCompareLink?: boolean;
};

async function post(url: string) {
  const result = await mutateJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (!result.ok) throw new Error(result.message || "Request failed");
  return result.data;
}

export function CampaignControlPanel({ campaignId, status, rolledBackAt, showCompareLink = true }: Props) {
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
      <InlineMutationStatus message={error} variant="error" className="mt-2 text-sm" />
      <p className="ui-muted-tight mt-2">
        Preview refreshes contract rows from eligibility filters. Starting the campaign creates one open task per
        pending contract and moves those rows to in progress. Progress summaries count contract rows only.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <AsyncActionButton
          type="button"
          className="ui-btn-secondary px-3 py-2 text-xs"
          disabled={isClosed || busy !== null}
          pending={busy === "preview"}
          pendingLabel="Running…"
          onClick={() => run("preview", `/api/campaigns/${campaignId}/preview`)}
        >
          Run preview
        </AsyncActionButton>
        <AsyncActionButton
          type="button"
          className="ui-btn-secondary px-3 py-2 text-xs"
          disabled={isClosed || isActive || isPaused || busy !== null}
          pending={busy === "start"}
          pendingLabel="Starting…"
          onClick={() => run("start", `/api/campaigns/${campaignId}/start`)}
        >
          Start
        </AsyncActionButton>
        <AsyncActionButton
          type="button"
          className="ui-btn-secondary px-3 py-2 text-xs"
          disabled={isClosed || !isActive || busy !== null}
          pending={busy === "pause"}
          pendingLabel="Pausing…"
          onClick={() => run("pause", `/api/campaigns/${campaignId}/pause`)}
        >
          Pause
        </AsyncActionButton>
        <AsyncActionButton
          type="button"
          className="ui-btn-secondary px-3 py-2 text-xs"
          disabled={isClosed || !isPaused || busy !== null}
          pending={busy === "resume"}
          pendingLabel="Resuming…"
          onClick={() => run("resume", `/api/campaigns/${campaignId}/resume`)}
        >
          Resume
        </AsyncActionButton>
        <ConfirmActionButton
          type="button"
          className="ui-btn-secondary px-3 py-2 text-xs"
          disabled={isClosed || busy !== null}
          pending={busy === "close"}
          pendingLabel="Closing…"
          confirmMessage="Close this campaign?"
          onConfirm={() => run("close", `/api/campaigns/${campaignId}/close`)}
        >
          Close
        </ConfirmActionButton>
        {showCompareLink ? (
          <Link href={`/campaigns/compare?campaignA=${campaignId}`} className="ui-btn-ghost px-3 py-2 text-xs">
            Compare
          </Link>
        ) : null}
        <ApiJsonLink
          href={`/api/campaigns/${campaignId}/export?format=json`}
          className="ui-btn-ghost px-3 py-2 text-xs"
        >
          Export JSON
        </ApiJsonLink>
        <ExternalLink
          href={`/api/campaigns/${campaignId}/export?format=csv`}
          className="ui-btn-ghost px-3 py-2 text-xs"
        >
          Export CSV
        </ExternalLink>
        <ConfirmActionButton
          type="button"
          className="ui-btn-ghost px-3 py-2 text-xs text-rose-800"
          disabled={isClosed || wasRolledBack || busy !== null}
          pending={busy === "rollback"}
          pendingLabel="Rolling back…"
          confirmMessage="Rollback this campaign? This is intended as a safe recovery action."
          onConfirm={() => run("rollback", `/api/campaigns/${campaignId}/rollback`)}
        >
          Rollback (safe)
        </ConfirmActionButton>
      </div>
    </section>
  );
}
