import { describe, expect, it } from "vitest";
import {
  V10_DELIVERY_PRIVACY_CONTRACTS,
  buildV10ReportExportArtifactManifest,
  getV10ContractExportRowLimit,
  getV10ReportFamilyForRun,
  neutralizeV10CsvFormulaCell,
  resolveV10ReportExportPlan,
  validateV10DeliveryPrivacyContracts,
  validateV10ReportExportArtifactContract,
} from "./report-export";

describe("V10 report/export delivery privacy contracts", () => {
  it("maps runtime report modes to concrete V10 report families", () => {
    expect(getV10ReportFamilyForRun("management")).toBe("contract_portfolio_summary");
    expect(getV10ReportFamilyForRun("renewal_digest")).toBe("renewal_horizon_report");
    expect(getV10ReportFamilyForRun("approval_sla")).toBe("approval_sla_report");
    expect(getV10ReportFamilyForRun("obligation_overview")).toBe("overdue_work_report");
    expect(getV10ReportFamilyForRun("import_extraction")).toBe("import_extraction_reliability_report");
    expect(getV10ReportFamilyForRun("workspace_health_report")).toBe("workspace_health_report");
  });

  it("derives export plan limits from workspace settings", () => {
    expect(resolveV10ReportExportPlan({ workspace_mode: "core" })).toBe("core");
    expect(resolveV10ReportExportPlan({ workspace_plan: "trial" })).toBe("trial");
    expect(getV10ContractExportRowLimit("core")).toBe(10_000);
    expect(getV10ContractExportRowLimit("enterprise")).toBe(20_000);
  });

  it("validates scoped artifacts with redaction, formula neutralization, expiry, and revocation", () => {
    const artifact = {
      artifactId: "artifact_1",
      family: "contract_portfolio_summary" as const,
      selectedRowCount: 10,
      generatedRowCount: 10,
      checksum: "sha256:artifact",
      expiresAt: "2026-04-27T00:00:00Z",
      scopedDownloadHref: "/api/export/contracts/job_1",
      retryAction: null,
      cancelAction: "cancel" as const,
      revokeAction: "revoke" as const,
      redactionApplied: true,
      csvFormulaNeutralized: true,
    };

    expect(validateV10ReportExportArtifactContract(artifact)).toEqual([]);
    expect(buildV10ReportExportArtifactManifest({ ...artifact, now: new Date("2026-04-26T12:00:00Z") })).toMatchObject({
      artifact_id: "artifact_1",
      delivery_state: "not_requested",
      operational_review_due: true,
    });
    expect(neutralizeV10CsvFormulaCell("=HYPERLINK(\"x\")")).toBe("'=HYPERLINK(\"x\")");
  });

  it("codifies delivery privacy across report email, export download, notification, external links, and runtime artifacts", () => {
    expect(validateV10DeliveryPrivacyContracts()).toEqual([]);
    expect(V10_DELIVERY_PRIVACY_CONTRACTS.map((contract) => contract.deliveryKind)).toEqual([
      "report_email",
      "export_download",
      "notification",
      "external_evidence_link",
      "runtime_artifact",
    ]);
    expect(V10_DELIVERY_PRIVACY_CONTRACTS.find((contract) => contract.deliveryKind === "external_evidence_link")).toMatchObject({
      recipientScope: "external_token",
      tokenHashOnly: true,
      prohibitedPayloadFields: expect.arrayContaining(["signed_link_token", "responder_email"]),
    });
  });

  it("rejects unsafe delivery privacy descriptors", () => {
    expect(
      validateV10DeliveryPrivacyContracts([
        {
          deliveryKind: "export_download",
          recipientScope: "organization",
          privateCacheRequired: false,
          redactionRequired: false,
          tokenHashOnly: false,
          retentionDays: 0,
          auditAction: "download",
          prohibitedPayloadFields: [],
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "export_download:private_no_store_required",
        "export_download:redaction_required",
        "export_download:token_hash_only_required",
        "export_download:retention_required",
        "export_download:audit_action_required",
        "export_download:prohibited_fields_required",
        "delivery_contract_missing:report_email",
      ])
    );
  });
});
