import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { CheckCircle2, CircleSlash, LockKeyhole, RotateCw, ShieldAlert, XCircle } from "lucide-react";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { resolveAppBaseUrl } from "@/lib/app-url";
import { sendWorkspaceAccessGrantEmail } from "@/lib/email";
import {
  ACCESS_GRANT_TTL_MS,
  createWorkspaceAccessGrant,
  isAuthorizedOperatorUser,
  type AccessRequestEventRow,
  type AccessGrantRow,
  type AccessRequestRow,
} from "@/lib/access-review";
import { isUuid, validateBoundedString } from "@/lib/security/validation";

export const metadata: Metadata = {
  title: "Access requests - Oblixa",
  robots: { index: false, follow: false },
};

const ROUTE = "/operator/access-requests";

type OperatorContext = {
  admin: Awaited<ReturnType<typeof createAdminClient>>;
  userId: string;
};

async function requireOperatorContext(): Promise<OperatorContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAuthorizedOperatorUser(user)) notFound();
  return { admin: await createAdminClient(), userId: user.id };
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

  const { admin, userId } = await requireOperatorContext();
  const request = await loadAccessRequestForMutation(admin, requestId);
  if (request.status !== "pending") redirect(`${ROUTE}?error=approve_state`);
  const nowIso = new Date().toISOString();
  const grant = await createWorkspaceAccessGrant(admin, {
    requestId,
    normalizedEmail: request.normalized_email,
    operatorUserId: userId,
  });
  if (!grant.ok) redirect(`${ROUTE}?error=grant_failed`);

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
    redirect(`${ROUTE}?error=approval_update_failed`);
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
  revalidatePath(ROUTE);
  redirect(`${ROUTE}?notice=${delivery.ok ? "grant_sent" : "grant_delivery_failed"}`);
}

export async function resendAccessGrant(formData: FormData) {
  "use server";
  const requestId = String(formData.get("requestId") ?? "").trim();
  if (!isUuid(requestId)) notFound();

  const { admin, userId } = await requireOperatorContext();
  const request = await loadAccessRequestForMutation(admin, requestId);
  if (request.status !== "approved") redirect(`${ROUTE}?error=resend_state`);
  const grant = await createWorkspaceAccessGrant(admin, {
    requestId,
    normalizedEmail: request.normalized_email,
    operatorUserId: userId,
  });
  if (!grant.ok) redirect(`${ROUTE}?error=grant_failed`);
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
  revalidatePath(ROUTE);
  redirect(`${ROUTE}?notice=${delivery.ok ? "grant_sent" : "grant_delivery_failed"}`);
}

export async function rejectAccessRequest(formData: FormData) {
  "use server";
  const requestId = String(formData.get("requestId") ?? "").trim();
  if (!isUuid(requestId)) notFound();

  const { admin, userId } = await requireOperatorContext();
  const request = await loadAccessRequestForMutation(admin, requestId);
  if (request.status !== "pending") redirect(`${ROUTE}?error=reject_state`);
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
  if (updateError || !updatedRequest?.id) redirect(`${ROUTE}?error=mutation_failed`);
  await recordAccessRequestEvent(admin, {
    requestId,
    actorUserId: userId,
    action: "access_request.rejected",
  });
  revalidatePath(ROUTE);
}

export async function closeAccessRequest(formData: FormData) {
  "use server";
  const requestId = String(formData.get("requestId") ?? "").trim();
  if (!isUuid(requestId)) notFound();

  const { admin, userId } = await requireOperatorContext();
  const request = await loadAccessRequestForMutation(admin, requestId);
  if (request.status !== "pending") redirect(`${ROUTE}?error=close_state`);
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
  if (updateError || !updatedRequest?.id) redirect(`${ROUTE}?error=mutation_failed`);
  await recordAccessRequestEvent(admin, {
    requestId,
    actorUserId: userId,
    action: "access_request.closed",
  });
  revalidatePath(ROUTE);
}

export async function reopenAccessRequest(formData: FormData) {
  "use server";
  const requestId = String(formData.get("requestId") ?? "").trim();
  if (!isUuid(requestId)) notFound();

  const { admin, userId } = await requireOperatorContext();
  const request = await loadAccessRequestForMutation(admin, requestId);
  if (request.status !== "closed" && request.status !== "rejected") redirect(`${ROUTE}?error=reopen_state`);
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
  if (updateError || !updatedRequest?.id) redirect(`${ROUTE}?error=mutation_failed`);
  await recordAccessRequestEvent(admin, {
    requestId,
    actorUserId: userId,
    action: "access_request.reopened",
  });
  revalidatePath(ROUTE);
}

export async function revokeAccessGrant(formData: FormData) {
  "use server";
  const grantId = String(formData.get("grantId") ?? "").trim();
  const requestId = String(formData.get("requestId") ?? "").trim();
  if (!isUuid(grantId)) notFound();

  const { admin, userId } = await requireOperatorContext();
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
  revalidatePath(ROUTE);
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return "-";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ms));
}

function statusClass(status: string): string {
  const base = "inline-flex max-w-max items-center rounded-full border px-2 py-0.5 font-semibold uppercase tracking-[0.12em]";
  if (status === "approved" || status === "issued") {
    return `${base} border-[color:color-mix(in_oklab,var(--success)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--success-soft)_28%,var(--surface))] text-[var(--success-ink)]`;
  }
  if (status === "rejected" || status === "revoked" || status === "expired") {
    return `${base} border-[color:color-mix(in_oklab,var(--danger)_28%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--danger-soft)_28%,var(--surface))] text-[var(--danger-ink)]`;
  }
  if (status === "used" || status === "closed") {
    return `${base} border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-tertiary)]`;
  }
  return `${base} border-[color:color-mix(in_oklab,var(--warning)_28%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning-soft)_30%,var(--surface))] text-[var(--warning-ink)]`;
}

function latestGrantForRequest(grants: AccessGrantRow[], requestId: string): AccessGrantRow | null {
  return grants.find((grant) => grant.request_id === requestId) ?? null;
}

function eventsForRequest(events: AccessRequestEventRow[], requestId: string): AccessRequestEventRow[] {
  return events.filter((event) => event.request_id === requestId).slice(0, 5);
}

type FitTone = "success" | "warning" | "danger" | "neutral";

function fitChipClass(tone: FitTone): string {
  const base = "inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-medium";
  if (tone === "success")
    return `${base} border-[color:color-mix(in_oklab,var(--success)_24%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--success-soft)_24%,var(--surface))] text-[var(--success-ink)]`;
  if (tone === "warning")
    return `${base} border-[color:color-mix(in_oklab,var(--warning)_24%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning-soft)_24%,var(--surface))] text-[var(--warning-ink)]`;
  if (tone === "danger")
    return `${base} border-[color:color-mix(in_oklab,var(--danger)_24%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--danger-soft)_24%,var(--surface))] text-[var(--danger-ink)]`;
  return `${base} border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-secondary)]`;
}

function submissionValue(json: AccessRequestRow["last_submission_json"], key: string): string {
  const v = json?.[key];
  return typeof v === "string" ? v.trim() : "";
}

/** Fit context captured in last_submission_json (owner / small-set / sample /
 *  procurement-before-upload) surfaced as scannable chips for access review.
 *  A required procurement/security review *before upload* is a release pause
 *  signal, so it reads as a prominent dependency marker rather than one chip among
 *  many. Raw JSON stays out of the primary visual path. */
function FitContext({ request }: { request: AccessRequestRow }) {
  const json = request.last_submission_json;
  const owner = submissionValue(json, "accountable_owner");
  const smallSet = submissionValue(json, "small_first_set");
  const procurement = submissionValue(json, "procurement_before_upload");
  const sample = (request.redacted_sample_available ?? "").trim();
  const yn = (v: string) => (v === "unsure" ? "?" : v);
  const procurementBlocker = procurement === "yes";

  const chips: Array<{ key: string; label: string; tone: FitTone }> = [];
  if (owner)
    chips.push({
      key: "owner",
      label: owner === "self" ? "Owner ready" : owner === "named" ? "Owner named" : "Owner TBD",
      tone: owner === "self" ? "success" : owner === "named" ? "neutral" : "warning",
    });
  if (smallSet)
    chips.push({
      key: "small",
      label: `Small set: ${yn(smallSet)}`,
      tone: smallSet === "yes" ? "success" : smallSet === "no" ? "warning" : "neutral",
    });
  if (sample)
    chips.push({
      key: "sample",
      label: `Sample: ${yn(sample)}`,
      tone: sample === "yes" ? "success" : "neutral",
    });
  // "yes" surfaces as the dependency marker below; only maybe/no render as a chip.
  if (procurement && !procurementBlocker)
    chips.push({
      key: "proc",
      label: procurement === "maybe" ? "Procurement maybe" : "No procurement",
      tone: procurement === "maybe" ? "warning" : "success",
    });

  if (chips.length === 0 && !procurementBlocker) return null;
  return (
    <div className="mt-2">
      <p className="ui-caps-2 text-[9px] text-[var(--text-tertiary)]">Fit context</p>
      {procurementBlocker ? (
        <span
          className="mt-1 inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold text-[var(--danger-ink)]"
          style={{
            borderColor: "color-mix(in oklab, var(--danger) 40%, var(--border-subtle))",
            background: "color-mix(in oklab, var(--danger-soft) 36%, var(--surface))",
          }}
        >
          <ShieldAlert className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          Procurement dependency — security review before upload
        </span>
      ) : null}
      {chips.length > 0 ? (
        <div className="mt-1 flex flex-wrap gap-1">
          {chips.map((chip) => (
            <span key={chip.key} className={fitChipClass(chip.tone)}>
              {chip.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function GrantStatus({ grant }: { grant: AccessGrantRow | null }) {
  if (!grant) return <span className="ui-muted-tight text-xs">No grant issued</span>;
  return (
    <span className={`${statusClass(grant.status)} text-[11px]`}>
      {grant.status}
      <span className="ml-1 font-normal normal-case tracking-normal">until {formatDateTime(grant.expires_at)}</span>
    </span>
  );
}

export default async function OperatorAccessRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { admin } = await requireOperatorContext();
  const q = await searchParams;

  const [requestsRes, grantsRes, eventsRes] = await Promise.all([
    admin
      .from("workspace_access_requests")
      .select(
        "id, normalized_email, requester_name, company_name, requester_role, approximate_contract_count, current_tracking_method, has_tracker, redacted_sample_available, follow_up_preference, pain_summary, message, source, status, duplicate_count, last_submitted_at, last_submission_json, last_operator_note, decided_by, decided_at, created_at, updated_at"
      )
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("workspace_access_grants")
      .select("id, request_id, normalized_email, status, expires_at, issued_by, used_by, used_at, revoked_at, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("workspace_access_request_events")
      .select("id, request_id, actor_user_id, action, metadata_json, created_at")
      .order("created_at", { ascending: false })
      .limit(400),
  ]);

  const requests = ((requestsRes.data ?? []) as AccessRequestRow[]).filter(Boolean);
  const grants = ((grantsRes.data ?? []) as AccessGrantRow[]).filter(Boolean);
  const events = ((eventsRes.data ?? []) as AccessRequestEventRow[]).filter(Boolean);
  const pendingCount = requests.filter((request) => request.status === "pending").length;
  const approvedCount = requests.filter((request) => request.status === "approved").length;

  return (
    <main className="min-h-screen bg-[var(--canvas)] px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 border-b border-[var(--border-subtle)] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="ui-eyebrow">Internal operator</p>
            <h1 className="ui-page-title mt-2 text-[2rem]">Access requests</h1>
            <p className="ui-muted mt-2 max-w-2xl">
              Review workspace access requests, issue single-use signup grants, and keep a minimal audit trail for
              access decisions.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-right sm:min-w-64">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
              <p className="ui-caps-2 text-[10px] text-[var(--text-tertiary)]">Pending</p>
              <p className="mt-1 text-2xl font-semibold">{pendingCount}</p>
            </div>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
              <p className="ui-caps-2 text-[10px] text-[var(--text-tertiary)]">Approved</p>
              <p className="mt-1 text-2xl font-semibold">{approvedCount}</p>
            </div>
          </div>
        </header>

        {q.error ? (
          <div className="ui-alert-error mt-5" role="alert">
            {q.error === "grant_failed"
              ? "The request was updated only if the grant could be created. Try approving again after checking the grant table and provider configuration."
              : q.error === "approve_state"
                ? "Only pending access requests can be approved. Reopen the request first if needed."
                : q.error === "approval_update_failed"
                  ? "The grant was revoked because the request could not be marked approved. Refresh and try again."
                : q.error === "resend_state"
                  ? "Only approved access requests can receive a replacement grant."
                  : q.error === "reject_state"
                    ? "Only pending access requests can be rejected."
                    : q.error === "close_state"
                      ? "Only pending access requests can be closed."
                      : q.error === "reopen_state"
                        ? "Only rejected or closed access requests can be reopened."
                        : "Access-review action failed. Refresh and try again."}
          </div>
        ) : null}

        {q.notice ? (
          <section className="mt-5 rounded-2xl border border-[color:color-mix(in_oklab,var(--success)_28%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--success-soft)_38%,var(--surface))] p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-[var(--success-ink)]" strokeWidth={1.85} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {q.notice === "grant_sent" ? "Signup grant sent" : "Signup grant created"}
                </p>
                <p className="mt-1 text-[12.5px] text-[var(--text-secondary)]">
                  {q.notice === "grant_sent"
                    ? "The single-use access link was sent by email. Raw grant tokens are never placed in the operator URL."
                    : "Email delivery failed. The raw token is not shown in-browser; fix provider configuration and resend the grant."}
                </p>
              </div>
            </div>
          </section>
        ) : null}

        {requestsRes.error || grantsRes.error || eventsRes.error ? (
          <section className="mt-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-6">
            <div className="flex items-start gap-3">
              <LockKeyhole className="mt-0.5 h-5 w-5 text-[var(--text-tertiary)]" strokeWidth={1.85} aria-hidden />
              <div>
                <h2 className="text-lg font-semibold">Access review data is unavailable</h2>
                <p className="ui-muted mt-2 max-w-2xl">
                  The operator route is guarded, but the access-review tables are not readable in this environment.
                  Apply the access-review migration before using this page to review requests.
                </p>
              </div>
            </div>
          </section>
        ) : requests.length === 0 ? (
          <section className="mt-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-6">
            <h2 className="text-lg font-semibold">No access requests</h2>
            <p className="ui-muted mt-2">New request-access submissions will appear here after they are accepted.</p>
          </section>
        ) : (
          <section className="mt-6 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)]">
            <div className="grid grid-cols-[1.4fr_1fr_0.8fr_1.6fr] border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
              <span>Requester</span>
              <span>Fit</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            <ul className="divide-y divide-[var(--border-subtle)]">
              {requests.map((request) => {
                const grant = latestGrantForRequest(grants, request.id);
                const requestEvents = eventsForRequest(events, request.id);
                return (
                  <li key={request.id} className="grid grid-cols-[1.4fr_1fr_0.8fr_1.6fr] gap-4 px-4 py-4">
                    <div className="min-w-0">
                      <p className="ui-text-wrap text-sm font-semibold text-[var(--text-primary)]">
                        {request.requester_name || request.normalized_email}
                      </p>
                      <p className="ui-entity-text mt-1 text-[12.5px] text-[var(--text-secondary)]">
                        {request.normalized_email}
                      </p>
                      <p className="ui-text-wrap mt-1 text-[12px] text-[var(--text-tertiary)]">
                        {request.company_name || "No company"} · {formatDateTime(request.created_at)}
                      </p>
                      <p className="mt-1 text-[11.5px] text-[var(--text-tertiary)]">
                        {request.duplicate_count > 0
                          ? `${request.duplicate_count} duplicate update${
                              request.duplicate_count === 1 ? "" : "s"
                            }; last ${formatDateTime(request.last_submitted_at)}`
                          : `First submitted ${formatDateTime(request.last_submitted_at)}`}
                      </p>
                    </div>
                    <div className="min-w-0 text-[12.5px] text-[var(--text-secondary)]">
                      <p>{request.approximate_contract_count || "Contract count unknown"}</p>
                      <p className="mt-1">{request.current_tracking_method || "Tracking method unknown"}</p>
                      <p className="ui-text-wrap mt-1" title={request.pain_summary ?? undefined}>
                        {request.pain_summary || "No pain summary"}
                      </p>
                      <FitContext request={request} />
                    </div>
                    <div className="space-y-2">
                      <span className={`${statusClass(request.status)} text-[11px]`}>{request.status}</span>
                      <GrantStatus grant={grant} />
                    </div>
                    <div className="space-y-3">
                      <form action={approveAccessRequest} className="grid gap-2">
                        <input type="hidden" name="requestId" value={request.id} />
                        <textarea
                          name="operatorNote"
                          className="ui-textarea min-h-16 text-[12.5px]"
                          maxLength={600}
                          placeholder="Operator note"
                          defaultValue={request.last_operator_note ?? ""}
                        />
                        <div className="flex flex-wrap gap-2">
                          {request.status === "pending" ? (
                            <button type="submit" className="ui-btn-primary h-9 gap-1.5 px-3 text-[12px]">
                              <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                              Approve
                            </button>
                          ) : null}
                          {request.status === "approved" ? (
                            <button formAction={resendAccessGrant} className="ui-btn-secondary h-9 gap-1.5 px-3 text-[12px]">
                              <RotateCw className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                              Resend grant
                            </button>
                          ) : null}
                        </div>
                      </form>
                      <div className="flex flex-wrap gap-2">
                        {request.status === "pending" ? (
                          <>
                            <form action={rejectAccessRequest}>
                              <input type="hidden" name="requestId" value={request.id} />
                              <input type="hidden" name="operatorNote" value={request.last_operator_note ?? ""} />
                              <button className="ui-btn-secondary h-9 gap-1.5 px-3 text-[12px]">
                                <XCircle className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                                Reject
                              </button>
                            </form>
                            <form action={closeAccessRequest}>
                              <input type="hidden" name="requestId" value={request.id} />
                              <input type="hidden" name="operatorNote" value={request.last_operator_note ?? ""} />
                              <button className="ui-btn-ghost h-9 gap-1.5 px-3 text-[12px]">
                                <RotateCw className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                                Close
                              </button>
                            </form>
                          </>
                        ) : null}
                        {request.status === "closed" || request.status === "rejected" ? (
                          <form action={reopenAccessRequest}>
                            <input type="hidden" name="requestId" value={request.id} />
                            <input type="hidden" name="operatorNote" value={request.last_operator_note ?? ""} />
                            <button className="ui-btn-ghost h-9 gap-1.5 px-3 text-[12px]">
                              <RotateCw className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                              Reopen
                            </button>
                          </form>
                        ) : null}
                        {grant?.status === "issued" ? (
                          <form action={revokeAccessGrant}>
                            <input type="hidden" name="requestId" value={request.id} />
                            <input type="hidden" name="grantId" value={grant.id} />
                            <button className="ui-btn-secondary h-9 gap-1.5 px-3 text-[12px]">
                              <CircleSlash className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                              Revoke grant
                            </button>
                          </form>
                        ) : null}
                      </div>
                      {requestEvents.length > 0 ? (
                        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2">
                          <p className="ui-caps-2 text-[9px] text-[var(--text-tertiary)]">Audit</p>
                          <ul className="mt-1.5 space-y-1 text-[11.5px] text-[var(--text-secondary)]">
                            {requestEvents.map((event) => (
                              <li key={event.id} className="flex items-center justify-between gap-2">
                                <span className="truncate">{event.action}</span>
                                <span className="shrink-0 text-[var(--text-tertiary)]">{formatDateTime(event.created_at)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
