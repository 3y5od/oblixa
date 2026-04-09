import { isFeatureEnabled } from "@/lib/feature-flags";

/**
 * Server-generated PDF is part of the V5 packet baseline.
 * Keep this helper to centralize the gate: decision foundation must be enabled.
 */
export function isDecisionPacketServerPdfEnabled(): boolean {
  return isFeatureEnabled("v5DecisionFoundation");
}
