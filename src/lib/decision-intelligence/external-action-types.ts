/**
 * Allowed external_action_links.action_type values (V5 strategy spec §9.4).
 * Token endpoints remain scope-limited; this list is for validation on link creation.
 */
export const EXTERNAL_ACTION_TYPES = [
  "submit_evidence",
  "acknowledge_receipt",
  "structured_request_response",
  "confirm_renewal_input",
  "upload_requested_document",
  "confirm_notice_delivery",
  "amendment_intake_response",
  "complete_attestation",
  "review_decision_packet",
] as const;

export type ExternalActionType = (typeof EXTERNAL_ACTION_TYPES)[number];

export function isValidExternalActionType(value: string): value is ExternalActionType {
  return (EXTERNAL_ACTION_TYPES as readonly string[]).includes(value);
}

export function externalActionTypeValidationError(): string {
  return `Invalid actionType. Allowed values: ${EXTERNAL_ACTION_TYPES.join(", ")}`;
}
