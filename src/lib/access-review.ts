import { createHash, randomBytes } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import type { createAdminClient } from "@/lib/supabase/server";
import { isReasonableEmail } from "@/lib/security/validation";

type Admin = Awaited<ReturnType<typeof createAdminClient>>;
type ExistingAccessRequestLookup = { id: string; duplicate_count?: number | null };

export type AccessRequestStatus = "pending" | "approved" | "rejected" | "closed";
export type AccessGrantStatus = "issued" | "used" | "revoked" | "expired";
export type AccessGrantInspectionState =
  | "valid_workspace_creation"
  | "missing"
  | "invalid"
  | "expired"
  | "used"
  | "revoked"
  | "unavailable";

export type AccessRequestInsert = {
  normalizedEmail: string;
  requesterName: string;
  companyName: string;
  requesterRole: string;
  approximateContractCount: string;
  currentTrackingMethod: string;
  hasTracker: string;
  redactedSampleAvailable: string;
  followUpPreference: string;
  painSummary: string;
  message: string;
  source: "request_access" | "contact";
  /** Fit context captured in last_submission_json (no dedicated columns yet). */
  accountableOwner?: string;
  procurementBeforeUpload?: string;
  smallFirstSet?: string;
};

export type AccessRequestRow = {
  id: string;
  normalized_email: string;
  requester_name: string | null;
  company_name: string | null;
  requester_role: string | null;
  approximate_contract_count: string | null;
  current_tracking_method: string | null;
  has_tracker: string | null;
  redacted_sample_available: string | null;
  follow_up_preference: string | null;
  pain_summary: string | null;
  message: string | null;
  source: string | null;
  status: AccessRequestStatus;
  duplicate_count: number;
  last_submitted_at: string;
  last_submission_json: Record<string, unknown> | null;
  last_operator_note: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ApprovedAccessRequestRecoveryRow = {
  id: string;
  normalized_email: string;
  requester_name: string | null;
  company_name: string | null;
  status: "approved";
};

export type AccessGrantRow = {
  id: string;
  request_id: string | null;
  normalized_email: string;
  status: AccessGrantStatus;
  expires_at: string;
  issued_by: string | null;
  used_by: string | null;
  used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export type AccessRequestEventRow = {
  id: string;
  request_id: string;
  actor_user_id: string | null;
  action: string;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
};

export const ACCESS_GRANT_TTL_MS = 14 * 24 * 60 * 60 * 1000;

const OPERATOR_EMAILS_ENV = "OBLIXA_OPERATOR_EMAILS";
const ACCESS_GRANT_TOKEN_RE = /^[A-Za-z0-9_-]{32,256}$/;

export function normalizeAccessReviewEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isAccessReviewEmail(email: string): boolean {
  const normalized = normalizeAccessReviewEmail(email);
  return isReasonableEmail(normalized);
}

export function parseOperatorEmailAllowlist(env: NodeJS.ProcessEnv = process.env): Set<string> {
  const raw = env[OPERATOR_EMAILS_ENV]?.trim() ?? "";
  return new Set(
    raw
      .split(/[,\s]+/)
      .map((entry) => normalizeAccessReviewEmail(entry))
      .filter((entry) => entry && isReasonableEmail(entry))
  );
}

export function isAuthorizedOperatorUser(
  user: Pick<User, "email"> | null | undefined,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const email = normalizeAccessReviewEmail(user?.email ?? "");
  if (!email) return false;
  return parseOperatorEmailAllowlist(env).has(email);
}

export function createAccessGrantToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashAccessGrantToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isAccessGrantTokenShape(token: string): boolean {
  return ACCESS_GRANT_TOKEN_RE.test(token.trim());
}

export function resolveApprovedAccessRequestWorkspaceName(
  request: Pick<ApprovedAccessRequestRecoveryRow, "company_name" | "requester_name">,
  fallback = "My Organization"
): string {
  const companyName = typeof request.company_name === "string" ? request.company_name.trim() : "";
  if (companyName) return companyName;
  const requesterName = typeof request.requester_name === "string" ? request.requester_name.trim() : "";
  return requesterName ? `${requesterName}'s Organization` : fallback;
}

function isUniqueConstraintError(error: unknown): boolean {
  const e = error as { code?: unknown; message?: unknown; details?: unknown };
  const code = typeof e.code === "string" ? e.code : "";
  const message = typeof e.message === "string" ? e.message : "";
  const details = typeof e.details === "string" ? e.details : "";
  return code === "23505" || /duplicate key|unique/i.test(`${message} ${details}`);
}

async function updateExistingAccessRequestRecord(
  admin: Admin,
  existing: ExistingAccessRequestLookup,
  input: AccessRequestInsert,
  nowIso: string,
  lastSubmission: Record<string, unknown>
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const duplicateCount =
    typeof existing.duplicate_count === "number" && Number.isFinite(existing.duplicate_count)
      ? existing.duplicate_count + 1
      : 1;
  const { error: updateError } = await admin
    .from("workspace_access_requests")
    .update({
      requester_name: input.requesterName,
      company_name: input.companyName,
      requester_role: input.requesterRole,
      approximate_contract_count: input.approximateContractCount,
      current_tracking_method: input.currentTrackingMethod,
      has_tracker: input.hasTracker,
      redacted_sample_available: input.redactedSampleAvailable,
      follow_up_preference: input.followUpPreference,
      pain_summary: input.painSummary,
      message: input.message,
      source: input.source,
      duplicate_count: duplicateCount,
      last_submitted_at: nowIso,
      last_submission_json: lastSubmission,
      updated_at: nowIso,
    })
    .eq("id", existing.id);
  if (updateError) return { ok: false, error: "update_failed" };
  await admin.from("workspace_access_request_events").insert({
    request_id: existing.id,
    actor_user_id: null,
    action: "access_request.duplicate_received",
    metadata_json: lastSubmission,
  });
  return { ok: true, id: String(existing.id) };
}

export async function insertAccessRequestRecord(
  admin: Admin,
  input: AccessRequestInsert
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const normalizedEmail = normalizeAccessReviewEmail(input.normalizedEmail);
  if (!isReasonableEmail(normalizedEmail)) return { ok: false, error: "invalid_email" };
  const nowIso = new Date().toISOString();
  const lastSubmission = {
    source: input.source,
    requester_role: input.requesterRole,
    approximate_contract_count: input.approximateContractCount,
    current_tracking_method: input.currentTrackingMethod,
    has_tracker: input.hasTracker,
    redacted_sample_available: input.redactedSampleAvailable,
    follow_up_preference: input.followUpPreference,
    accountable_owner: input.accountableOwner ?? "",
    procurement_before_upload: input.procurementBeforeUpload ?? "",
    small_first_set: input.smallFirstSet ?? "",
  };

  const { data: existing, error: existingError } = await admin
    .from("workspace_access_requests")
    .select("id, duplicate_count")
    .eq("normalized_email", normalizedEmail)
    .maybeSingle();

  if (existingError) return { ok: false, error: "lookup_failed" };
  if (existing?.id) {
    return updateExistingAccessRequestRecord(admin, existing, input, nowIso, lastSubmission);
  }

  const { data, error } = await admin
    .from("workspace_access_requests")
    .insert({
      normalized_email: normalizedEmail,
      requester_name: input.requesterName,
      company_name: input.companyName,
      requester_role: input.requesterRole,
      approximate_contract_count: input.approximateContractCount,
      current_tracking_method: input.currentTrackingMethod,
      has_tracker: input.hasTracker,
      redacted_sample_available: input.redactedSampleAvailable,
      follow_up_preference: input.followUpPreference,
      pain_summary: input.painSummary,
      message: input.message,
      source: input.source,
      status: "pending",
      duplicate_count: 0,
      last_submitted_at: nowIso,
      last_submission_json: lastSubmission,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    if (error && isUniqueConstraintError(error)) {
      const { data: raced, error: racedError } = await admin
        .from("workspace_access_requests")
        .select("id, duplicate_count")
        .eq("normalized_email", normalizedEmail)
        .maybeSingle();
      if (racedError || !raced?.id) return { ok: false, error: "insert_failed" };
      return updateExistingAccessRequestRecord(admin, raced as ExistingAccessRequestLookup, input, nowIso, lastSubmission);
    }
    return { ok: false, error: "insert_failed" };
  }
  await admin.from("workspace_access_request_events").insert({
    request_id: String(data.id),
    actor_user_id: null,
    action: "access_request.received",
    metadata_json: lastSubmission,
  });
  return { ok: true, id: String(data.id) };
}

export async function createWorkspaceAccessGrant(
  admin: Admin,
  input: {
    requestId?: string | null;
    normalizedEmail: string;
    operatorUserId: string;
    now?: Date;
  }
): Promise<{ ok: true; token: string; grant: AccessGrantRow } | { ok: false; error: string }> {
  const normalizedEmail = normalizeAccessReviewEmail(input.normalizedEmail);
  if (!isReasonableEmail(normalizedEmail)) return { ok: false, error: "invalid_email" };

  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + ACCESS_GRANT_TTL_MS).toISOString();
  const token = createAccessGrantToken();
  const tokenHash = hashAccessGrantToken(token);

  if (input.requestId) {
    const { error: revokeError } = await admin
      .from("workspace_access_grants")
      .update({ status: "revoked", revoked_at: now.toISOString() })
      .eq("request_id", input.requestId)
      .eq("status", "issued");
    if (revokeError) return { ok: false, error: "grant_revoke_failed" };
  }

  const { data, error } = await admin
    .from("workspace_access_grants")
    .insert({
      request_id: input.requestId ?? null,
      normalized_email: normalizedEmail,
      token_hash: tokenHash,
      status: "issued",
      expires_at: expiresAt,
      issued_by: input.operatorUserId,
    })
    .select("id, request_id, normalized_email, status, expires_at, issued_by, used_by, used_at, revoked_at, created_at")
    .single();

  if (error || !data) return { ok: false, error: "grant_insert_failed" };
  return { ok: true, token, grant: data as AccessGrantRow };
}

export async function validateWorkspaceAccessGrant(
  admin: Admin,
  input: { token: string; email: string; now?: Date }
): Promise<
  | { ok: true; grant: AccessGrantRow }
  | {
      ok: false;
      error:
        | "missing_grant"
        | "invalid_grant"
        | "grant_expired"
        | "grant_revoked"
        | "grant_used"
        | "grant_email_mismatch"
        | "grant_unavailable";
    }
> {
  const token = input.token.trim();
  if (!token) return { ok: false, error: "missing_grant" };
  if (!isAccessGrantTokenShape(token)) return { ok: false, error: "invalid_grant" };

  const normalizedEmail = normalizeAccessReviewEmail(input.email);
  if (!isReasonableEmail(normalizedEmail)) return { ok: false, error: "grant_email_mismatch" };

  const { data, error } = await admin
    .from("workspace_access_grants")
    .select("id, request_id, normalized_email, status, expires_at, issued_by, used_by, used_at, revoked_at, created_at")
    .eq("token_hash", hashAccessGrantToken(token))
    .maybeSingle();

  if (error) return { ok: false, error: "grant_unavailable" };
  if (!data) return { ok: false, error: "invalid_grant" };

  const grant = data as AccessGrantRow;
  if (grant.status === "used") return { ok: false, error: "grant_used" };
  if (grant.status === "revoked") return { ok: false, error: "grant_revoked" };
  if (grant.status === "expired") return { ok: false, error: "grant_expired" };
  if (grant.status !== "issued") return { ok: false, error: "invalid_grant" };
  if (grant.normalized_email !== normalizedEmail) return { ok: false, error: "grant_email_mismatch" };

  const nowMs = (input.now ?? new Date()).getTime();
  if (new Date(grant.expires_at).getTime() <= nowMs) {
    await admin.from("workspace_access_grants").update({ status: "expired" }).eq("id", grant.id).eq("status", "issued");
    return { ok: false, error: "grant_expired" };
  }

  return { ok: true, grant };
}

export async function validateConsumedWorkspaceAccessGrantForUser(
  admin: Admin,
  input: { token: string; email: string; userId: string }
): Promise<{ ok: true; grant: AccessGrantRow } | { ok: false; error: string }> {
  const token = input.token.trim();
  if (!token) return { ok: false, error: "missing_grant" };
  if (!isAccessGrantTokenShape(token)) return { ok: false, error: "invalid_grant" };

  const normalizedEmail = normalizeAccessReviewEmail(input.email);
  if (!isReasonableEmail(normalizedEmail)) return { ok: false, error: "grant_email_mismatch" };

  const userId = input.userId.trim();
  if (!userId) return { ok: false, error: "grant_user_mismatch" };

  const { data, error } = await admin
    .from("workspace_access_grants")
    .select("id, request_id, normalized_email, status, expires_at, issued_by, used_by, used_at, revoked_at, created_at")
    .eq("token_hash", hashAccessGrantToken(token))
    .maybeSingle();

  if (error) return { ok: false, error: "grant_unavailable" };
  if (!data) return { ok: false, error: "invalid_grant" };

  const grant = data as AccessGrantRow;
  if (grant.status !== "used") return { ok: false, error: "grant_not_consumed" };
  if (grant.normalized_email !== normalizedEmail) return { ok: false, error: "grant_email_mismatch" };
  if (grant.used_by !== userId) return { ok: false, error: "grant_user_mismatch" };
  return { ok: true, grant };
}

export async function recoverWorkspaceAccessGrantForAuthenticatedUser(
  admin: Admin,
  input: { email: string; userId: string; now?: Date }
): Promise<{ ok: true; grant: AccessGrantRow } | { ok: false; error: string }> {
  const normalizedEmail = normalizeAccessReviewEmail(input.email);
  if (!isReasonableEmail(normalizedEmail)) return { ok: false, error: "grant_email_mismatch" };

  const userId = input.userId.trim();
  if (!userId) return { ok: false, error: "grant_user_mismatch" };

  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const { data, error } = await admin
    .from("workspace_access_grants")
    .select("id, request_id, normalized_email, status, expires_at, issued_by, used_by, used_at, revoked_at, created_at")
    .eq("normalized_email", normalizedEmail)
    .in("status", ["issued", "used"])
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) return { ok: false, error: "grant_unavailable" };
  const grants = Array.isArray(data) ? (data as AccessGrantRow[]) : [];

  for (const grant of grants) {
    if (grant.status === "used") {
      if (grant.used_by === userId) return { ok: true, grant };
      continue;
    }

    if (grant.status !== "issued") continue;
    if (new Date(grant.expires_at).getTime() <= now.getTime()) {
      await admin.from("workspace_access_grants").update({ status: "expired" }).eq("id", grant.id).eq("status", "issued");
      continue;
    }

    const { data: consumed, error: consumeError } = await admin
      .from("workspace_access_grants")
      .update({ status: "used", used_by: userId, used_at: nowIso })
      .eq("id", grant.id)
      .eq("status", "issued")
      .eq("normalized_email", normalizedEmail)
      .gt("expires_at", nowIso)
      .select("id, request_id, normalized_email, status, expires_at, issued_by, used_by, used_at, revoked_at, created_at")
      .maybeSingle();
    if (consumeError) return { ok: false, error: "grant_consume_failed" };
    if (consumed) return { ok: true, grant: consumed as AccessGrantRow };
  }

  return { ok: false, error: "grant_not_recoverable" };
}

export async function recoverApprovedWorkspaceAccessRequestForAuthenticatedUser(
  admin: Admin,
  input: { email: string }
): Promise<{ ok: true; request: ApprovedAccessRequestRecoveryRow } | { ok: false; error: string }> {
  const normalizedEmail = normalizeAccessReviewEmail(input.email);
  if (!isReasonableEmail(normalizedEmail)) return { ok: false, error: "request_email_mismatch" };

  const { data: request, error: requestError } = await admin
    .from("workspace_access_requests")
    .select("id, normalized_email, requester_name, company_name, status")
    .eq("normalized_email", normalizedEmail)
    .eq("status", "approved")
    .maybeSingle();
  if (requestError) return { ok: false, error: "request_unavailable" };
  if (!request) return { ok: false, error: "request_not_recoverable" };

  const row = request as ApprovedAccessRequestRecoveryRow;
  if (row.normalized_email !== normalizedEmail || row.status !== "approved") {
    return { ok: false, error: "request_not_recoverable" };
  }

  const { data: grants, error: grantsError } = await admin
    .from("workspace_access_grants")
    .select("id, status")
    .eq("request_id", row.id)
    .order("created_at", { ascending: false })
    .limit(1);
  if (grantsError) return { ok: false, error: "grant_unavailable" };
  if (Array.isArray(grants) && grants.length > 0) return { ok: false, error: "grant_present" };

  return { ok: true, request: row };
}

export async function inspectWorkspaceAccessGrantToken(
  admin: Admin,
  input: { token: string; now?: Date }
): Promise<{ state: AccessGrantInspectionState }> {
  const token = input.token.trim();
  if (!token) return { state: "missing" };
  if (!isAccessGrantTokenShape(token)) return { state: "invalid" };

  const { data, error } = await admin
    .from("workspace_access_grants")
    .select("id, status, expires_at")
    .eq("token_hash", hashAccessGrantToken(token))
    .maybeSingle();

  if (error) return { state: "unavailable" };
  if (!data) return { state: "invalid" };

  const status = (data as { status?: string }).status;
  if (status === "used") return { state: "used" };
  if (status === "revoked") return { state: "revoked" };
  if (status === "expired") return { state: "expired" };
  if (status !== "issued") return { state: "invalid" };

  const expiresAt = (data as { expires_at?: string }).expires_at ?? "";
  const nowMs = (input.now ?? new Date()).getTime();
  if (new Date(expiresAt).getTime() <= nowMs) {
    await admin
      .from("workspace_access_grants")
      .update({ status: "expired" })
      .eq("id", (data as { id: string }).id)
      .eq("status", "issued");
    return { state: "expired" };
  }

  return { state: "valid_workspace_creation" };
}

export async function markWorkspaceAccessGrantUsed(
  admin: Admin,
  input: { grantId: string; userId: string; now?: Date }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const nowIso = (input.now ?? new Date()).toISOString();
  const { data, error } = await admin
    .from("workspace_access_grants")
    .update({ status: "used", used_by: input.userId, used_at: nowIso })
    .eq("id", input.grantId)
    .eq("status", "issued")
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: "grant_consume_failed" };
  if (!data?.id) return { ok: false, error: "grant_consume_stale" };
  return { ok: true };
}
