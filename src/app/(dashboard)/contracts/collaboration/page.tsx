import Link from "next/link";
import { Bell, MessageSquareText } from "lucide-react";
import { markNotificationReadVoid } from "@/actions/field-comments";
import { getAuthContext } from "@/lib/supabase/server";
import { OperationalSummaryCard } from "@/components/ui/operational-summary-card";
import { resolveCollaborationInternalNotificationHref } from "@/lib/notification-internal-deeplink";
import {
  getInAppNotificationCtaLabel,
  getInAppNotificationTypeLabel,
  truncateInAppNotificationBody,
} from "@/lib/in-app-notification-display";

export default async function CollaborationPage() {
  const ctx = await getAuthContext();
  if (!ctx) return null;
  const { admin, orgId, user } = ctx;

  const [{ data: comments }, { data: notifications }] = await Promise.all([
    admin
      .from("contract_field_comments")
      .select("id, comment, created_at, contract_id, contracts!inner(id, title, organization_id)")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("internal_notifications")
      .select("id, title, body, read_at, notification_type, entity_type, entity_id, created_at")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const commentCount = comments?.length ?? 0;
  const unreadNotifications = (notifications ?? []).filter((n) => !n.read_at).length;

  const approvalEntityIds = (notifications ?? [])
    .filter((n) => (n.entity_type === "contract_approval" || n.notification_type === "approval_requested") && n.entity_id)
    .map((n) => String(n.entity_id));
  const commentEntityIds = (notifications ?? [])
    .filter((n) => (n.entity_type === "field_comment" || n.notification_type === "mention") && n.entity_id)
    .map((n) => String(n.entity_id));

  const [{ data: approvalRows }, { data: commentRows }] = await Promise.all([
    approvalEntityIds.length
      ? admin
          .from("contract_approvals")
          .select("id, contract_id")
          .eq("organization_id", orgId)
          .in("id", approvalEntityIds)
      : Promise.resolve({ data: [] as { id: string; contract_id: string }[] }),
    commentEntityIds.length
      ? admin
          .from("contract_field_comments")
          .select("id, contract_id")
          .eq("organization_id", orgId)
          .in("id", commentEntityIds)
      : Promise.resolve({ data: [] as { id: string; contract_id: string }[] }),
  ]);

  const contractIdByApprovalId = new Map((approvalRows ?? []).map((r) => [r.id, r.contract_id]));
  const contractIdByCommentId = new Map((commentRows ?? []).map((r) => [r.id, r.contract_id]));

  return (
    <div className="ui-page-stack">
      <header className="border-b border-[var(--border-subtle)] pb-8">
        <div>
          <p className="ui-eyebrow">Cross-team coordination</p>
          <h1 className="ui-display-title mt-2">Collaboration workspace</h1>
          <p className="ui-page-lead mt-3 max-w-2xl">
            Field-level comments, mentions, and in-app notifications for handoffs and clarifications.
          </p>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <OperationalSummaryCard
          eyebrow="Threading"
          headline="Field comments (sample)"
          tone={commentCount > 0 ? "neutral" : "healthy"}
          icon={MessageSquareText}
          primaryValue={commentCount}
          primaryUnit="recent rows"
          action={{ href: "/contracts/collaboration", label: "Refresh" }}
          variant="compact"
        />
        <OperationalSummaryCard
          eyebrow="Inbox"
          headline="Unread notifications"
          tone={unreadNotifications > 0 ? "attention" : "healthy"}
          icon={Bell}
          primaryValue={unreadNotifications}
          primaryUnit="for you"
          action={{ href: "/contracts/collaboration", label: "Review below" }}
          variant="compact"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="ui-page-shell overflow-hidden">
          <div className="border-b border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,var(--canvas))] px-6 py-4">
            <p className="ui-eyebrow">Comments</p>
            <h2 className="ui-section-title mt-1 text-base">Recent field comments</h2>
            <p className="ui-support-copy mt-1">Use recent comments as the handoff layer for field clarifications before reopening the full contract record.</p>
          </div>
          {comments?.length ? (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {comments.map((row) => {
                const contract = (Array.isArray(row.contracts) ? row.contracts[0] : row.contracts) as
                  | { id: string; title: string }
                  | undefined;
                return (
                  <li key={row.id} className="px-6 py-4">
                    <p className="text-sm text-[var(--text-secondary)]">{row.comment}</p>
                    {contract && (
                      <Link href={`/contracts/${contract.id}`} className="mt-1 inline-block text-xs ui-link">
                        {contract.title}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-6 py-6 text-sm text-[var(--text-tertiary)]">No comments yet.</p>
          )}
        </section>

        <section className="ui-page-shell overflow-hidden">
          <div className="border-b border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,var(--canvas))] px-6 py-4">
            <p className="ui-eyebrow">Alerts</p>
            <h2 className="ui-section-title mt-1 text-base">My notifications</h2>
            <p className="ui-support-copy mt-1">Unread alerts stay action-oriented here so mentions, approvals, and contract follow-ups do not disappear into generic inbox text.</p>
          </div>
          {notifications?.length ? (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {notifications.map((row) => {
                const openHref = resolveCollaborationInternalNotificationHref({
                  notification_type: String(row.notification_type ?? ""),
                  entity_type: row.entity_type ?? null,
                  entity_id: row.entity_id ?? null,
                  contractIdByApprovalId,
                  contractIdByCommentId,
                });
                const notificationTypeLabel = getInAppNotificationTypeLabel(
                  row.notification_type ?? null,
                  row.entity_type ?? null
                );
                const ctaLabel = getInAppNotificationCtaLabel(
                  row.notification_type ?? null,
                  row.entity_type ?? null
                );
                return (
                  <li key={row.id} className="px-6 py-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-secondary)]">
                            {notificationTypeLabel}
                          </span>
                          {!row.read_at ? (
                            <span className="rounded-full border border-[color:color-mix(in_oklab,var(--warning)_42%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning)_12%,var(--surface))] px-2 py-0.5 text-[11px] font-semibold text-[var(--warning-ink)]">
                              Unread
                            </span>
                          ) : null}
                        </div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          {truncateInAppNotificationBody(row.title, 160)}
                        </p>
                        {row.body ? (
                          <p className="mt-1 text-xs text-[var(--text-secondary)]">{truncateInAppNotificationBody(row.body)}</p>
                        ) : null}
                        <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                          {new Date(row.created_at).toISOString().slice(0, 16).replace("T", " ")}
                        </p>
                        <div className="mt-2">
                          <Link href={openHref} className="text-xs font-medium ui-link">
                            {ctaLabel}
                          </Link>
                        </div>
                      </div>
                      {!row.read_at && (
                        <form action={markNotificationReadVoid.bind(null, row.id)}>
                          <button className="ui-btn-secondary px-3 py-1.5 text-xs" type="submit">
                            Mark read
                          </button>
                        </form>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-6 py-6 text-sm text-[var(--text-tertiary)]">No notifications yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
