import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { resolveAppBaseUrl } from "@/lib/app-url";
import { sendWorkspaceAccessGrantEmail } from "@/lib/email";
import {
  ACCESS_GRANT_TTL_MS,
  createWorkspaceAccessGrant,
  isAuthorizedOperatorUser,
  type AccessRequestRow,
} from "@/lib/access-review";
import { hasSensitiveActionProof } from "@/lib/security/sensitive-action-proof";
import { isUuid, validateBoundedString } from "@/lib/security/validation";

export const OPERATOR_ACCESS_REQUESTS_ROUTE = "/operator/access-requests";

type OperatorContext = {
  admin: Awaited<ReturnType<typeof createAdminClient>>;
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
};

export async function requireOperatorContext(): Promise<OperatorContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAuthorizedOperatorUser(user)) notFound();
  return { admin: await createAdminClient(), supabase, userId: user.id };
}

async function requireOperatorSensitiveActionContext(): Promise<OperatorContext> {
  const ctx = await requireOperatorContext();
  if (!(await hasSensitiveActionProof(ctx.supabase, ctx.userId))) {
    redirect(`${OPERATOR_ACCESS_REQUESTS_ROUTE}?error=step_up_required`);
  }
  return ctx;
}

function safeNote(formData: FormData): string {
  const validation = validateBoundedString(formData.get("operatorNote") ?? "", {
    maxLength: 600,
    allowEmpty: true,
  });
  return validation.ok ? validation.value : "";
}

type AccessRequestMutationRow = Pick<AccessRequestRow, "id" | "normalized_email" | "status">;

async function loadAccessRequestForMutation(
  admin: OperatorContext["admin"],
  requestId: string
): Promise<AccessRequestMutationRow> {
  const { data, error } = await admin
    .from("workspace_access_requests")
    .select("id, normalized_email, status")
    .eq("id", requestId)
    .maybeSingle();
  if (error || !data) notFound();
  return data as AccessRequestMutationRow;
}

async function recordAccessRequestEvent(
  admin: OperatorContext["admin"],
  input: {
    requestId: string;
    actorUserId: string;
    action: string;
    metadata?: Record<string, unknown>;
  }
) {
  await admin.from("workspace_access_request_events").insert({
    request_id: input.requestId,
    actor_user_id: input.actorUserId,
    action: input.action,
    metadata_json: input.metadata ?? {},
  });
}

async function sendGrantEmail(input: {
  email: string;
  token: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const appUrl = await resolveAppBaseUrl();
  const actionUrl = `${appUrl.replace(/\/+$/, "")}/signup?grant=${encodeURIComponent(input.token)}`;
  const sent = await sendWorkspaceAccessGrantEmail({
    to: input.email,
    actionUrl,
    expiresInDays: ACCESS_GRANT_TTL_MS / (24 * 60 * 60 * 1000),
  });
  if (sent.error) {
    console.error("[operator/access-requests] grant email failed", { error: sent.error.message });
    return { ok: false, error: "email_failed" };
  }
  return { ok: true };
}

export async function approveAccessRequest(formData: FormData) {
  "use server";
  const requestId = String(formData.get("requestId") ?? "").trim();
  if (!isUuid(requestId)) notFound();

  const { admin, userId } = await requireOperatorSensitiveActionContext();
  const request = await loadAccessRequestForMutation(admin, requestId);
  if (request.status !== "pending") redirect(`${OPERATOR_ACCESS_REQUESTS_ROUTE}?error=approve_state`);
  const nowIso = new Date().toISOString();
  const grant = await createWorkspaceAccessGrant(admin, {
    requestId,
    normalizedEmail: request.normalized_email,
    operatorUserId: userId,
  });
  if (!grant.ok) redirect(`${OPERATOR_ACCESS_REQUESTS_ROUTE}?error=grant_failed`);

  const { data: updatedRequest, error: updateError } = await admin
    .from("workspace_access_requests")
    .update({
      status: "approved",
      last_operator_note: safeNote(formData) || null,
      decided_by: userId,
      decided_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (updateError || !updatedRequest?.id) {
    await admin
      .from("workspace_access_grants")
      .update({ status: "revoked", revoked_at: nowIso })
      .eq("id", grant.grant.id)
      .eq("status", "issued");
    redirect(`${OPERATOR_ACCESS_REQUESTS_ROUTE}?error=approval_update_failed`);
  }
  await recordAccessRequestEvent(admin, {
    requestId,
    actorUserId: userId,
    action: "access_request.approved",
    metadata: { grant_id: grant.grant.id },
  });
  const delivery = await sendGrantEmail({ email: request.normalized_email, token: grant.token });
  await recordAccessRequestEvent(admin, {
    requestId,
    actorUserId: userId,
    action: delivery.ok ? "access_grant.sent" : "access_grant.send_failed",
    metadata: { grant_id: grant.grant.id },
  });
  revalidatePath(OPERATOR_ACCESS_REQUESTS_ROUTE);
  redirect(`${OPERATOR_ACCESS_REQUESTS_ROUTE}?notice=${delivery.ok ? "grant_sent" : "grant_delivery_failed"}`);
}

export async function resendAccessGrant(formData: FormData) {
  "use server";
  const requestId = String(formData.get("requestId") ?? "").trim();
  if (!isUuid(requestId)) notFound();

  const { admin, userId } = await requireOperatorSensitiveActionContext();
  const request = await loadAccessRequestForMutation(admin, requestId);
  if (request.status !== "approved") redirect(`${OPERATOR_ACCESS_REQUESTS_ROUTE}?error=resend_state`);
  const grant = await createWorkspaceAccessGrant(admin, {
    requestId,
    normalizedEmail: request.normalized_email,
    operatorUserId: userId,
  });
  if (!grant.ok) redirect(`${OPERATOR_ACCESS_REQUESTS_ROUTE}?error=grant_failed`);
  await recordAccessRequestEvent(admin, {
    requestId,
    actorUserId: userId,
    action: "access_grant.resent",
    metadata: { grant_id: grant.grant.id },
  });
  const delivery = await sendGrantEmail({ email: request.normalized_email, token: grant.token });
  await recordAccessRequestEvent(admin, {
    requestId,
    actorUserId: userId,
    action: delivery.ok ? "access_grant.sent" : "access_grant.send_failed",
    metadata: { grant_id: grant.grant.id },
  });
  revalidatePath(OPERATOR_ACCESS_REQUESTS_ROUTE);
  redirect(`${OPERATOR_ACCESS_REQUESTS_ROUTE}?notice=${delivery.ok ? "grant_sent" : "grant_delivery_failed"}`);
}

export async function rejectAccessRequest(formData: FormData) {
  "use server";
  const requestId = String(formData.get("requestId") ?? "").trim();
  if (!isUuid(requestId)) notFound();

  const { admin, userId } = await requireOperatorSensitiveActionContext();
  const request = await loadAccessRequestForMutation(admin, requestId);
  if (request.status !== "pending") redirect(`${OPERATOR_ACCESS_REQUESTS_ROUTE}?error=reject_state`);
  const nowIso = new Date().toISOString();
  const { data: updatedRequest, error: updateError } = await admin
    .from("workspace_access_requests")
    .update({
      status: "rejected",
      last_operator_note: safeNote(formData) || null,
      decided_by: userId,
      decided_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (updateError || !updatedRequest?.id) redirect(`${OPERATOR_ACCESS_REQUESTS_ROUTE}?error=mutation_failed`);
  await recordAccessRequestEvent(admin, {
    requestId,
    actorUserId: userId,
    action: "access_request.rejected",
  });
  revalidatePath(OPERATOR_ACCESS_REQUESTS_ROUTE);
}

export async function closeAccessRequest(formData: FormData) {
  "use server";
  const requestId = String(formData.get("requestId") ?? "").trim();
  if (!isUuid(requestId)) notFound();

  const { admin, userId } = await requireOperatorSensitiveActionContext();
  const request = await loadAccessRequestForMutation(admin, requestId);
  if (request.status !== "pending") redirect(`${OPERATOR_ACCESS_REQUESTS_ROUTE}?error=close_state`);
  const nowIso = new Date().toISOString();
  const { data: updatedRequest, error: updateError } = await admin
    .from("workspace_access_requests")
    .update({
      status: "closed",
      last_operator_note: safeNote(formData) || null,
      decided_by: userId,
      decided_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (updateError || !updatedRequest?.id) redirect(`${OPERATOR_ACCESS_REQUESTS_ROUTE}?error=mutation_failed`);
  await recordAccessRequestEvent(admin, {
    requestId,
    actorUserId: userId,
    action: "access_request.closed",
  });
  revalidatePath(OPERATOR_ACCESS_REQUESTS_ROUTE);
}

export async function reopenAccessRequest(formData: FormData) {
  "use server";
  const requestId = String(formData.get("requestId") ?? "").trim();
  if (!isUuid(requestId)) notFound();

  const { admin, userId } = await requireOperatorSensitiveActionContext();
  const request = await loadAccessRequestForMutation(admin, requestId);
  if (request.status !== "closed" && request.status !== "rejected") {
    redirect(`${OPERATOR_ACCESS_REQUESTS_ROUTE}?error=reopen_state`);
  }
  const nowIso = new Date().toISOString();
  const { data: updatedRequest, error: updateError } = await admin
    .from("workspace_access_requests")
    .update({
      status: "pending",
      last_operator_note: safeNote(formData) || null,
      decided_by: null,
      decided_at: null,
      updated_at: nowIso,
    })
    .eq("id", requestId)
    .in("status", ["closed", "rejected"])
    .select("id")
    .maybeSingle();
  if (updateError || !updatedRequest?.id) redirect(`${OPERATOR_ACCESS_REQUESTS_ROUTE}?error=mutation_failed`);
  await recordAccessRequestEvent(admin, {
    requestId,
    actorUserId: userId,
    action: "access_request.reopened",
  });
  revalidatePath(OPERATOR_ACCESS_REQUESTS_ROUTE);
}

export async function revokeAccessGrant(formData: FormData) {
  "use server";
  const grantId = String(formData.get("grantId") ?? "").trim();
  const requestId = String(formData.get("requestId") ?? "").trim();
  if (!isUuid(grantId)) notFound();

  const { admin, userId } = await requireOperatorSensitiveActionContext();
  const { data: grant } = await admin
    .from("workspace_access_grants")
    .select("id, request_id, status")
    .eq("id", grantId)
    .maybeSingle();
  if (!grant || (grant as { status?: string }).status !== "issued") notFound();
  if (isUuid(requestId) && (grant as { request_id?: string | null }).request_id !== requestId) notFound();
  const { data: updatedGrant, error: updateError } = await admin
    .from("workspace_access_grants")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", grantId)
    .eq("status", "issued")
    .select("id")
    .maybeSingle();
  if (updateError || !updatedGrant?.id) notFound();
  if (isUuid(requestId)) {
    await recordAccessRequestEvent(admin, {
      requestId,
      actorUserId: userId,
      action: "access_grant.revoked",
      metadata: { grant_id: grantId },
    });
  }
  revalidatePath(OPERATOR_ACCESS_REQUESTS_ROUTE);
}
