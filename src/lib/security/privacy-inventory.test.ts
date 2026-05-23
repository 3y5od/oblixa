import { describe, expect, it } from "vitest";
import {
  PRIVACY_SAFE_RECORD_INVENTORY,
  buildPrivacySafeUserExportPayload,
  isLegalHoldProfile,
  privacyInventoryTables,
} from "@/lib/security/privacy-inventory";

describe("privacy-safe export/delete inventory", () => {
  it("lists representative user-linked records and legal-hold behavior", () => {
    expect(PRIVACY_SAFE_RECORD_INVENTORY).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ table: "profiles", deleteMode: "legal_hold_guarded" }),
        expect.objectContaining({ table: "organization_members", userField: "user_id" }),
        expect.objectContaining({ table: "security_audit_events", exportMode: "metadata_only" }),
      ])
    );
    expect(privacyInventoryTables()).toEqual([
      "contract_import_job_rows",
      "organization_members",
      "organizations",
      "profiles",
      "security_audit_events",
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
      inventory_version: 1,
      user: { id: "user_1", email: "u@example.test" },
      membership: { organization_id: "org_1", role: "admin" },
      inventory: expect.arrayContaining([
        expect.objectContaining({ data_class: "profile", table: "profiles" }),
      ]),
    });
  });

  it("keeps legal-hold detection centralized for export and delete hooks", () => {
    expect(isLegalHoldProfile({ legal_hold: true })).toBe(true);
    expect(isLegalHoldProfile({ legal_hold: false })).toBe(false);
    expect(isLegalHoldProfile(null)).toBe(false);
  });
});
