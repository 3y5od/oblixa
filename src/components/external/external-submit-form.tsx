"use client";

import { useCallback, useEffect, useState } from "react";
import { AsyncActionButton } from "@/components/ui/async-action-button";
import { ExternalSubmitFields } from "@/components/external/external-submit-fields";
import {
  ExternalSubmitClosedPanel,
  ExternalSubmitExpiredPanel,
  ExternalSubmitLoadingPanel,
  ExternalSubmitMissingPanel,
  ExternalSubmitSuccessPanel,
} from "@/components/external/external-submit-status-panels";
import { InlineMutationStatus } from "@/components/ui/inline-mutation-status";
import { fetchJson, mutateJson } from "@/lib/http/client-json";
import { captureClientException } from "@/lib/observability/sentry-client";
import { surfaceTestIds } from "@/lib/qa/test-ids";

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

  const refreshStatus = useCallback(async (options?: { mode?: "blocking" | "background" }) => {
    const blocking = options?.mode !== "background";
    if (blocking) setLoading(true);
    setLoadError(null);
    try {
      const parsed = await fetchJson(`/api/external-actions/${encodeURIComponent(token)}/status`);
      if (!parsed.ok) {
        setLoadError(parsed.message);
        if (blocking) setStatus(null);
        return;
      }
      const data = parsed.data as {
        externalAction?: ExternalStatus;
      };
      const ex = data.externalAction;
      if (!ex) {
        setLoadError("Invalid status response");
        if (blocking) setStatus(null);
        return;
      }
      setStatus(ex);
      setSubmitTicket(ex.submitTicket);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load");
      if (blocking) setStatus(null);
      captureClientException(err, { extra: { surface: "ExternalSubmitForm", phase: "status" } });
    } finally {
      if (blocking) setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    function refreshOnFocus() {
      if (document.hidden || loading || busy || done) return;
      void refreshStatus({ mode: "background" });
    }

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnFocus);
    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnFocus);
    };
  }, [busy, done, loading, refreshStatus]);

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
      const parsed = await mutateJson(`/api/external-actions/${encodeURIComponent(token)}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!parsed.ok) {
        setError(parsed.message);
        await refreshStatus();
        return;
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      captureClientException(err, { extra: { surface: "ExternalSubmitForm", phase: "submit" } });
      await refreshStatus();
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return <ExternalSubmitSuccessPanel />;
  }

  if (loading) {
    return <ExternalSubmitLoadingPanel />;
  }

  if (!status) {
    return <ExternalSubmitMissingPanel loadError={loadError} onRetry={() => void refreshStatus()} />;
  }

  if (status.expired || status.status === "expired") {
    return <ExternalSubmitExpiredPanel />;
  }

  if (status.status !== "open") {
    return <ExternalSubmitClosedPanel status={status.status} />;
  }

  const actionLabel = status.action_type.replace(/_/g, " ");

  return (
    <form
      onSubmit={onSubmit}
      data-testid={surfaceTestIds.externalSubmitForm}
      className="ui-page-shell mx-auto max-w-lg space-y-5 p-6 sm:p-8"
    >
      <div>
        <p className="ui-eyebrow">External workflow</p>
        <h1 className="ui-page-title mt-2 text-[1.7rem]">External response</h1>
        <p className="ui-meta mt-1">Action: {actionLabel}</p>
        <p className="ui-section-lead mt-2">Complete the request, then submit once.</p>
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
          <div className="ui-soft-details mt-3 text-xs text-[var(--text-secondary)]">
            <p className="font-semibold text-[var(--text-primary)]">Workflow progress</p>
            {status.workflow_deadline_iso ? (
              <p className="mt-1 text-[var(--text-secondary)]">
                Acknowledge by: {new Date(status.workflow_deadline_iso).toLocaleString()}
              </p>
            ) : null}
            {status.workflow_ack_required ? (
              <p className="ui-alert-warning mt-2 text-xs" role="status">
                Acknowledgement is required for this chain.
              </p>
            ) : null}
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-[11px] text-[var(--text-secondary)]">
              {(status.workflow_chain ?? []).map((step, i) => (
                <li key={`${step.at ?? i}-${i}`}>
                  <span className="font-medium text-[var(--text-primary)]">{String(step.type ?? "step")}</span>
                  {step.at ? <span className="text-[var(--text-tertiary)]"> · {step.at}</span> : null}
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
      <InlineMutationStatus message={loadError ? `Latest status could not be refreshed: ${loadError}` : null} variant="warning" />
      <InlineMutationStatus message={error} variant="error" />

      <label className="block text-xs font-medium text-[var(--text-secondary)]">
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

      <ExternalSubmitFields
        actionType={status.action_type}
        message={message}
        setMessage={setMessage}
        response={response}
        setResponse={setResponse}
        summary={summary}
        setSummary={setSummary}
        statement={statement}
        setStatement={setStatement}
        attestationReference={attestationReference}
        setAttestationReference={setAttestationReference}
        evidenceReference={evidenceReference}
        setEvidenceReference={setEvidenceReference}
        documentDescription={documentDescription}
        setDocumentDescription={setDocumentDescription}
        fileName={fileName}
        setFileName={setFileName}
        reference={reference}
        setReference={setReference}
        renewalNote={renewalNote}
        setRenewalNote={setRenewalNote}
        comments={comments}
        setComments={setComments}
        acknowledged={acknowledged}
        setAcknowledged={setAcknowledged}
        confirmed={confirmed}
        setConfirmed={setConfirmed}
        delivered={delivered}
        setDelivered={setDelivered}
        reviewed={reviewed}
        setReviewed={setReviewed}
      />

      <AsyncActionButton type="submit" className="ui-btn-primary min-h-12 w-full text-[14px]" pending={busy} pendingLabel="Submitting...">
        Submit
      </AsyncActionButton>
    </form>
  );
}
