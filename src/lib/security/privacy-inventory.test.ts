import { describe, expect, it } from "vitest";
import {
  PRIVACY_SAFE_RECORD_INVENTORY,
  buildPrivacySafeUserExportPayload,
  isLegalHoldProfile,
  privacyInventoryByKind,
  privacyInventoryClassificationIssues,
  privacyInventoryCoverageSummary,
  privacyInventoryTables,
} from "@/lib/security/privacy-inventory";

describe("privacy-safe export/delete inventory", () => {
  it("lists tables, buckets, telemetry, exports, providers, and legal-hold behavior", () => {
    expect(PRIVACY_SAFE_RECORD_INVENTORY).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ table: "profiles", deleteMode: "legal_hold_guarded" }),
        expect.objectContaining({ table: "organization_members", userField: "user_id" }),
        expect.objectContaining({ table: "security_audit_events", exportMode: "metadata_only" }),
        expect.objectContaining({ storageBucket: "contracts", kind: "storage_bucket" }),
        expect.objectContaining({ telemetryEvent: "audit_event.recorded", kind: "telemetry_event" }),
        expect.objectContaining({ exportSurface: "/api/me/export", kind: "export_surface" }),
        expect.objectContaining({ provider: "stripe", kind: "provider" }),
      ])
    );
    expect(privacyInventoryTables()).toEqual(expect.arrayContaining(["contracts", "profiles", "v10_audit_events"]));
    expect(privacyInventoryByKind("storage_bucket")).toHaveLength(2);
    expect(privacyInventoryCoverageSummary()).toMatchObject({
      schemaVersion: 2,
      classificationIssueCount: 0,
      byKind: expect.objectContaining({
        table: expect.any(Number),
        storage_bucket: 2,
        telemetry_event: 2,
        export_surface: 2,
        provider: 3,
      }),
    });
  });

  it("requires retention, redaction, access, and deletion classifications for PII", () => {
    expect(privacyInventoryClassificationIssues()).toEqual([]);
    expect(
      privacyInventoryClassificationIssues([
        {
          ...PRIVACY_SAFE_RECORD_INVENTORY[0],
          dataClass: "broken_profile",
          piiFields: [],
        },
      ])
    ).toEqual([
      {
        dataClass: "broken_profile",
        issue: "pii_record_missing_pii_fields",
      },
    ]);
  });

  it("builds an export bundle without raw delete-only implementation state", () => {
    expect(
      buildPrivacySafeUserExportPayload({
        exportedAt: "2026-01-01T00:00:00.000Z",
        user: { id: "user_1", email: "u@example.test" },
        profile: { full_name: "User One", legal_hold: false },
        organization: { id: "org_1", name: "Org" },
        membership: { organization_id: "org_1", role: "admin" },
      })
    ).toMatchObject({
      schema_version: 1,
      inventory_version: 2,
      user: { id: "user_1", email: "u@example.test" },
      membership: { organization_id: "org_1", role: "admin" },
      inventory: expect.arrayContaining([
        expect.objectContaining({
          data_class: "profile",
          table: "profiles",
          retention_class: "account_lifecycle",
          redaction_class: "field_level",
          access_class: "self_service",
          deletion_class: "legal_hold_guarded_delete",
        }),
      ]),
    });
  });

  it("keeps legal-hold detection centralized for export and delete hooks", () => {
    expect(isLegalHoldProfile({ legal_hold: true })).toBe(true);
    expect(isLegalHoldProfile({ legal_hold: false })).toBe(false);
    expect(isLegalHoldProfile(null)).toBe(false);
  });
});
