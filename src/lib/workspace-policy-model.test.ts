import { describe, expect, it } from "vitest";
import {
  buildWorkspacePolicyView,
  getWorkspacePolicyWarnings,
  normalizeWorkspacePolicies,
} from "@/lib/workspace-policy-model";

describe("workspace policy model", () => {
  it("normalizes approval policy entries", () => {
    const policies = normalizeWorkspacePolicies(
      [{ id: "approval_default", applies_to: ["approval"], sla_hours: 24 }],
      "core"
    );
    expect(policies[0]).toMatchObject({
      title: "Approval Default",
      group: "approvals",
      affectsLabel: "Approval workflows",
      detail: "24 hour approval timing",
      status: "active",
    });
  });

  it("normalizes renewal and obligation policy entries", () => {
    const policies = normalizeWorkspacePolicies(
      [{ id: "renewal_evidence", applies_to: ["renewal", "obligation"], severity: "high" }],
      "core"
    );
    expect(policies[0]).toMatchObject({
      group: "obligations",
      affectsLabel: "Obligations and renewals",
      detail: "High priority",
    });
  });

  it("produces user-facing warnings for duplicate IDs", () => {
    const warnings = getWorkspacePolicyWarnings([{ id: "same" }, { id: "same" }], "core");
    expect(warnings.some((warning) => warning.title === "Duplicate policy IDs")).toBe(true);
  });

  it("produces user-facing warnings for invalid approval timing", () => {
    const warnings = getWorkspacePolicyWarnings(
      [{ id: "approval_default", applies_to: ["approval"], sla_hours: 0 }],
      "core"
    );
    expect(warnings.some((warning) => warning.title === "Approval timing must be greater than zero")).toBe(true);
  });

  it("produces user-facing warnings for multiple approval timing defaults", () => {
    const warnings = getWorkspacePolicyWarnings(
      [
        { id: "approval_one", applies_to: ["approval"], sla_hours: 24 },
        { id: "approval_two", applies_to: ["approval"], sla_hours: 48 },
      ],
      "core"
    );
    expect(warnings.some((warning) => warning.title === "Multiple approval timing defaults may conflict")).toBe(true);
  });

  it("filters Assurance-only policies out of Core mode", () => {
    const view = buildWorkspacePolicyView(
      [{ id: "control_policy", applies_to: ["control_policies"], title: "Control cadence" }],
      "core"
    );
    expect(view.groups).toEqual([]);
    expect(view.warnings.some((warning) => warning.title === "Policy is not active in this workspace mode")).toBe(true);
  });

  it("warns when a policy targets a hidden Assurance module", () => {
    const view = buildWorkspacePolicyView(
      [{ id: "control_policy", applies_to: ["control_policies"], title: "Control cadence" }],
      "assurance",
      { hiddenAssuranceModules: new Set(["control_policies"]) }
    );
    expect(view.groups).toEqual([]);
    expect(view.warnings.some((warning) => warning.title === "Policy applies to a hidden workspace area")).toBe(true);
  });

  it("keeps unknown valid policies in Other policies", () => {
    const view = buildWorkspacePolicyView([{ id: "custom_policy", title: "Custom policy" }], "core");
    expect(view.groups[0]).toMatchObject({ key: "other", title: "Other policies" });
  });
});
