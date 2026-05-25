import { toSafeString } from "@/lib/decision-intelligence/api";
import type { ExternalActionType } from "@/lib/decision-intelligence/external-action-types";

export type ExternalPayloadResult =
  | { ok: true; normalized: Record<string, unknown> }
  | { ok: false; error: string };

/**
 * Validates external submit JSON per action_type. Returns normalized fields stored in
 * submitted_payload_json (excluding passcode and submitTicket).
 */
export function validateExternalActionPayload(
  actionType: ExternalActionType,
  payload: Record<string, unknown>
): ExternalPayloadResult {
  const msg = (k: string) => toSafeString(payload[k]);
  const bool = (k: string): boolean | null => {
    const v = payload[k];
    if (v === true) return true;
    if (v === false) return false;
    return null;
  };

  switch (actionType) {
    case "submit_evidence": {
      const message = msg("message") || msg("notes");
      const evidenceReference = msg("evidenceReference");
      if (!message && !evidenceReference) {
        return { ok: false, error: "Provide message, notes, or evidenceReference for evidence submission." };
      }
      return {
        ok: true,
        normalized: {
          ...(message ? { message } : {}),
          ...(evidenceReference ? { evidenceReference } : {}),
        },
      };
    }
    case "acknowledge_receipt": {
      const acknowledged = bool("acknowledged");
      if (acknowledged !== true) {
        return { ok: false, error: "acknowledged must be true to acknowledge receipt." };
      }
      const reference = msg("reference");
      return { ok: true, normalized: { acknowledged: true, ...(reference ? { reference } : {}) } };
    }
    case "structured_request_response": {
      const response = msg("response");
      if (response.length < 1) {
        return { ok: false, error: "response is required (non-empty string)." };
      }
      return { ok: true, normalized: { response } };
    }
    case "confirm_renewal_input": {
      const confirmed = bool("confirmed");
      if (confirmed !== true) {
        return { ok: false, error: "confirmed must be true to confirm renewal input." };
      }
      const renewalNote = msg("renewalNote");
      return { ok: true, normalized: { confirmed: true, ...(renewalNote ? { renewalNote } : {}) } };
    }
    case "upload_requested_document": {
      const documentDescription = msg("documentDescription");
      const fileName = msg("fileName");
      if (documentDescription.length < 1 && fileName.length < 1) {
        return {
          ok: false,
          error: "Provide documentDescription and/or fileName (what you are uploading).",
        };
      }
      return {
        ok: true,
        normalized: {
          ...(documentDescription ? { documentDescription } : {}),
          ...(fileName ? { fileName } : {}),
        },
      };
    }
    case "confirm_notice_delivery": {
      const delivered = bool("delivered");
      if (delivered !== true) {
        return { ok: false, error: "delivered must be true to confirm notice delivery." };
      }
      const reference = msg("reference");
      return { ok: true, normalized: { delivered: true, ...(reference ? { reference } : {}) } };
    }
    case "amendment_intake_response": {
      const summary = msg("summary");
      if (summary.length < 1) {
        return { ok: false, error: "summary is required for amendment intake response." };
      }
      return { ok: true, normalized: { summary } };
    }
    case "complete_attestation": {
      const statement = msg("statement");
      const attestationReference = msg("attestationReference");
      if (statement.length < 1 && attestationReference.length < 1) {
        return {
          ok: false,
          error: "Provide statement or attestationReference to complete attestation.",
        };
      }
      return {
        ok: true,
        normalized: {
          ...(statement ? { statement } : {}),
          ...(attestationReference ? { attestationReference } : {}),
        },
      };
    }
    case "review_decision_packet": {
      const reviewed = bool("reviewed");
      if (reviewed !== true) {
        return { ok: false, error: "reviewed must be true after reviewing the packet." };
      }
      const comments = msg("comments");
      return { ok: true, normalized: { reviewed: true, ...(comments ? { comments } : {}) } };
    }
    default: {
      const _exhaustive: never = actionType;
      return { ok: false, error: `Unsupported action type: ${_exhaustive}` };
    }
  }
}
