import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_TYPES,
  CAMPAIGN_TYPE_LABELS,
  CAMPAIGN_TYPE_STRATEGY_HINTS,
  campaignTypeValidationError,
  isValidCampaignType,
} from "@/lib/decision-intelligence/campaign-types";

describe("campaign-types", () => {
  it("CAMPAIGN_TYPE_LABELS has exactly one label per CAMPAIGN_TYPES entry", () => {
    for (const t of CAMPAIGN_TYPES) {
      expect(typeof CAMPAIGN_TYPE_LABELS[t]).toBe("string");
      expect(CAMPAIGN_TYPE_LABELS[t].length).toBeGreaterThan(0);
    }
    expect(Object.keys(CAMPAIGN_TYPE_LABELS).length).toBe(CAMPAIGN_TYPES.length);
  });

  it("CAMPAIGN_TYPE_STRATEGY_HINTS map to valid campaign types", () => {
    for (const row of CAMPAIGN_TYPE_STRATEGY_HINTS) {
      expect(isValidCampaignType(row.campaignType)).toBe(true);
    }
  });

  it("isValidCampaignType rejects unknown", () => {
    expect(isValidCampaignType("not_a_type")).toBe(false);
    expect(campaignTypeValidationError()).toContain("policy_rollout");
  });
});
