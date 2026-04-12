"use client";

import { useState } from "react";

export function SlackRenewalSummaryForm(props: { defaultContractId?: string }) {
  const [contractId, setContractId] = useState(props.defaultContractId ?? "");
  const [outcome, setOutcome] = useState("approved_to_renew");
  const [details, setDetails] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-surface p-4 text-sm shadow-[var(--shadow-1)]">
      <p className="ui-eyebrow">Slack</p>
      <h3 className="ui-section-title mt-1 text-base">Renewal summary</h3>
      <p className="ui-muted-tight mt-1">
        Posts to your connected Slack webhook (same integration as workflow notifications).
      </p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="min-w-0">
          <input
            value={contractId}
            onChange={(e) => setContractId(e.target.value)}
            placeholder="Contract ID"
            className="ui-input w-full min-w-0 text-xs"
          />
        </div>
        <div className="min-w-0">
          <input
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            placeholder="Outcome"
            className="ui-input w-full min-w-0 text-xs"
          />
        </div>
      </div>
      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        placeholder="Optional details"
        rows={2}
        className="ui-input mt-2 w-full text-xs"
      />
      <button
        type="button"
        disabled={pending}
        className="ui-btn-secondary mt-2 px-3 py-1.5 text-xs"
        onClick={async () => {
          setMsg(null);
          setPending(true);
          try {
            const res = await fetch("/api/integrations/slack/renewal-summary", {
              method: "POST",
              credentials: "same-origin",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ contractId, outcome, details }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              setMsg(data.error ?? "Request failed");
              return;
            }
            setMsg("Posted to Slack.");
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? "Sending…" : "Send summary"}
      </button>
      {msg ? <p className="mt-2 text-xs text-zinc-600">{msg}</p> : null}
    </div>
  );
}
