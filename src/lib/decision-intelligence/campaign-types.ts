/**
 * Valid portfolio campaign_type values (V5 spec §9.2, Slice B).
 * See CAMPAIGN_TYPE_STRATEGY_HINTS for strategy-spec name → type mapping.
 */
export const CAMPAIGN_TYPES = [
  "policy_rollout",
  "renewal_wave",
  "remediation_push",
  "compliance_refresh",
  "commercial_change",
  "exception_cleanup",
  "amendment_campaign",
  "data_quality_campaign",
  "owner_reassignment_campaign",
  "evidence_collection_campaign",
  "counterparty_outreach_campaign",
  "sla_remediation_campaign",
] as const;

export type CampaignType = (typeof CAMPAIGN_TYPES)[number];

export const CAMPAIGN_TYPE_LABELS: Record<CampaignType, string> = {
  policy_rollout: "Policy rollout",
  renewal_wave: "Renewal preparation wave",
  remediation_push: "Compliance remediation",
  compliance_refresh: "Compliance refresh",
  commercial_change: "Commercial change",
  exception_cleanup: "Exception cleanup",
  amendment_campaign: "Amendment campaign",
  data_quality_campaign: "Data quality campaign",
  owner_reassignment_campaign: "Owner reassignment",
  evidence_collection_campaign: "Evidence collection",
  counterparty_outreach_campaign: "Counterparty outreach",
  sla_remediation_campaign: "SLA remediation",
};

/** Oblixa V5 strategy spec §9.2 labels → stored campaign_type (for traceability / runbooks). */
export const CAMPAIGN_TYPE_STRATEGY_HINTS: { specLabel: string; campaignType: CampaignType }[] = [
  { specLabel: "Policy rollout", campaignType: "policy_rollout" },
  { specLabel: "Compliance remediation", campaignType: "remediation_push" },
  { specLabel: "Amendment campaign", campaignType: "amendment_campaign" },
  { specLabel: "Data quality campaign", campaignType: "data_quality_campaign" },
  { specLabel: "Owner reassignment campaign", campaignType: "owner_reassignment_campaign" },
  { specLabel: "Renewal preparation campaign", campaignType: "renewal_wave" },
  { specLabel: "Evidence collection campaign", campaignType: "evidence_collection_campaign" },
  { specLabel: "Counterparty outreach campaign", campaignType: "counterparty_outreach_campaign" },
  { specLabel: "SLA remediation campaign", campaignType: "sla_remediation_campaign" },
];

export function isValidCampaignType(value: string): value is CampaignType {
  return (CAMPAIGN_TYPES as readonly string[]).includes(value);
}

export function campaignTypeValidationError(): string {
  return `Invalid campaignType. Allowed values: ${CAMPAIGN_TYPES.join(", ")}`;
}
