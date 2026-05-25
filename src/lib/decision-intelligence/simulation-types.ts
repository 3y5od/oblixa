/**
 * Supported change_simulations.simulation_type values (V5 strategy spec §9.6).
 * Metrics share a common matrix; `simulation_focus` in result_json differentiates intent.
 */
export const SIMULATION_TYPES = [
  "campaign_eligibility_impact",
  "program_update_impact",
  "approval_sla_change_impact",
  "evidence_requirement_rollout_impact",
  "escalation_policy_change_impact",
  "renewal_playbook_change_impact",
  "routing_policy_change_impact",
  "reporting_cadence_impact",
] as const;

export type SimulationType = (typeof SIMULATION_TYPES)[number];

export function isValidSimulationType(value: string): value is SimulationType {
  return (SIMULATION_TYPES as readonly string[]).includes(value);
}

export function simulationTypeValidationError(): string {
  return `Invalid simulationType. Allowed values: ${SIMULATION_TYPES.join(", ")}`;
}

export const SIMULATION_TYPE_FOCUS: Record<SimulationType, string> = {
  campaign_eligibility_impact:
    "Portfolio-style eligibility counts and segment sample for coordinated rollouts.",
  program_update_impact: "Contract program catalog changes and downstream task pressure.",
  approval_sla_change_impact: "Approval queue load and SLA-sensitive pending volumes.",
  evidence_requirement_rollout_impact: "Evidence and attestation demand across matched contracts.",
  escalation_policy_change_impact: "Operational load when escalation paths tighten or loosen.",
  renewal_playbook_change_impact: "Renewal horizon work and obligation windows for matched set.",
  routing_policy_change_impact: "Team routing and queue ownership shifts on open work.",
  reporting_cadence_impact: "Reporting and control-tower review load from cadence changes.",
};
