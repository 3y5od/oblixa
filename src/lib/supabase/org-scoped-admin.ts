export function requireServiceRoleOrgId(orgId: string): string {
  const trimmed = orgId.trim();
  if (!trimmed) {
    throw new Error("service_role_org_id_required");
  }
  return trimmed;
}

export type ResolvedOrgMembership = {
  organization_id: string;
  role: string;
};

export type OrgOperationalStatus = "active" | "inactive" | "suspended";

export type OrgResolutionFailureReason =
  | "organization_membership_missing"
  | "organization_membership_ambiguous"
  | "organization_membership_query_failed"
  | "organization_state_missing"
  | "organization_state_query_failed"
  | "organization_inactive"
  | "organization_suspended";

export type OrgResolutionResult =
  | { ok: true; membership: ResolvedOrgMembership }
  | { ok: false; reason: OrgResolutionFailureReason; detail?: string };

type OrgOperationalStateResult =
  | { ok: true; status: "active" }
  | { ok: false; reason: OrgResolutionFailureReason; detail?: string };

export type SensitiveOrgContextUser = {
  id: string;
};

export type SensitiveOrgContext =
  | {
      ok: true;
      organizationId: string;
      role: string;
      membership: ResolvedOrgMembership;
    }
  | {
      ok: false;
      reason: OrgResolutionFailureReason;
      status: 403 | 409;
      detail?: string;
    };

type OrgScopedQuery = {
  eq: (column: string, value: string) => OrgScopedQuery;
};

type OrgScopedMutationPayload = Record<string, unknown> | Record<string, unknown>[];
type OrgScopedMutationQuery<TQuery> = {
  update: (payload: OrgScopedMutationPayload) => TQuery;
};

type AdminWithMemberships = {
  from: (table: "organization_members" | "organizations") => {
    select: (columns: string) => unknown;
  };
};

type OrgScopedAdminClient = {
  from: (table: string) => unknown;
};

export function applyRequiredOrgScope<TQuery extends OrgScopedQuery>(
  query: TQuery,
  orgId: string,
  column = "organization_id"
): TQuery {
  return query.eq(column, requireServiceRoleOrgId(orgId)) as TQuery;
}

export function withRequiredOrgId<TPayload extends OrgScopedMutationPayload>(
  payload: TPayload,
  orgId: string
): TPayload {
  const organizationId = requireServiceRoleOrgId(orgId);
  if (Array.isArray(payload)) {
    return payload.map((row) => ({ ...row, organization_id: organizationId })) as unknown as TPayload;
  }
  return { ...payload, organization_id: organizationId } as unknown as TPayload;
}

export function updateWithRequiredOrgScope<TQuery extends OrgScopedQuery>(
  query: OrgScopedMutationQuery<TQuery>,
  payload: OrgScopedMutationPayload,
  orgId: string,
  column = "organization_id"
): TQuery {
  const scopedPayload = withRequiredOrgId(payload, orgId);
  return applyRequiredOrgScope(query.update(scopedPayload) as TQuery, orgId, column);
}

export function assertPayloadOrgScope(payload: unknown, orgId: string): void {
  const organizationId = requireServiceRoleOrgId(orgId);
  const rows = Array.isArray(payload) ? payload : [payload];
  for (const row of rows) {
    if (!row || typeof row !== "object" || (row as { organization_id?: unknown }).organization_id !== organizationId) {
      throw new Error("service_role_payload_org_scope_required");
    }
  }
}

function normalizeOptionalOrgId(orgId?: string | null): string | null {
  const trimmed = orgId?.trim();
  return trimmed ? trimmed : null;
}

export function getExplicitOrgIdFromInput(input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  for (const key of ["organizationId", "orgId", "organization_id"]) {
    const value = record[key];
    if (typeof value === "string") {
      const normalized = normalizeOptionalOrgId(value);
      if (normalized) return normalized;
    }
  }
  return null;
}

function rowToMembership(row: unknown): ResolvedOrgMembership | null {
  if (!row || typeof row !== "object") return null;
  const candidate = row as { organization_id?: unknown; role?: unknown };
  if (typeof candidate.organization_id !== "string" || !candidate.organization_id.trim()) return null;
  return {
    organization_id: candidate.organization_id,
    role: typeof candidate.role === "string" && candidate.role.trim() ? candidate.role : "viewer",
  };
}

function normalizeOrgOperationalStatus(value: unknown): OrgOperationalStatus {
  if (value === "inactive" || value === "suspended") return value;
  return "active";
}

function objectField(record: Record<string, unknown>, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;
}

export function orgOperationalStatusFromRow(row: unknown): OrgOperationalStatus | null {
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  const rawSettings =
    objectField(record, "org_settings_json") ?? objectField(record, "v6_org_settings_json");
  const settings = rawSettings && typeof rawSettings === "object" ? rawSettings as Record<string, unknown> : {};
  return normalizeOrgOperationalStatus(
    objectField(settings, "operational_status") ??
      objectField(settings, "organization_status") ??
      objectField(record, "operational_status") ??
      objectField(record, "organization_status")
  );
}

async function resolveOrganizationOperationalState(
  admin: AdminWithMemberships,
  orgId: string
): Promise<OrgOperationalStateResult> {
  try {
    const query = admin
      .from("organizations")
      .select("id, v6_org_settings_json") as {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: unknown; error: { message?: string } | null }>;
      };
    };
    const result = await query.eq("id", requireServiceRoleOrgId(orgId)).maybeSingle();
    if (result.error) {
      return {
        ok: false,
        reason: "organization_state_query_failed",
        detail: result.error.message ?? "organization state query failed",
      };
    }
    const status = orgOperationalStatusFromRow(result.data);
    if (!status) return { ok: false, reason: "organization_state_missing" };
    if (status === "inactive") return { ok: false, reason: "organization_inactive" };
    if (status === "suspended") return { ok: false, reason: "organization_suspended" };
    return { ok: true, status: "active" };
  } catch (error) {
    return {
      ok: false,
      reason: "organization_state_query_failed",
      detail: error instanceof Error ? error.message : "organization state query failed",
    };
  }
}

export function getExplicitOrgIdFromRequest(request: Request): string | null {
  const headerOrgId =
    normalizeOptionalOrgId(request.headers.get("x-oblixa-organization-id")) ??
    normalizeOptionalOrgId(request.headers.get("x-organization-id"));
  if (headerOrgId) return headerOrgId;
  try {
    const url = new URL(request.url);
    return normalizeOptionalOrgId(url.searchParams.get("organizationId")) ?? normalizeOptionalOrgId(url.searchParams.get("orgId"));
  } catch {
    return null;
  }
}

export async function getExplicitOrgIdFromRequestBody(request: Request): Promise<string | null> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  try {
    if (contentType.includes("application/json")) {
      const body = await request.clone().json();
      return getExplicitOrgIdFromInput(body);
    }
    if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      const body = await request.clone().formData();
      return (
        normalizeOptionalOrgId(body.get("organizationId")?.toString()) ??
        normalizeOptionalOrgId(body.get("orgId")?.toString()) ??
        normalizeOptionalOrgId(body.get("organization_id")?.toString())
      );
    }
  } catch {
    return null;
  }
  return null;
}

export async function getExplicitOrgIdFromRequestWithBody(request: Request): Promise<string | null> {
  return (await getExplicitOrgIdFromRequestBody(request)) ?? getExplicitOrgIdFromRequest(request);
}

export function orgResolutionHttpStatus(reason: OrgResolutionFailureReason): 403 | 409 {
  return reason === "organization_membership_ambiguous" ? 409 : 403;
}

export async function resolveExplicitOrSingleMembership(
  admin: AdminWithMemberships,
  userId: string,
  explicitOrgId?: string | null
): Promise<OrgResolutionResult> {
  const actorUserId = userId.trim();
  if (!actorUserId) return { ok: false, reason: "organization_membership_missing" };

  const organizationId = normalizeOptionalOrgId(explicitOrgId);
  try {
    if (organizationId) {
      const query = admin
        .from("organization_members")
        .select("organization_id, role") as {
        eq: (column: string, value: string) => unknown;
      };
      const byUser = query.eq("user_id", actorUserId) as {
        eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data: unknown; error: { message?: string } | null }> };
      };
      const result = await byUser.eq("organization_id", organizationId).maybeSingle();
      if (result.error) {
        return {
          ok: false,
          reason: "organization_membership_query_failed",
          detail: result.error.message ?? "membership query failed",
        };
      }
      const membership = rowToMembership(result.data);
      return membership ? { ok: true, membership } : { ok: false, reason: "organization_membership_missing" };
    }

    const query = admin
      .from("organization_members")
      .select("organization_id, role, created_at") as {
      eq: (column: string, value: string) => unknown;
    };
    const byUser = query.eq("user_id", actorUserId) as {
      order: (column: string, options: { ascending: boolean }) => { limit: (count: number) => Promise<{ data: unknown; error: { message?: string } | null }> };
    };
    const result = await byUser.order("created_at", { ascending: true }).limit(2);
    if (result.error) {
      return {
        ok: false,
        reason: "organization_membership_query_failed",
        detail: result.error.message ?? "membership query failed",
      };
    }
    const rows = Array.isArray(result.data) ? result.data : [];
    if (rows.length === 0) return { ok: false, reason: "organization_membership_missing" };
    if (rows.length > 1) return { ok: false, reason: "organization_membership_ambiguous" };
    const membership = rowToMembership(rows[0]);
    return membership ? { ok: true, membership } : { ok: false, reason: "organization_membership_missing" };
  } catch (error) {
    return {
      ok: false,
      reason: "organization_membership_query_failed",
      detail: error instanceof Error ? error.message : "membership query failed",
    };
  }
}

export async function resolveSensitiveOrgContext(
  admin: AdminWithMemberships,
  user: SensitiveOrgContextUser,
  explicitOrgId?: string | null
): Promise<SensitiveOrgContext> {
  const result = await resolveExplicitOrSingleMembership(admin, user.id, explicitOrgId);
  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason,
      status: orgResolutionHttpStatus(result.reason),
      detail: result.detail,
    };
  }
  const orgState = await resolveOrganizationOperationalState(admin, result.membership.organization_id);
  if (!orgState.ok) {
    return {
      ok: false,
      reason: orgState.reason,
      status: orgResolutionHttpStatus(orgState.reason),
      detail: orgState.detail,
    };
  }
  return {
    ok: true,
    organizationId: result.membership.organization_id,
    role: result.membership.role,
    membership: result.membership,
  };
}

export function createOrgScopedAdminContext<TAdmin extends OrgScopedAdminClient>(
  admin: TAdmin,
  orgId: string
) {
  const organizationId = requireServiceRoleOrgId(orgId);
  return {
    admin,
    organizationId,
    from(table: string) {
      return admin.from(table);
    },
    scope<TQuery extends OrgScopedQuery>(query: TQuery, column = "organization_id"): TQuery {
      return applyRequiredOrgScope(query, organizationId, column);
    },
    bindPayload<TPayload extends OrgScopedMutationPayload>(payload: TPayload): TPayload {
      return withRequiredOrgId(payload, organizationId);
    },
    assertPayload(payload: unknown): void {
      assertPayloadOrgScope(payload, organizationId);
    },
  };
}
