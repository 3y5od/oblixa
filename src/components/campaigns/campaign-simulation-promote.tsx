"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AsyncActionButton } from "@/components/ui/async-action-button";
import { InlineMutationStatus } from "@/components/ui/inline-mutation-status";
import { LiveRegion } from "@/components/ui/live-region";
import { mutateJson } from "@/lib/http/client-json";
import { pushAppHref } from "@/lib/navigation/client-navigation";

type Props = { campaignContextId?: string };

export function CampaignSimulationPromote({ campaignContextId }: Props) {
  const router = useRouter();
  const [simulationId, setSimulationId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function promote() {
    const id = simulationId.trim();
    if (!id) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await mutateJson<{
        error?: string;
        campaign?: { id?: string };
      }>(`/api/simulations/${id}/promote-to-campaign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignName: campaignContextId
            ? `From simulation (${campaignContextId.slice(0, 8)})`
            : undefined,
        }),
      });
      if (!result.ok) throw new Error(result.message);
      const newId = result.data.campaign?.id;
      setMessage(newId ? `Created campaign ${newId}` : "Promotion completed.");
      if (newId) {
        if (!pushAppHref(router, `/campaigns/${newId}`)) {
          setError("The campaign was created, but it could not be opened automatically.");
        }
      } else {
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] p-4">
      <p className="text-xs font-semibold text-[var(--text-secondary)]">Promote simulation to new campaign</p>
      <p className="mt-1 text-xs text-[var(--text-tertiary)]">
        Creates a draft campaign from the latest run of the simulation you specify.
      </p>
      <input aria-label="Simulation UUID" className="ui-input-compact mt-2 w-full"
        placeholder="Simulation UUID"
        value={simulationId}
        onChange={(e) => setSimulationId(e.target.value)}
        disabled={busy}
      />
      <LiveRegion
        message={busy ? "Promoting simulation to a campaign." : error ?? message ?? undefined}
        politeness={error ? "assertive" : "polite"}
      />
      <InlineMutationStatus message={error} variant="error" className="mt-2 text-xs" />
      <InlineMutationStatus message={message} variant="success" className="mt-2 text-xs" />
      <AsyncActionButton
        type="button"
        className="ui-btn-secondary mt-2 px-3 py-2 text-xs"
        disabled={!simulationId.trim()}
        pending={busy}
        pendingLabel="Promoting…"
        onClick={() => void promote()}
      >
        Promote
      </AsyncActionButton>
    </div>
  );
}
