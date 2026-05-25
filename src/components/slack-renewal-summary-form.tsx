"use client";

import { useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import { AsyncActionButton } from "@/components/ui/async-action-button";
import { InlineMutationStatus } from "@/components/ui/inline-mutation-status";
import { StatusBadge } from "@/components/ui/status-badge";
import { mutateJson } from "@/lib/http/client-json";

export function SlackRenewalSummaryForm(props: { defaultContractId?: string }) {
  const [contractId, setContractId] = useState(props.defaultContractId ?? "");
  const [outcome, setOutcome] = useState("approved_to_renew");
  const [details, setDetails] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <div className="ui-card h-full p-5 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="ui-icon-tile-compact shrink-0">
            <MessageSquare className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="ui-eyebrow">Slack</p>
            <h3 className="ui-section-title mt-1 text-base">Renewal summary</h3>
            <p className="ui-support-copy mt-1">
              Post the outcome summary to your connected Slack webhook.
            </p>
          </div>
        </div>
        <StatusBadge status="healthy">Available</StatusBadge>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <label htmlFor="slack-renewal-contract-id" className="ui-label-caps">
            Contract ID
          </label>
          <input
            id="slack-renewal-contract-id"
            value={contractId}
            onChange={(e) => setContractId(e.target.value)}
            placeholder="Contract ID"
            className="ui-input mt-1 w-full min-w-0 text-xs"
          />
        </div>
        <div className="min-w-0">
          <label htmlFor="slack-renewal-outcome" className="ui-label-caps">
            Outcome
          </label>
          <input
            id="slack-renewal-outcome"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            placeholder="Outcome"
            className="ui-input mt-1 w-full min-w-0 text-xs"
          />
        </div>
      </div>
      <label htmlFor="slack-renewal-details" className="ui-label-caps mt-3 block">
        Optional details
      </label>
      <textarea
        id="slack-renewal-details"
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        placeholder="Optional details"
        rows={2}
        className="ui-input mt-1 w-full text-xs"
      />
      <AsyncActionButton
        type="button"
        className="ui-btn-secondary mt-3 px-3 py-1.5 text-xs disabled:opacity-50"
        pending={pending}
        pendingLabel={<><Send className="mr-1.5 inline h-3.5 w-3.5" aria-hidden />Sending…</>}
        onClick={async () => {
          setMsg(null);
          setPending(true);
          try {
            const result = await mutateJson("/api/integrations/slack/renewal-summary", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ contractId, outcome, details }),
            });
            if (!result.ok) {
              setMsg(result.message ?? "Request failed");
              return;
            }
            setMsg("Posted to Slack.");
          } finally {
            setPending(false);
          }
        }}
      >
        <Send className="mr-1.5 inline h-3.5 w-3.5" aria-hidden />
        Send summary
      </AsyncActionButton>
      <InlineMutationStatus
        message={msg}
        variant={msg === "Posted to Slack." ? "success" : "error"}
        className="mt-3 text-xs"
      />
    </div>
  );
}
