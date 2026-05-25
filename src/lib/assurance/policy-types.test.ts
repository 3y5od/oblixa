import { describe, expect, it } from "vitest";
import {
  defaultPolicyJson,
  mergeVersionPayload,
  parseEvidenceExpectations,
  parseExemptionRules,
  parsePolicyJson,
  parseSeverityModel,
  parseSlaThresholds,
} from "@/lib/assurance/policy-types";

describe("policy-types parsers", () => {
  it("defaultPolicyJson has expected schema", () => {
    const d = defaultPolicyJson();
    expect(d.schema).toBe("v6.control_policy.v1");
    expect(d.max_open_exceptions).toBe(25);
  });

  it("parsePolicyJson merges with defaults when valid schema", () => {
    const p = parsePolicyJson({
      schema: "v6.control_policy.v1",
      max_open_exceptions: 99,
    });
    expect(p.max_open_exceptions).toBe(99);
    expect(p.require_contract_owner).toBe(true);
  });

  it("parsePolicyJson falls back for non-object", () => {
    expect(parsePolicyJson(null).schema).toBe("v6.control_policy.v1");
  });

  it("parseEvidenceExpectations and parseSlaThresholds wrap objects", () => {
    expect(parseEvidenceExpectations({ min_fresh_coverage: 0.5 }).min_fresh_coverage).toBe(0.5);
    expect(parseSlaThresholds({ max_pending_approvals: 3 }).max_pending_approvals).toBe(3);
  });

  it("parseExemptionRules filters to objects", () => {
    expect(parseExemptionRules([{ segment_key: "s" }, null, "x"] as never)).toHaveLength(1);
  });

  it("parseSeverityModel returns empty-ish for primitives", () => {
    expect(parseSeverityModel(1)).toEqual({});
  });

  it("mergeVersionPayload aggregates all parts", () => {
    const m = mergeVersionPayload(
      { schema: "v6.control_policy.v1" },
      {},
      {},
      [],
      {}
    );
    expect(m.policyJson.schema).toBe("v6.control_policy.v1");
    expect(Array.isArray(m.exemptionRules)).toBe(true);
  });
});
