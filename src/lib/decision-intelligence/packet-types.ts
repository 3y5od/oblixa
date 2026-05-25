/** Allowed decision packet export types (V5 §9.7, Slice E). */
export const PACKET_TYPES = [
  "renewal_packet",
  "amendment_packet",
  "exception_packet",
  "campaign_summary_packet",
  "policy_impact_packet",
  "termination_packet",
  "remediation_packet",
  "account_risk_packet",
  "evidence_pack_packet",
  "manager_review_packet",
] as const;

export type PacketType = (typeof PACKET_TYPES)[number];

/** Short labels for packet type pickers and exports. */
export const PACKET_TYPE_LABELS: Record<PacketType, string> = {
  renewal_packet: "Renewal",
  amendment_packet: "Amendment",
  exception_packet: "Exception / waiver",
  campaign_summary_packet: "Campaign summary",
  policy_impact_packet: "Policy impact",
  termination_packet: "Termination",
  remediation_packet: "Remediation",
  account_risk_packet: "Account risk",
  evidence_pack_packet: "Evidence pack",
  manager_review_packet: "Manager review",
};

export function isValidPacketType(value: string): value is PacketType {
  return (PACKET_TYPES as readonly string[]).includes(value);
}

export function packetTypeValidationError(): string {
  return `Invalid packetType. Allowed values: ${PACKET_TYPES.join(", ")}`;
}

/** Default catalog hints when no DB template row is supplied (export is JSON v1; see traceability §9.7). */
export const PACKET_TYPE_TEMPLATE_HINTS: Record<PacketType, string> = {
  renewal_packet: "Renewal summary, linked contracts, rationale, and recommendation snapshot.",
  amendment_packet: "Amendment scope, affected obligations, and approval path context.",
  exception_packet: "Exception narrative, policy position, and disposition fields.",
  campaign_summary_packet: "Portfolio campaign linkage and rollout status excerpt.",
  policy_impact_packet: "Policy registry alignment and simulated impact notes.",
  termination_packet: "Termination drivers, wind-down tasks, and stakeholder list.",
  remediation_packet: "Remediation acceptance criteria and evidence pointers.",
  account_risk_packet: "Account-level exposure, open exceptions, and obligation concentration.",
  evidence_pack_packet: "Evidence gaps, attestation status, and requested artifacts list.",
  manager_review_packet: "Decision queue summary, SLA posture, and recommendation highlights.",
};
