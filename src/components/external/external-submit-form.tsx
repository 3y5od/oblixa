"use client";

import { useCallback, useEffect, useState } from "react";

type Props = {
  token: string;
};

type WorkflowStep = { type?: string; at?: string; payload?: Record<string, unknown> };

type ExternalStatus = {
  action_type: string;
  status: string;
  expired: boolean;
  requires_passcode: boolean;
  submitTicket?: string;
  reauth_instructions?: string;
  workflow_chain?: WorkflowStep[];
  workflow_deadline_iso?: string | null;
  workflow_ack_required?: boolean;
  correction_message?: string | null;
};

function buildSubmitBody(
  actionType: string,
  fields: {
    message: string;
    response: string;
    summary: string;
    statement: string;
    attestationReference: string;
    evidenceReference: string;
    documentDescription: string;
    fileName: string;
    reference: string;
    renewalNote: string;
    comments: string;
    acknowledged: boolean;
    confirmed: boolean;
    delivered: boolean;
    reviewed: boolean;
  }
): Record<string, unknown> {
  switch (actionType) {
    case "submit_evidence":
      return {
        message: fields.message.trim() || "Submitted via external form.",
        ...(fields.evidenceReference.trim() ? { evidenceReference: fields.evidenceReference.trim() } : {}),
      };
    case "acknowledge_receipt":
      return { acknowledged: fields.acknowledged, ...(fields.reference.trim() ? { reference: fields.reference.trim() } : {}) };
    case "structured_request_response":
      return { response: fields.response.trim() };
    case "confirm_renewal_input":
      return {
        confirmed: fields.confirmed,
        ...(fields.renewalNote.trim() ? { renewalNote: fields.renewalNote.trim() } : {}),
      };
    case "upload_requested_document":
      return {
        ...(fields.documentDescription.trim()
          ? { documentDescription: fields.documentDescription.trim() }
          : {}),
        ...(fields.fileName.trim() ? { fileName: fields.fileName.trim() } : {}),
      };
    case "confirm_notice_delivery":
      return { delivered: fields.delivered, ...(fields.reference.trim() ? { reference: fields.reference.trim() } : {}) };
    case "amendment_intake_response":
      return { summary: fields.summary.trim() };
    case "complete_attestation":
      return {
        ...(fields.statement.trim() ? { statement: fields.statement.trim() } : {}),
        ...(fields.attestationReference.trim()
          ? { attestationReference: fields.attestationReference.trim() }
          : {}),
      };
    case "review_decision_packet":
      return {
        reviewed: fields.reviewed,
        ...(fields.comments.trim() ? { comments: fields.comments.trim() } : {}),
      };
    default:
      return { message: fields.message.trim() || "Submitted via external form." };
  }
}

export function ExternalSubmitForm({ token }: Props) {
  const [status, setStatus] = useState<ExternalStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [submitTicket, setSubmitTicket] = useState<string | undefined>(undefined);
  const [passcode, setPasscode] = useState("");
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState("");
  const [summary, setSummary] = useState("");
  const [statement, setStatement] = useState("");
  const [attestationReference, setAttestationReference] = useState("");
  const [evidenceReference, setEvidenceReference] = useState("");
  const [documentDescription, setDocumentDescription] = useState("");
  const [fileName, setFileName] = useState("");
  const [reference, setReference] = useState("");
  const [renewalNote, setRenewalNote] = useState("");
  const [comments, setComments] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [delivered, setDelivered] = useState(false);
  const [reviewed, setReviewed] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const refreshStatus = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/external-actions/${encodeURIComponent(token)}/status`);
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        externalAction?: ExternalStatus;
      };
      if (!res.ok) {
        throw new Error(data.error || `Could not load link (${res.status})`);
      }
      const ex = data.externalAction;
      if (!ex) throw new Error("Invalid status response");
      setStatus(ex);
      setSubmitTicket(ex.submitTicket);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const fields = {
    message,
    response,
    summary,
    statement,
    attestationReference,
    evidenceReference,
    documentDescription,
    fileName,
    reference,
    renewalNote,
    comments,
    acknowledged,
    confirmed,
    delivered,
    reviewed,
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!status) return;
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = buildSubmitBody(status.action_type, fields);
      if (passcode.trim()) body.passcode = passcode.trim();
      if (submitTicket) body.submitTicket = submitTicket;
      const res = await fetch(`/api/external-actions/${encodeURIComponent(token)}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      await refreshStatus();
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="ui-alert-success p-8 text-center">
        <p className="text-lg font-semibold text-emerald-900">Thank you</p>
        <p className="mt-2 text-sm text-emerald-800/90">Your response was recorded. You can close this page.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="ui-card mx-auto max-w-md p-8 text-center text-sm text-zinc-600">
        Loading request…
      </div>
    );
  }

  if (loadError || !status) {
    return (
      <div className="ui-card mx-auto max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold text-zinc-900">External response</h1>
        <p className="ui-alert-error mt-3">{loadError || "Unable to load this link."}</p>
      </div>
    );
  }

  if (status.expired || status.status === "expired") {
    return (
      <div className="ui-card mx-auto max-w-md p-8 text-center text-sm text-zinc-600">
        This link has expired. Contact your Oblixa administrator for a new request.
      </div>
    );
  }

  if (status.status !== "open") {
    return (
      <div className="ui-card mx-auto max-w-md p-8 text-center text-sm text-zinc-600">
        This request is no longer open (status: {status.status}).
      </div>
    );
  }

  const actionLabel = status.action_type.replace(/_/g, " ");

  return (
    <form
      onSubmit={onSubmit}
      className="ui-card mx-auto max-w-md space-y-4 p-8"
    >
      <div>
        <p className="ui-kicker">External workflow</p>
        <h1 className="text-xl font-semibold text-zinc-900">External response</h1>
        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-zinc-500">Action: {actionLabel}</p>
        <p className="mt-2 text-sm text-zinc-600">Complete the request, then submit once.</p>
        {status.reauth_instructions ? (
          <p className="ui-alert-warning mt-2">
            {status.reauth_instructions}
          </p>
        ) : null}
        {status.correction_message ? (
          <p className="ui-alert-error mt-2">
            <span className="font-semibold">Please correct: </span>
            {status.correction_message}
          </p>
        ) : null}
        {(status.workflow_chain?.length ?? 0) > 0 ||
        status.workflow_deadline_iso ||
        status.workflow_ack_required ? (
          <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-2 text-xs text-zinc-700">
            <p className="font-semibold text-zinc-800">Workflow progress</p>
            {status.workflow_deadline_iso ? (
              <p className="mt-1 text-zinc-600">
                Acknowledge by: {new Date(status.workflow_deadline_iso).toLocaleString()}
              </p>
            ) : null}
            {status.workflow_ack_required ? (
              <p className="mt-1 text-amber-800">Acknowledgement is required for this chain.</p>
            ) : null}
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-[11px] text-zinc-600">
              {(status.workflow_chain ?? []).map((step, i) => (
                <li key={`${step.at ?? i}-${i}`}>
                  <span className="font-medium text-zinc-800">{String(step.type ?? "step")}</span>
                  {step.at ? <span className="text-zinc-500"> · {step.at}</span> : null}
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
      {error ? (
        <p className="ui-alert-error" role="alert">
          {error}
        </p>
      ) : null}

      <label className="block text-xs font-medium text-zinc-700">
        Passcode {status.requires_passcode ? "(required)" : "(if required)"}
        <input
          type="password"
          className="ui-input mt-1 w-full"
          value={passcode}
          onChange={(ev) => setPasscode(ev.target.value)}
          autoComplete="one-time-code"
          required={status.requires_passcode}
        />
      </label>

      {status.action_type === "submit_evidence" ? (
        <>
          <label className="block text-xs font-medium text-zinc-700">
            Message or notes
            <textarea
              className="ui-input mt-1 min-h-[100px] w-full resize-y"
              value={message}
              onChange={(ev) => setMessage(ev.target.value)}
            />
          </label>
          <label className="block text-xs font-medium text-zinc-700">
            Evidence reference (optional)
            <input
              className="ui-input mt-1 w-full"
              value={evidenceReference}
              onChange={(ev) => setEvidenceReference(ev.target.value)}
            />
          </label>
        </>
      ) : null}

      {status.action_type === "acknowledge_receipt" ? (
        <>
          <label className="flex items-center gap-2 text-sm text-zinc-800">
            <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} />
            I acknowledge receipt
          </label>
          <label className="block text-xs font-medium text-zinc-700">
            Reference (optional)
            <input className="ui-input mt-1 w-full" value={reference} onChange={(e) => setReference(e.target.value)} />
          </label>
        </>
      ) : null}

      {status.action_type === "structured_request_response" ? (
        <label className="block text-xs font-medium text-zinc-700">
          Your response
          <textarea
            className="ui-input mt-1 min-h-[120px] w-full resize-y"
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            required
          />
        </label>
      ) : null}

      {status.action_type === "confirm_renewal_input" ? (
        <>
          <label className="flex items-center gap-2 text-sm text-zinc-800">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            I confirm the renewal input is accurate
          </label>
          <label className="block text-xs font-medium text-zinc-700">
            Notes (optional)
            <textarea className="ui-input mt-1 w-full resize-y" value={renewalNote} onChange={(e) => setRenewalNote(e.target.value)} />
          </label>
        </>
      ) : null}

      {status.action_type === "upload_requested_document" ? (
        <>
          <label className="block text-xs font-medium text-zinc-700">
            Document description
            <textarea
              className="ui-input mt-1 w-full resize-y"
              value={documentDescription}
              onChange={(e) => setDocumentDescription(e.target.value)}
            />
          </label>
          <label className="block text-xs font-medium text-zinc-700">
            File name (if applicable)
            <input className="ui-input mt-1 w-full" value={fileName} onChange={(e) => setFileName(e.target.value)} />
          </label>
        </>
      ) : null}

      {status.action_type === "confirm_notice_delivery" ? (
        <>
          <label className="flex items-center gap-2 text-sm text-zinc-800">
            <input type="checkbox" checked={delivered} onChange={(e) => setDelivered(e.target.checked)} />
            I confirm delivery
          </label>
          <label className="block text-xs font-medium text-zinc-700">
            Reference (optional)
            <input className="ui-input mt-1 w-full" value={reference} onChange={(e) => setReference(e.target.value)} />
          </label>
        </>
      ) : null}

      {status.action_type === "amendment_intake_response" ? (
        <label className="block text-xs font-medium text-zinc-700">
          Summary
          <textarea
            className="ui-input mt-1 min-h-[120px] w-full resize-y"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            required
          />
        </label>
      ) : null}

      {status.action_type === "complete_attestation" ? (
        <>
          <label className="block text-xs font-medium text-zinc-700">
            Statement
            <textarea className="ui-input mt-1 w-full resize-y" value={statement} onChange={(e) => setStatement(e.target.value)} />
          </label>
          <label className="block text-xs font-medium text-zinc-700">
            Reference (optional)
            <input
              className="ui-input mt-1 w-full"
              value={attestationReference}
              onChange={(e) => setAttestationReference(e.target.value)}
            />
          </label>
        </>
      ) : null}

      {status.action_type === "review_decision_packet" ? (
        <>
          <label className="flex items-center gap-2 text-sm text-zinc-800">
            <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} />
            I have reviewed the decision packet
          </label>
          <label className="block text-xs font-medium text-zinc-700">
            Comments (optional)
            <textarea className="ui-input mt-1 w-full resize-y" value={comments} onChange={(e) => setComments(e.target.value)} />
          </label>
        </>
      ) : null}

      <button type="submit" className="ui-btn-primary w-full" disabled={busy}>
        {busy ? "Submitting…" : "Submit"}
      </button>
    </form>
  );
}
