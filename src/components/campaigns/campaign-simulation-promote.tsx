"use client";
// V7 exempt: simulation promote UI only mounted from campaign contexts; navigation targets campaigns routes.

import { useRouter } from "next/navigation";
import { useState } from "react";

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
      const res = await fetch(`/api/simulations/${id}/promote-to-campaign`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignName: campaignContextId
            ? `From simulation (${campaignContextId.slice(0, 8)})`
            : undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        campaign?: { id?: string };
      };
      if (!res.ok) throw new Error(data.error || res.statusText);
      const newId = data.campaign?.id;
      setMessage(newId ? `Created campaign ${newId}` : "Promotion completed.");
      if (newId) router.push(`/campaigns/${newId}`);
      else router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-100 bg-zinc-50/50 p-4">
      <p className="text-xs font-semibold text-zinc-700">Promote simulation to new campaign</p>
      <p className="mt-1 text-xs text-zinc-500">
        Creates a draft campaign from the latest run of the simulation you specify.
      </p>
      <input
        className="ui-input-compact mt-2 w-full"
        placeholder="Simulation UUID"
        value={simulationId}
        onChange={(e) => setSimulationId(e.target.value)}
        disabled={busy}
      />
      {error && (
        <p className="mt-2 text-xs text-rose-700" role="alert">
          {error}
        </p>
      )}
      {message && <p className="mt-2 text-xs text-emerald-700">{message}</p>}
      <button
        type="button"
        className="ui-btn-secondary mt-2 px-3 py-2 text-xs"
        disabled={busy || !simulationId.trim()}
        onClick={() => void promote()}
      >
        {busy ? "Promoting…" : "Promote"}
      </button>
    </div>
  );
}
