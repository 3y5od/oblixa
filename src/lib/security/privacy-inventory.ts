export type PrivacyInventoryRecord = {
  dataClass: string;
  table: string;
  userField?: string;
  organizationField?: string;
  exportMode: "include" | "count" | "metadata_only";
  deleteMode: "legal_hold_guarded" | "operator_review" | "not_applicable";
};

export const PRIVACY_SAFE_RECORD_INVENTORY: PrivacyInventoryRecord[] = [
  {
    dataClass: "profile",
    table: "profiles",
    userField: "id",
    exportMode: "include",
    deleteMode: "legal_hold_guarded",
  },
  {
    dataClass: "membership",
    table: "organization_members",
    userField: "user_id",
    organizationField: "organization_id",
    exportMode: "include",
    deleteMode: "operator_review",
  },
  {
    dataClass: "organization",
    table: "organizations",
    organizationField: "id",
    exportMode: "include",
    deleteMode: "operator_review",
  },
  {
    dataClass: "security_audit_events",
    table: "security_audit_events",
    userField: "actor_user_id",
    organizationField: "organization_id",
    exportMode: "metadata_only",
    deleteMode: "not_applicable",
  },
  {
    dataClass: "transient_import_rows",
    table: "contract_import_job_rows",
    organizationField: "organization_id",
    exportMode: "count",
    deleteMode: "operator_review",
  },
];

export function isLegalHoldProfile(profile: unknown): boolean {
  return Boolean(profile && typeof profile === "object" && (profile as { legal_hold?: unknown }).legal_hold === true);
}

export function privacyInventoryTables(): string[] {
  return [...new Set(PRIVACY_SAFE_RECORD_INVENTORY.map((record) => record.table))].sort();
}

export function buildPrivacySafeUserExportPayload(input: {
  exportedAt: string;
  user: { id: string; email?: string | null };
  profile: unknown;
  organization: unknown;
  membership: { organization_id: string; role?: string | null };
}) {
  return {
    exported_at: input.exportedAt,
    schema_version: 1,
    inventory_version: 1,
    inventory: PRIVACY_SAFE_RECORD_INVENTORY.map((record) => ({
      data_class: record.dataClass,
      table: record.table,
      export_mode: record.exportMode,
      delete_mode: record.deleteMode,
    })),
    user: { id: input.user.id, email: input.user.email ?? null },
    profile: input.profile ?? null,
    organization: input.organization ?? null,
    membership: {
      organization_id: input.membership.organization_id,
      role: input.membership.role ?? null,
    },
  };
}
