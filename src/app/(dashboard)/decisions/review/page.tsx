import Link from "next/link";
import { revalidatePath } from "next/cache";
import { AlertTriangle, CircleDot, Layers, Timer } from "lucide-react";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { EmptyState } from "@/components/ui/empty-state";
import { OperationalSummaryCard } from "@/components/ui/operational-summary-card";
import { getAuthContext } from "@/lib/supabase/server";
import { assertV5PageFeature } from "@/lib/v5/feature-guards";
import { DECISION_TYPE_LABELS, type DecisionType } from "@/lib/v5/decision-types";
import { decisionQueueSlaFields } from "@/lib/v5/decision-queue-sla";

export default async function DecisionsManagerReviewPage() {
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;
  assertV5PageFeature("v5DecisionFoundation");
  assertV5PageFeature("v5ControlRoomUx");

  const { admin, orgId } = ctx;
  const { data: rows } = await admin
    .from("decision_workspaces")
    .select("id, title, decision_type, status, due_at, owner_user_id, updated_at")
    .eq("organization_id", orgId)
    .in("status", ["open", "in_review"])
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(200);

  const enriched = (rows ?? []).map((row) => {
    const sla = decisionQueueSlaFields(row.due_at);
    const dt = row.decision_type as DecisionType;
    const typeLabel = DECISION_TYPE_LABELS[dt] ?? row.decision_type;
    return { ...row, ...sla, typeLabel };
  });
  const urgent = enriched.filter((r) => r.sla_status === "overdue").length;
  const nearDue = enriched.filter((r) => r.sla_status === "due_soon").length;
  const inReview = enriched.filter((r) => r.status === "in_review").length;

  async function submitReviewAction(formData: FormData) {
    "use server";
    const decisionId = String(formData.get("decisionId") ?? "");
    const action = String(formData.get("action") ?? "");
    const note = String(formData.get("note") ?? "");
    if (!decisionId || !action) return;

    const ctxAction = await getAuthContext();
    if (!ctxAction) return;
    const nextStatus =
      action === "approve" ? "approved" : action === "return_for_revision" ? "open" : null;
    if (!nextStatus) return;
    const { data: prior } = await ctxAction.admin
      .from("decision_workspaces")
      .select("status")
      .eq("organization_id", ctxAction.orgId)
      .eq("id", decisionId)
      .maybeSingle();
    if (!prior || !["open", "in_review"].includes(prior.status)) return;
    await ctxAction.admin
      .from("decision_workspaces")
      .update({ status: nextStatus })
      .eq("organization_id", ctxAction.orgId)
      .eq("id", decisionId);
    await ctxAction.admin.from("decision_workspace_events").insert({
      organization_id: ctxAction.orgId,
      decision_workspace_id: decisionId,
      event_type:
        action === "approve" ? "decision.review_approved" : "decision.review_returned",
      payload_json: { prior_status: prior.status, next_status: nextStatus, note: note || undefined },
      actor_user_id: ctxAction.user.id,
    });
    revalidatePath("/decisions/review");
    revalidatePath(`/decisions/${decisionId}`);
  }

  return (
    <div className="ui-page-stack">
      <header className="border-b border-[var(--border-subtle)] pb-8">
        <div>
          <p className="ui-eyebrow">Manager review</p>
          <h1 className="ui-display-title mt-2">Active decision queue</h1>
          <p className="ui-muted-tight mt-3 max-w-2xl">
            Prioritize by due date and SLA, open a workspace, or export a manager review packet in one step.
          </p>
        </div>
      </header>

      <section className="space-y-4">
        <div>
          <p className="ui-eyebrow">Queue health</p>
          <h2 className="ui-section-title mt-1 text-base">Review posture</h2>
          <p className="ui-muted-tight mt-2 max-w-2xl text-[13px]">
            SLA counts for open and in-review workspaces in this view.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <OperationalSummaryCard
            eyebrow="Risk"
            headline="Urgent SLA"
            tone={urgent > 0 ? "risk" : "healthy"}
            icon={AlertTriangle}
            primaryValue={urgent}
            primaryUnit="overdue or due today"
            action={{ href: "/decisions/review", label: "Refresh queue" }}
            variant="compact"
          />
          <OperationalSummaryCard
            eyebrow="Horizon"
            headline="Near due"
            tone={nearDue > 0 ? "attention" : "healthy"}
            icon={Timer}
            primaryValue={nearDue}
            primaryUnit="breach risk window"
            action={{ href: "/decisions/review", label: "Triage soon" }}
            variant="compact"
          />
          <OperationalSummaryCard
            eyebrow="Flow"
            headline="In review"
            tone={inReview > 0 ? "neutral" : "healthy"}
            icon={CircleDot}
            primaryValue={inReview}
            primaryUnit="awaiting reviewer"
            action={{ href: "/decisions?queue=active", label: "Review decisions" }}
            variant="compact"
          />
        </div>
      </section>

      <div className="ui-table-shell">
        <table className="min-w-full text-left text-sm text-[var(--text-primary)]">
          <thead className="border-b border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3">SLA</th>
              <th className="px-4 py-3">Review actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {enriched.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6">
                  <EmptyState
                    title="Queue is clear"
                    copy="No open or in-review decision workspaces right now."
                    icon={
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))]">
                        <Layers className="h-7 w-7 text-[var(--text-tertiary)]" strokeWidth={1.25} aria-hidden />
                      </div>
                    }
                    action={
                      <Link href="/decisions" className="ui-btn-secondary px-5 py-2.5 text-[13px]">
                        View all decisions
                      </Link>
                    }
                  />
                </td>
              </tr>
            ) : (
              enriched.map((r) => (
                <tr key={r.id} className="bg-surface">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/decisions/${r.id}`} className="ui-link">
                      {r.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{r.typeLabel}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{r.status}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">
                    {r.due_at ? new Date(r.due_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-[color:color-mix(in_oklab,var(--surface-muted)_88%,var(--canvas))] px-2 py-0.5 text-xs tabular-nums text-[var(--text-secondary)]">
                      {r.sla_status}
                      {r.days_until_due !== null ? ` · ${r.days_until_due}d` : ""}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/decisions/${r.id}?packetType=manager_review_packet`}
                        className="ui-link text-xs"
                      >
                        Packet
                      </Link>
                      <form action={submitReviewAction} className="flex items-center gap-2">
                        <input type="hidden" name="decisionId" value={r.id} />
                        <input type="hidden" name="action" value="approve" />
                        <input
                          name="note"
                          placeholder="Optional note"
                          className="ui-input-compact w-28 text-[11px]"
                        />
                        <button type="submit" className="ui-btn-secondary px-2 py-1 text-[11px]">
                          Approve
                        </button>
                      </form>
                      <form action={submitReviewAction}>
                        <input type="hidden" name="decisionId" value={r.id} />
                        <input type="hidden" name="action" value="return_for_revision" />
                        <button type="submit" className="ui-btn-ghost px-2 py-1 text-[11px]">
                          Return
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <nav
        className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-center text-sm text-[var(--text-tertiary)]"
        aria-label="Decision shortcuts"
      >
        <Link href="/decisions" className="ui-link">
          Back to decisions
        </Link>
        <span className="text-[var(--text-tertiary)]" aria-hidden>
          ·
        </span>
        <Link href="/decisions/compare" className="ui-link">
          Compare two decisions
        </Link>
      </nav>
    </div>
  );
}
