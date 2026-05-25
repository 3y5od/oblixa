import { describe, expect, it } from "vitest";
import {
  validatePolicyRegistry,
  getApprovalSlaFallbackHours,
  analyzePolicyRegistry,
} from "@/lib/contract-operations/policy-registry";

describe("validatePolicyRegistry", () => {
  it("accepts unique ids", () => {
    expect(
      validatePolicyRegistry([
        { id: "a", applies_to: ["approval"], sla_hours: 24 },
        { id: "b", title: "x" },
      ])
    ).toEqual({ ok: true });
  });

  it("rejects duplicate ids", () => {
    const r = validatePolicyRegistry([{ id: "x" }, { id: "x" }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Duplicate");
  });
});

describe("getApprovalSlaFallbackHours", () => {
  it("reads first applicable sla_hours", () => {
    expect(
      getApprovalSlaFallbackHours([
        { id: "other", applies_to: ["renewal"], sla_hours: 99 },
        { id: "sla", applies_to: ["approval"], sla_hours: 36 },
      ])
    ).toBe(36);
  });
});

describe("analyzePolicyRegistry", () => {
  it("warns when multiple approval SLA fallbacks are defined", () => {
    const w = analyzePolicyRegistry([
      { id: "a", applies_to: ["approval"], sla_hours: 24 },
      { id: "b", applies_to: ["approval"], sla_hours: 48 },
    ]);
    expect(w.some((x) => x.includes("Multiple entries"))).toBe(true);
  });

  it("returns empty for invalid registry (validate first)", () => {
    expect(analyzePolicyRegistry([{ missing: "id" }] as unknown[])).toEqual([]);
  });

  it("warns on renewal entry without severity, sla, or notes", () => {
    const w = analyzePolicyRegistry([{ id: "r", applies_to: ["renewal"] }]);
    expect(w.length).toBeGreaterThan(0);
  });
});
