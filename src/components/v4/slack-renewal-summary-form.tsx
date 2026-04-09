"use client";

import { useState } from "react";

export function SlackRenewalSummaryForm(props: { defaultContractId?: string }) {
  const [contractId, setContractId] = useState(props.defaultContractId ?? "");
  const [outcome, setOutcome] = useState("approved_to_renew");
  const [details, setDetails] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 text-sm">
      <p className="ui-label-caps">Slack · renewal summary</p>
      <p className="mt-1 text-xs text-zinc-500">
        Posts to your connected Slack webhook (same integration as workflow notifications).
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <input
          value={contractId}
          onChange={(e) => setContractId(e.target.value)}
          placeholder="Contract ID"
          className="ui-input text-xs"
        />
        <input
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          placeholder="Outcome"
          className="ui-input text-xs"
        />
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
