import { describe, expect, it } from "vitest";
import {
  buildDsarExportFromFixture,
  createCanonicalDsarFixtureDataset,
  dsarExportTenantIsolationIssues,
} from "@/lib/security/dsar-fixtures";

describe("DSAR export fixtures", () => {
  it("builds deterministic user exports with required records and no other tenants", () => {
    const dataset = createCanonicalDsarFixtureDataset();
    const first = buildDsarExportFromFixture({ scope: { type: "user", userId: "user_1" }, dataset });
    const second = buildDsarExportFromFixture({ scope: { type: "user", userId: "user_1" }, dataset });

    expect(first).toEqual(second);
    expect(dsarExportTenantIsolationIssues(first)).toEqual([]);
    expect(first.sections.profiles.map((row) => row.id)).toEqual(["user_1"]);
    expect(first.sections.organizations.map((row) => row.id)).toEqual(["org_1"]);
    expect(first.sections.contracts.map((row) => row.id)).toEqual(["contract_1"]);
    expect(first.sections.contract_files.map((row) => row.id)).toEqual(["file_1"]);
    expect(first.sections.export_jobs.map((row) => row.id)).toEqual(["export_1"]);
    expect(first.sections.audit_events.map((row) => row.id)).toEqual(["audit_1"]);
    expect(first.sections.audit_events[0]?.safe_metadata).toEqual({
      responder_email_state: "redacted",
      route: "/api/me/export",
    });
  });

  it("builds deterministic org exports with member records while excluding other orgs", () => {
    const dataset = createCanonicalDsarFixtureDataset();
    const bundle = buildDsarExportFromFixture({
      scope: { type: "organization", organizationId: "org_1" },
      dataset,
    });

    expect(dsarExportTenantIsolationIssues(bundle)).toEqual([]);
    expect(bundle.sections.profiles).toEqual([]);
    expect(bundle.sections.memberships.map((row) => row.user_id)).toEqual(["user_1", "user_2"]);
    expect(bundle.sections.contracts.map((row) => row.id)).toEqual(["contract_1", "contract_2"]);
    expect(bundle.sections.audit_events.map((row) => row.id)).toEqual(["audit_1", "audit_2"]);
    expect(JSON.stringify(bundle)).not.toContain("org_other");
    expect(JSON.stringify(bundle)).not.toContain("user_other");
  });

  it("detects cross-tenant rows in DSAR bundles", () => {
    const dataset = createCanonicalDsarFixtureDataset();
    const bundle = buildDsarExportFromFixture({ scope: { type: "user", userId: "user_1" }, dataset });
    bundle.sections.audit_events.push({
      ...dataset.auditEvents.find((event) => event.id === "audit_other")!,
      safe_metadata: {},
    });

    expect(dsarExportTenantIsolationIssues(bundle)).toEqual([
      "audit_events:audit_other:cross_tenant_organization",
      "audit_events:audit_other:wrong_user",
    ]);
  });
});
