import type { Metadata } from "next";
import { CheckCircle2, CircleSlash, LockKeyhole, RotateCw, XCircle } from "lucide-react";
import {
  type AccessRequestEventRow,
  type AccessGrantRow,
  type AccessRequestRow,
} from "@/lib/access-review";
import {
  approveAccessRequest,
  closeAccessRequest,
  reopenAccessRequest,
  requireOperatorContext,
  resendAccessGrant,
  rejectAccessRequest,
  revokeAccessGrant,
} from "@/lib/operator/access-requests-actions";
import {
  eventsForRequest,
  FitContext,
  formatDateTime,
  GrantStatus,
  latestGrantForRequest,
  statusClass,
} from "./access-requests-parts";

export const metadata: Metadata = {
  title: "Access requests - Oblixa",
  robots: { index: false, follow: false },
};

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
              : q.error === "step_up_required"
                ? "Recent password confirmation is required before changing access requests."
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
