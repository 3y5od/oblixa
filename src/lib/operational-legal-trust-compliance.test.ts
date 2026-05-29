import { describe, expect, it } from "vitest";

import {
  buildLegalTrustComplianceFixtureReport,
  checksumSubprocessorEntry,
  evaluateComplianceFrameworkMappings,
  evaluateConsentInventory,
  evaluatePublicClaimText,
  evaluatePublicClaims,
  evaluateSubprocessorIntegrity,
  evaluateTrustSurfaceFreshness,
  type SubprocessorEntry,
} from "./operational-legal-trust-compliance";

function subprocessor(overrides: Partial<SubprocessorEntry> = {}): SubprocessorEntry {
  const payload = {
    id: "supabase",
    name: "Supabase",
    purpose: "Auth, database, and storage",
    dataClasses: ["account_data", "workspace_content", "contract_content"],
    region: "configurable",
    owner: "data-platform",
    changeDate: "2026-05-28",
    notificationSlaDays: 30,
    lastNotifiedAt: "2026-05-28T00:00:00.000Z",
    nextReviewDue: "2027-05-28T00:00:00.000Z",
    noticeLeadTimeDays: 30,
    privacyInventoryRefs: ["profile", "membership"],
    validationCommand: "check:operational-supabase-database",
    ...overrides,
  };
  return { ...payload, checksum: checksumSubprocessorEntry(payload) };
}

describe("operational legal, trust, and compliance", () => {
  it("flags stale trust surfaces", () => {
    const result = evaluateTrustSurfaceFreshness(
      [
        {
          id: "privacy",
          surfaceType: "public-legal-page",
          route: "/privacy",
          path: "src/app/(marketing)/privacy/page.tsx",
          ownerArea: "privacy-security",
          lastReviewed: "2024-01-01",
          freshnessWindowDays: 30,
          requiredMarkers: ["LegalPageJsonLd"],
          contactPath: "/contact",
          manualBoundary: "legal approval remains manual",
        },
      ],
      { asOfDate: "2026-05-28" },
    );

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ issue: "trust_surface_review_stale" }));
  });

  it("requires public claims to map to capabilities or manual boundaries", () => {
    const result = evaluatePublicClaims(
      [
        {
          id: "unsupported",
          claim: "Enterprise assurance automation.",
          sourcePath: "src/app/page.tsx",
          capabilityRefs: ["missing"],
          allowedScope: "marketing copy",
          validationCommand: "check:operational-legal-trust-compliance",
        },
      ],
      [],
    );

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ issue: "public_claim_unknown_capability_ref" }));
  });

  it("allows negated prohibited claims but rejects affirmative overclaims", () => {
    const rules = {
      negationWindowChars: 50,
      forbiddenPatterns: [
        {
          id: "legal-advice",
          pattern: "\\bprovide\\b.{0,40}\\blegal advice\\b",
          allowedNegations: ["does not", "not"],
        },
      ],
      requiredDisclaimers: [],
    };

    expect(evaluatePublicClaimText("Oblixa does not provide legal advice.", rules).ok).toBe(true);
    const affirmative = evaluatePublicClaimText("Oblixa can provide practical legal advice.", rules);
    expect(affirmative.ok).toBe(false);
    expect(affirmative.findings[0]?.issue).toBe("forbidden_public_claim");
  });

  it("validates subprocessor checksums and required data classes", () => {
    const valid = subprocessor();
    const result = evaluateSubprocessorIntegrity([valid], {
      minimumNoticeLeadTimeDays: 30,
      requiredDataClasses: ["account_data", "workspace_content", "contract_content"],
    });

    expect(result.ok).toBe(true);

    const broken = { ...valid, checksum: "sha256-bad" };
    const brokenResult = evaluateSubprocessorIntegrity([broken], {
      minimumNoticeLeadTimeDays: 30,
      requiredDataClasses: ["account_data"],
    });
    expect(brokenResult.ok).toBe(false);
    expect(brokenResult.issues).toContainEqual(expect.objectContaining({ issue: "subprocessor_checksum_mismatch" }));
  });

  it("requires tracking-like storage to have a nonessential consent category and opt-out", () => {
    const result = evaluateConsentInventory([
      {
        id: "bad-tracker",
        sourcePath: "src/app/api/reports/track/open/[token]/route.ts",
        marker: "pixelResponse",
        storageType: "server-side-token-event",
        consentCategory: "essential",
        provider: "first-party",
        dataClass: "report_tracking",
        expiry: "transient_180d",
        optOutBehavior: "none",
        trackingLike: true,
      },
    ]);

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.issue)).toEqual(
      expect.arrayContaining(["tracking_like_entry_cannot_be_essential_only", "tracking_like_entry_missing_opt_out"]),
    );
  });

  it("does not allow compliance mappings to claim certification", () => {
    const result = evaluateComplianceFrameworkMappings(
      [
        {
          id: "soc2",
          framework: "SOC 2",
          controlId: "CC6.1",
          evidenceRefs: ["artifacts/gdpr-soc2-control-map.json"],
          certificationClaim: true,
          manualBoundary: "audit remains external",
        },
      ],
      ["SOC 2"],
    );

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ issue: "compliance_mapping_claims_certification" }));
  });

  it("builds an aggregate fixture report", () => {
    const result = buildLegalTrustComplianceFixtureReport({
      asOfDate: "2026-05-28",
      subprocessorEntries: [
        subprocessor({ dataClasses: ["account_data", "workspace_content", "contract_content", "billing_data", "email_delivery", "error_telemetry", "ai_extraction", "rate_limit_metadata"] }),
      ],
      claimText: "Oblixa does not provide legal advice.",
    });

    expect(result.trust.ok).toBe(true);
    expect(result.claimText.ok).toBe(true);
  });
});
