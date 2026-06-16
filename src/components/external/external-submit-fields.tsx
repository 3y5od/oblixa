"use client";

import type { Dispatch, SetStateAction } from "react";

type ExternalSubmitFieldsProps = {
  actionType: string;
  message: string;
  setMessage: Dispatch<SetStateAction<string>>;
  response: string;
  setResponse: Dispatch<SetStateAction<string>>;
  summary: string;
  setSummary: Dispatch<SetStateAction<string>>;
  statement: string;
  setStatement: Dispatch<SetStateAction<string>>;
  attestationReference: string;
  setAttestationReference: Dispatch<SetStateAction<string>>;
  evidenceReference: string;
  setEvidenceReference: Dispatch<SetStateAction<string>>;
  documentDescription: string;
  setDocumentDescription: Dispatch<SetStateAction<string>>;
  fileName: string;
  setFileName: Dispatch<SetStateAction<string>>;
  reference: string;
  setReference: Dispatch<SetStateAction<string>>;
  renewalNote: string;
  setRenewalNote: Dispatch<SetStateAction<string>>;
  comments: string;
  setComments: Dispatch<SetStateAction<string>>;
  acknowledged: boolean;
  setAcknowledged: Dispatch<SetStateAction<boolean>>;
  confirmed: boolean;
  setConfirmed: Dispatch<SetStateAction<boolean>>;
  delivered: boolean;
  setDelivered: Dispatch<SetStateAction<boolean>>;
  reviewed: boolean;
  setReviewed: Dispatch<SetStateAction<boolean>>;
};

export function ExternalSubmitFields(props: ExternalSubmitFieldsProps) {
  const {
    actionType,
    message,
    setMessage,
    response,
    setResponse,
    summary,
    setSummary,
    statement,
    setStatement,
    attestationReference,
    setAttestationReference,
    evidenceReference,
    setEvidenceReference,
    documentDescription,
    setDocumentDescription,
    fileName,
    setFileName,
    reference,
    setReference,
    renewalNote,
    setRenewalNote,
    comments,
    setComments,
    acknowledged,
    setAcknowledged,
    confirmed,
    setConfirmed,
    delivered,
    setDelivered,
    reviewed,
    setReviewed,
  } = props;

  return (
    <>
      {actionType === "submit_evidence" ? (
        <>
          <label className="block text-xs font-medium text-[var(--text-secondary)]">
            Message or notes
            <textarea
              className="ui-input mt-1 min-h-[100px] w-full resize-y"
              value={message}
              onChange={(ev) => setMessage(ev.target.value)}
            />
          </label>
          <label className="block text-xs font-medium text-[var(--text-secondary)]">
            Evidence reference (optional)
            <input
              className="ui-input mt-1 w-full"
              value={evidenceReference}
              onChange={(ev) => setEvidenceReference(ev.target.value)}
            />
          </label>
        </>
      ) : null}

      {actionType === "acknowledge_receipt" ? (
        <>
          <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
            <input type="checkbox" className="ui-checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} />
            I acknowledge receipt
          </label>
          <label className="block text-xs font-medium text-[var(--text-secondary)]">
            Reference (optional)
            <input className="ui-input mt-1 w-full" value={reference} onChange={(e) => setReference(e.target.value)} />
          </label>
        </>
      ) : null}

      {actionType === "structured_request_response" ? (
        <label className="block text-xs font-medium text-[var(--text-secondary)]">
          Your response
          <textarea
            className="ui-input mt-1 min-h-[120px] w-full resize-y"
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            required
          />
        </label>
      ) : null}

      {actionType === "confirm_renewal_input" ? (
        <>
          <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
            <input type="checkbox" className="ui-checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            I confirm the renewal input is accurate
          </label>
          <label className="block text-xs font-medium text-[var(--text-secondary)]">
            Notes (optional)
            <textarea className="ui-input mt-1 w-full resize-y" value={renewalNote} onChange={(e) => setRenewalNote(e.target.value)} />
          </label>
        </>
      ) : null}

      {actionType === "upload_requested_document" ? (
        <>
          <label className="block text-xs font-medium text-[var(--text-secondary)]">
            Document description
            <textarea
              className="ui-input mt-1 w-full resize-y"
              value={documentDescription}
              onChange={(e) => setDocumentDescription(e.target.value)}
            />
          </label>
          <label className="block text-xs font-medium text-[var(--text-secondary)]">
            File name (if applicable)
            <input className="ui-input mt-1 w-full" value={fileName} onChange={(e) => setFileName(e.target.value)} />
          </label>
        </>
      ) : null}

      {actionType === "confirm_notice_delivery" ? (
        <>
          <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
            <input type="checkbox" className="ui-checkbox" checked={delivered} onChange={(e) => setDelivered(e.target.checked)} />
            I confirm delivery
          </label>
          <label className="block text-xs font-medium text-[var(--text-secondary)]">
            Reference (optional)
            <input className="ui-input mt-1 w-full" value={reference} onChange={(e) => setReference(e.target.value)} />
          </label>
        </>
      ) : null}

      {actionType === "amendment_intake_response" ? (
        <label className="block text-xs font-medium text-[var(--text-secondary)]">
          Summary
          <textarea
            className="ui-input mt-1 min-h-[120px] w-full resize-y"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            required
          />
        </label>
      ) : null}

      {actionType === "complete_attestation" ? (
        <>
          <label className="block text-xs font-medium text-[var(--text-secondary)]">
            Statement
            <textarea className="ui-input mt-1 w-full resize-y" value={statement} onChange={(e) => setStatement(e.target.value)} />
          </label>
          <label className="block text-xs font-medium text-[var(--text-secondary)]">
            Reference (optional)
            <input
              className="ui-input mt-1 w-full"
              value={attestationReference}
              onChange={(e) => setAttestationReference(e.target.value)}
            />
          </label>
        </>
      ) : null}

      {actionType === "review_decision_packet" ? (
        <>
          <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
            <input type="checkbox" className="ui-checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} />
            I have reviewed the decision packet
          </label>
          <label className="block text-xs font-medium text-[var(--text-secondary)]">
            Comments (optional)
            <textarea className="ui-input mt-1 w-full resize-y" value={comments} onChange={(e) => setComments(e.target.value)} />
          </label>
        </>
      ) : null}
    </>
  );
}
