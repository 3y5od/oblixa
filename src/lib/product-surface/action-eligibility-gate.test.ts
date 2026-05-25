import { describe, expect, it } from "vitest";
import {
  collectV8ActionTaxonomyViolations,
  collectV8GovernedActionTestCoverageViolations,
  collectV8ServerActionEligibilityViolations,
} from "@/lib/product-surface/action-eligibility-check";

describe("v8 server action eligibility gate", () => {
  it("all mapped server action modules enforce eligibility", () => {
    const violations = collectV8ServerActionEligibilityViolations();
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  it("§13.3 governed modules have colocated tests (or v8-test-exemptions.json)", () => {
    const violations = collectV8GovernedActionTestCoverageViolations();
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  it("§13.1 action taxonomy — exempt, settings, infra, or governed_feature", () => {
    const violations = collectV8ActionTaxonomyViolations();
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
});
