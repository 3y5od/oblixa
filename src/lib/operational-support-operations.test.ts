import { describe, expect, it } from "vitest";
import {
  OPERATIONAL_SUPPORT_CAPABILITIES,
  OPERATIONAL_SUPPORT_OPERATIONS_CONFIG,
  buildSupportBundleReport,
  evaluateBreakGlassRequest,
  evaluateDemoSeedRequest,
  evaluateSupportCapabilityAccess,
  isProductionLikeEnvironment,
  redactSupportBundle,
  redactSupportString,
} from "@/lib/operational-support-operations";

const REQUIRED_CAPABILITY_FIELDS = [
  "capabilityName",
  "routeOrAction",
  "requiredRole",
  "stepUpRequirement",
  "auditEvent",
  "tenantBoundary",
  "readWriteClass",
  "supportSafeAlternative",
  "validationCommand",
  "evidenceRefs",
];

describe("operational support capability registry", () => {
  it("records admin/support capabilities with auth, audit, tenant, read/write, and support-safe alternatives", () => {
    expect(OPERATIONAL_SUPPORT_CAPABILITIES.length).toBeGreaterThanOrEqual(9);
    for (const capability of OPERATIONAL_SUPPORT_CAPABILITIES) {
      for (const field of REQUIRED_CAPABILITY_FIELDS) {
        expect(capability).toHaveProperty(field);
      }
      expect(capability.capabilityName).toMatch(/\S/u);
      expect(capability.routeOrAction).toMatch(/\S/u);
      expect(capability.auditEvent).toMatch(/\S/u);
      expect(capability.tenantBoundary).toMatch(/\S/u);
      expect(capability.supportSafeAlternative).toMatch(/\S/u);
      expect(capability.validationCommand).toMatch(/\S/u);
      expect(capability.evidenceRefs.length).toBeGreaterThan(0);
    }
  });

  it("denies support mutations without role, tenant, step-up, or audit evidence", () => {
    const maintenance = OPERATIONAL_SUPPORT_CAPABILITIES.find((capability) => capability.id === "maintenance-campaign-run");
    expect(maintenance).toBeDefined();

    expect(
      evaluateSupportCapabilityAccess(maintenance!, {
        role: "viewer",
        hasStepUp: false,
        sameTenant: false,
        auditEventRecorded: false,
      }),
    ).toMatchObject({
      allowed: false,
      reasons: ["required_role_not_met", "tenant_boundary_not_met", "step_up_required", "audit_event_required"],
    });

    expect(
      evaluateSupportCapabilityAccess(maintenance!, {
        role: "admin",
        hasStepUp: true,
        sameTenant: true,
        auditEventRecorded: true,
      }),
    ).toMatchObject({ allowed: true, reasons: [] });
  });

  it("allows read-only diagnostics only inside the tenant boundary", () => {
    const diagnostics = OPERATIONAL_SUPPORT_CAPABILITIES.find((capability) => capability.id === "internal-health-diagnostics");
    expect(diagnostics).toBeDefined();
    expect(
      evaluateSupportCapabilityAccess(diagnostics!, {
        role: "admin",
        hasStepUp: false,
        sameTenant: true,
        auditEventRecorded: false,
      }),
    ).toMatchObject({ allowed: true, reasons: [] });
    expect(
      evaluateSupportCapabilityAccess(diagnostics!, {
        role: "admin",
        hasStepUp: false,
        sameTenant: false,
        auditEventRecorded: false,
      }).reasons,
    ).toContain("tenant_boundary_not_met");
  });
});

describe("operational support redaction", () => {
  it("redacts tokens, emails, org/user ids, provider ids, billing ids, file names, headers, and contract text", () => {
    const bundle = {
      contactEmail: "buyer@example.com",
      authorization: "Bearer abcdefghijklmnopqrstuvwxyz123456",
      cookie: "session=secret-cookie-value",
      orgId: "11111111-1111-4111-8111-111111111111",
      userId: "22222222-2222-4222-8222-222222222222",
      providerAccountId: "acct_1234567890abcdef",
      billingCustomerId: "cus_1234567890abcdef",
      uploadedFileName: "Acme confidential MSA.pdf",
      contractText: "This is private contract text that should never enter a support artifact.",
      nested: {
        token: "sk_test_1234567890abcdef",
      },
    };

    const result = redactSupportBundle(bundle);
    const json = JSON.stringify(result.redacted);
    expect(json).not.toContain("buyer@example.com");
    expect(json).not.toContain("abcdefghijklmnopqrstuvwxyz123456");
    expect(json).not.toContain("11111111-1111-4111-8111-111111111111");
    expect(json).not.toContain("Acme confidential MSA.pdf");
    expect(json).not.toContain("private contract text");
    expect([...new Set(result.findings.map((finding) => finding.reason))]).toEqual(
      expect.arrayContaining([
        "authorization-header",
        "billing-id",
        "contract-text",
        "cookie",
        "email-address",
        "org-id",
        "provider-id",
        "token",
        "uploaded-file-name",
        "user-id",
      ]),
    );
  });

  it("keeps redaction deterministic for support bundle storage", () => {
    const first = redactSupportString("support@example.com and cus_1234567890abcdef", "billingCustomerId");
    const second = redactSupportString("support@example.com and cus_1234567890abcdef", "billingCustomerId");
    expect(first).toEqual(second);
    expect(first.value).toContain("[redacted-email:");
    expect(first.value).toContain("[redacted-billing-id:");
  });

  it("builds redacted support bundle reports tied to known capabilities", () => {
    const report = buildSupportBundleReport({
      capabilityIds: ["internal-health-diagnostics"],
      bundle: {
        email: "support@example.com",
        orgId: "11111111-1111-4111-8111-111111111111",
      },
    });
    expect(report.ok).toBe(true);
    expect(report.redactionFindingCount).toBe(2);
    expect(report.missingCapabilityIds).toEqual([]);
  });
});

describe("break-glass and demo/seed controls", () => {
  it("keeps break-glass disabled unless reason, expiry, step-up, audit, and customer-warning evidence are present", () => {
    expect(
      evaluateBreakGlassRequest({
        enabled: false,
        actorRole: "viewer",
        reason: null,
        expiresAt: null,
        now: "2026-05-28T00:00:00.000Z",
        hasStepUp: false,
        auditEventRecorded: false,
        customerImpactAcknowledged: false,
      }).reasons,
    ).toEqual([
      "disabled_by_default",
      "admin_role_required",
      "reason_capture_required",
      "short_expiry_required",
      "step_up_required",
      "audit_event_required",
      "customer_impact_warning_required",
    ]);

    expect(
      evaluateBreakGlassRequest({
        enabled: true,
        actorRole: "admin",
        reason: "Customer-approved incident recovery",
        expiresAt: "2026-05-28T02:00:00.000Z",
        now: "2026-05-28T00:00:00.000Z",
        hasStepUp: true,
        auditEventRecorded: true,
        customerImpactAcknowledged: true,
      }),
    ).toMatchObject({ allowed: true, reasons: [] });
  });

  it("refuses demo seeds in production-like environments and requires admin, org scope, fixture data, and audit", () => {
    expect(isProductionLikeEnvironment({ nodeEnv: "production", vercelEnv: null })).toBe(true);
    expect(isProductionLikeEnvironment({ nodeEnv: "development", vercelEnv: "production" })).toBe(true);
    expect(isProductionLikeEnvironment({ nodeEnv: "test", vercelEnv: "preview" })).toBe(false);

    expect(
      evaluateDemoSeedRequest({
        enabled: true,
        role: "admin",
        nodeEnv: "production",
        vercelEnv: null,
        orgId: "org_1",
        fixtureOnly: true,
        auditEventRecorded: true,
      }),
    ).toMatchObject({ allowed: false, reasons: ["production_refusal"] });

    expect(
      evaluateDemoSeedRequest({
        enabled: true,
        role: "admin",
        nodeEnv: "development",
        vercelEnv: "preview",
        orgId: "org_1",
        fixtureOnly: true,
        auditEventRecorded: true,
      }),
    ).toMatchObject({ allowed: true, reasons: [] });
  });

  it("declares all checklist controls in the code-owned support operations config", () => {
    expect(OPERATIONAL_SUPPORT_OPERATIONS_CONFIG.breakGlassControls).toEqual(
      expect.arrayContaining([
        "disabled-by-default",
        "explicit-enable",
        "reason-capture",
        "expiry-required",
        "audit-event-required",
        "step-up-required",
        "customer-impact-warning",
      ]),
    );
    expect(OPERATIONAL_SUPPORT_OPERATIONS_CONFIG.demoSeedControls).toEqual(
      expect.arrayContaining([
        "env-flag-required",
        "admin-role-required",
        "organization-scope-required",
        "production-refusal",
        "audit-event-required",
        "fixture-data-only",
        "local-seed-secret-scan",
        "fixture-pii-policy",
      ]),
    );
    expect(OPERATIONAL_SUPPORT_OPERATIONS_CONFIG.redactionFields).toEqual(
      expect.arrayContaining([
        "contract-text",
        "uploaded-file-name",
        "email-address",
        "token",
        "org-id",
        "user-id",
        "provider-id",
        "billing-id",
      ]),
    );
  });
});
