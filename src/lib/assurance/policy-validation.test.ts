import { describe, expect, it } from "vitest";
import { validateControlPolicyVersionPayload } from "@/lib/assurance/policy-validation";
import { defaultPolicyJson, mergeVersionPayload } from "@/lib/assurance/policy-types";

describe("validateControlPolicyVersionPayload", () => {
  it("accepts default-shaped payload", () => {
    const payload = mergeVersionPayload({}, {}, {}, [], {});
    const v = validateControlPolicyVersionPayload(payload);
    expect(v.ok).toBe(true);
  });

  it("rejects invalid schema when payload is tampered", () => {
    const payload = mergeVersionPayload({}, {}, {}, [], {});
    payload.policyJson = { ...defaultPolicyJson(), schema: "wrong" as "v6.control_policy.v1" };
    const v = validateControlPolicyVersionPayload(payload);
    expect(v.ok).toBe(false);
    expect(v.issues.some((i) => i.code === "invalid_schema")).toBe(true);
  });

  it("rejects negative thresholds", () => {
    const payload = mergeVersionPayload(
      { schema: "v6.control_policy.v1", max_open_exceptions: -1 },
      {},
      {},
      [],
      {}
    );
    const v = validateControlPolicyVersionPayload(payload);
    expect(v.ok).toBe(false);
  });
});
