import { describe, expect, it } from "vitest";
import { contractMatchesAutoAttachRule, programMatchesContract } from "@/lib/v4/program-auto-attach";

const baseContract = {
  id: "c1",
  organization_id: "o1",
  contract_type: "MSA",
  source_system: "manual",
  counterparty: "Acme Corp",
  region: "us",
  intake_source: "manual",
};

describe("program-auto-attach", () => {
  it("matches empty rule", () => {
    expect(contractMatchesAutoAttachRule(baseContract, { match: {} })).toBe(true);
  });

  it("matches contract_type", () => {
    expect(
      contractMatchesAutoAttachRule(baseContract, { match: { contract_type: "MSA" } })
    ).toBe(true);
    expect(
      contractMatchesAutoAttachRule(baseContract, { match: { contract_type: "NDA" } })
    ).toBe(false);
  });

  it("uses default_routing_json.auto_attach_rules in programMatchesContract", () => {
    expect(
      programMatchesContract(baseContract, {
        auto_attach_rules: [{ match: { source_system: "manual" } }],
      })
    ).toBe(true);
    expect(programMatchesContract(baseContract, {})).toBe(false);
  });
});
