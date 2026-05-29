import { sanitizeV10AuditMetadata, type V10AuditMetadata } from "@/lib/server-contracts";
import { PRIVACY_INVENTORY_SCHEMA_VERSION, privacyInventoryCoverageSummary } from "@/lib/security/privacy-inventory";

export type DsarProfileFixture = {
  id: string;
  email: string | null;
  full_name: string | null;
  legal_hold?: boolean;
};

export type DsarMembershipFixture = {
  user_id: string;
  organization_id: string;
  role: string | null;
};

export type DsarOrganizationFixture = {
  id: string;
  name: string;
  created_at: string;
};

export type DsarContractFixture = {
  id: string;
  organization_id: string;
  title: string;
  counterparty: string | null;
  owner_id: string | null;
  created_by: string | null;
};

export type DsarContractFileFixture = {
  id: string;
  contract_id: string;
  file_name: string;
  storage_path: string;
  uploaded_by: string | null;
};

export type DsarExportJobFixture = {
  id: string;
  organization_id: string;
  created_by: string | null;
  status: string;
};

export type DsarAuditEventFixture = {
  id: string;
  organization_id: string;
  actor_user_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  created_at: string;
  safe_metadata: V10AuditMetadata;
};

export type DsarFixtureDataset = {
  profiles: DsarProfileFixture[];
  memberships: DsarMembershipFixture[];
  organizations: DsarOrganizationFixture[];
  contracts: DsarContractFixture[];
  contractFiles: DsarContractFileFixture[];
  exportJobs: DsarExportJobFixture[];
  auditEvents: DsarAuditEventFixture[];
};

export type DsarExportScope =
  | { type: "user"; userId: string }
  | { type: "organization"; organizationId: string };

export type DsarExportBundle = {
  schema_version: 1;
  inventory_version: typeof PRIVACY_INVENTORY_SCHEMA_VERSION;
  scope: DsarExportScope;
  generated_from: "code_owned_fixture";
  privacy_summary: ReturnType<typeof privacyInventoryCoverageSummary>;
  sections: {
    profiles: DsarProfileFixture[];
    memberships: DsarMembershipFixture[];
    organizations: DsarOrganizationFixture[];
    contracts: DsarContractFixture[];
    contract_files: DsarContractFileFixture[];
    export_jobs: DsarExportJobFixture[];
    audit_events: Array<Omit<DsarAuditEventFixture, "safe_metadata"> & { safe_metadata: V10AuditMetadata }>;
  };
};

function byId<T extends { id: string }>(a: T, b: T): number {
  return a.id.localeCompare(b.id);
}

function byOrgUser(a: DsarMembershipFixture, b: DsarMembershipFixture): number {
  return `${a.organization_id}:${a.user_id}`.localeCompare(`${b.organization_id}:${b.user_id}`);
}

function allowedOrganizationIds(scope: DsarExportScope, dataset: DsarFixtureDataset): Set<string> {
  if (scope.type === "organization") return new Set([scope.organizationId]);
  return new Set(
    dataset.memberships
      .filter((membership) => membership.user_id === scope.userId)
      .map((membership) => membership.organization_id)
  );
}

function allowedContractIds(orgIds: Set<string>, dataset: DsarFixtureDataset): Set<string> {
  return new Set(
    dataset.contracts
      .filter((contract) => orgIds.has(contract.organization_id))
      .map((contract) => contract.id)
  );
}

function sanitizeAuditEvent(row: DsarAuditEventFixture): DsarExportBundle["sections"]["audit_events"][number] {
  return {
    ...row,
    safe_metadata: sanitizeV10AuditMetadata(row.safe_metadata),
  };
}

function isUserRelevantAudit(row: DsarAuditEventFixture, userId: string): boolean {
  return row.actor_user_id === userId || row.target_id === userId;
}

export function buildDsarExportFromFixture(input: {
  scope: DsarExportScope;
  dataset: DsarFixtureDataset;
}): DsarExportBundle {
  const orgIds = allowedOrganizationIds(input.scope, input.dataset);
  const contractIds = allowedContractIds(orgIds, input.dataset);
  const userScope = input.scope.type === "user" ? input.scope : null;
  const orgScope = input.scope.type === "organization" ? input.scope : null;
  const userId = userScope?.userId ?? null;

  const profiles =
    userScope
      ? input.dataset.profiles.filter((profile) => profile.id === userScope.userId).sort(byId)
      : [];

  const memberships = input.dataset.memberships
    .filter((membership) =>
      input.scope.type === "user"
        ? membership.user_id === userScope?.userId
        : membership.organization_id === orgScope?.organizationId
    )
    .sort(byOrgUser);

  const organizations = input.dataset.organizations
    .filter((organization) => orgIds.has(organization.id))
    .sort(byId);

  const contracts = input.dataset.contracts
    .filter((contract) => orgIds.has(contract.organization_id))
    .filter((contract) =>
      userId ? contract.owner_id === userId || contract.created_by === userId : true
    )
    .sort(byId);
  const exportedContractIds = new Set(contracts.map((contract) => contract.id));

  const contractFiles = input.dataset.contractFiles
    .filter((file) => contractIds.has(file.contract_id))
    .filter((file) => exportedContractIds.has(file.contract_id))
    .filter((file) => (userId ? file.uploaded_by === userId : true))
    .sort(byId);

  const exportJobs = input.dataset.exportJobs
    .filter((job) => orgIds.has(job.organization_id))
    .filter((job) => (userId ? job.created_by === userId : true))
    .sort(byId);

  const auditEvents = input.dataset.auditEvents
    .filter((event) => orgIds.has(event.organization_id))
    .filter((event) => (userId ? isUserRelevantAudit(event, userId) : true))
    .sort(byId)
    .map(sanitizeAuditEvent);

  return {
    schema_version: 1,
    inventory_version: PRIVACY_INVENTORY_SCHEMA_VERSION,
    scope: input.scope,
    generated_from: "code_owned_fixture",
    privacy_summary: privacyInventoryCoverageSummary(),
    sections: {
      profiles,
      memberships,
      organizations,
      contracts,
      contract_files: contractFiles,
      export_jobs: exportJobs,
      audit_events: auditEvents,
    },
  };
}

export function dsarExportTenantIsolationIssues(bundle: DsarExportBundle): string[] {
  const issues: string[] = [];
  const allowedOrgIds = new Set(bundle.sections.organizations.map((organization) => organization.id));
  const allowedContractIdsInBundle = new Set(bundle.sections.contracts.map((contract) => contract.id));
  const expectedUserId = bundle.scope.type === "user" ? bundle.scope.userId : null;

  const assertOrg = (section: string, id: string, organizationId: string) => {
    if (!allowedOrgIds.has(organizationId)) issues.push(`${section}:${id}:cross_tenant_organization`);
  };

  for (const profile of bundle.sections.profiles) {
    if (expectedUserId && profile.id !== expectedUserId) issues.push(`profiles:${profile.id}:wrong_user`);
  }
  for (const membership of bundle.sections.memberships) {
    assertOrg("memberships", membership.user_id, membership.organization_id);
    if (expectedUserId && membership.user_id !== expectedUserId) issues.push(`memberships:${membership.user_id}:wrong_user`);
  }
  for (const contract of bundle.sections.contracts) {
    assertOrg("contracts", contract.id, contract.organization_id);
    if (expectedUserId && contract.owner_id !== expectedUserId && contract.created_by !== expectedUserId) {
      issues.push(`contracts:${contract.id}:wrong_user`);
    }
  }
  for (const file of bundle.sections.contract_files) {
    if (!allowedContractIdsInBundle.has(file.contract_id)) issues.push(`contract_files:${file.id}:cross_tenant_contract`);
    if (expectedUserId && file.uploaded_by !== expectedUserId) issues.push(`contract_files:${file.id}:wrong_user`);
  }
  for (const job of bundle.sections.export_jobs) {
    assertOrg("export_jobs", job.id, job.organization_id);
    if (expectedUserId && job.created_by !== expectedUserId) issues.push(`export_jobs:${job.id}:wrong_user`);
  }
  for (const event of bundle.sections.audit_events) {
    assertOrg("audit_events", event.id, event.organization_id);
    if (expectedUserId && event.actor_user_id !== expectedUserId && event.target_id !== expectedUserId) {
      issues.push(`audit_events:${event.id}:wrong_user`);
    }
  }

  return issues.sort();
}

export function createCanonicalDsarFixtureDataset(): DsarFixtureDataset {
  return {
    profiles: [
      { id: "user_1", email: "one@example.test", full_name: "User One", legal_hold: false },
      { id: "user_2", email: "two@example.test", full_name: "User Two", legal_hold: false },
      { id: "user_other", email: "other@example.test", full_name: "Other Tenant", legal_hold: false },
    ],
    memberships: [
      { user_id: "user_1", organization_id: "org_1", role: "admin" },
      { user_id: "user_2", organization_id: "org_1", role: "member" },
      { user_id: "user_other", organization_id: "org_other", role: "admin" },
    ],
    organizations: [
      { id: "org_1", name: "Org One", created_at: "2026-01-01T00:00:00.000Z" },
      { id: "org_other", name: "Other Org", created_at: "2026-01-01T00:00:00.000Z" },
    ],
    contracts: [
      { id: "contract_1", organization_id: "org_1", title: "MSA", counterparty: "Counterparty A", owner_id: "user_1", created_by: "user_1" },
      { id: "contract_2", organization_id: "org_1", title: "NDA", counterparty: "Counterparty B", owner_id: "user_2", created_by: "user_2" },
      { id: "contract_other", organization_id: "org_other", title: "Other", counterparty: "Other", owner_id: "user_other", created_by: "user_other" },
    ],
    contractFiles: [
      { id: "file_1", contract_id: "contract_1", file_name: "msa.pdf", storage_path: "org_1/contract_1/msa.pdf", uploaded_by: "user_1" },
      { id: "file_2", contract_id: "contract_2", file_name: "nda.pdf", storage_path: "org_1/contract_2/nda.pdf", uploaded_by: "user_2" },
      { id: "file_other", contract_id: "contract_other", file_name: "other.pdf", storage_path: "org_other/contract_other/other.pdf", uploaded_by: "user_other" },
    ],
    exportJobs: [
      { id: "export_1", organization_id: "org_1", created_by: "user_1", status: "completed" },
      { id: "export_other", organization_id: "org_other", created_by: "user_other", status: "completed" },
    ],
    auditEvents: [
      {
        id: "audit_1",
        organization_id: "org_1",
        actor_user_id: "user_1",
        action: "security.dsr_self_export_downloaded",
        target_type: "user",
        target_id: "user_1",
        created_at: "2026-01-01T00:00:00.000Z",
        safe_metadata: { route: "/api/me/export?token=private-token", responder_email: "one@example.test" },
      },
      {
        id: "audit_2",
        organization_id: "org_1",
        actor_user_id: "user_2",
        action: "contract.updated",
        target_type: "contract",
        target_id: "contract_2",
        created_at: "2026-01-01T00:00:00.000Z",
        safe_metadata: { retryable: true },
      },
      {
        id: "audit_other",
        organization_id: "org_other",
        actor_user_id: "user_other",
        action: "security.dsr_self_export_downloaded",
        target_type: "user",
        target_id: "user_other",
        created_at: "2026-01-01T00:00:00.000Z",
        safe_metadata: { retryable: true },
      },
    ],
  };
}
