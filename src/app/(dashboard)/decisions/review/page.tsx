import Link from "next/link";
import { revalidatePath } from "next/cache";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
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
    <div className="space-y-8">
      <header className="border-b border-zinc-200/60 pb-8">
        <p className="ui-eyebrow">Manager review</p>
        <h1 className="ui-display-title mt-2">Open decision queue</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-zinc-500">
          Prioritize by due date and SLA, open a workspace, or export a manager review packet in one step.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="ui-card p-4">
          <p className="ui-label-caps">Urgent SLA</p>
          <p className="mt-2 text-3xl font-semibold text-rose-700">{urgent}</p>
          <p className="mt-1 text-xs text-zinc-500">Decisions already overdue or due today.</p>
        </article>
        <article className="ui-card p-4">
          <p className="ui-label-caps">Near due</p>
          <p className="mt-2 text-3xl font-semibold text-amber-700">{nearDue}</p>
          <p className="mt-1 text-xs text-zinc-500">Decisions likely to breach in the next window.</p>
        </article>
        <article className="ui-card p-4">
          <p className="ui-label-caps">In review</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900">{inReview}</p>
          <p className="mt-1 text-xs text-zinc-500">Workspaces currently waiting on reviewer action.</p>
        </article>
      </section>

      <div className="overflow-x-auto rounded-2xl border border-zinc-200/60">
        <table className="min-w-full text-left text-sm text-zinc-800">
          <thead className="border-b border-zinc-200 bg-zinc-50/80 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3">SLA</th>
              <th className="px-4 py-3">Review actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {enriched.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  No open or in-review decisions.
                </td>
              </tr>
            ) : (
              enriched.map((r) => (
                <tr key={r.id} className="bg-white">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/decisions/${r.id}`} className="ui-link">
                      {r.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{r.typeLabel}</td>
                  <td className="px-4 py-3 text-zinc-600">{r.status}</td>
                  <td className="px-4 py-3 text-zinc-600">
                    {r.due_at ? new Date(r.due_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
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

      <p className="text-center text-sm text-zinc-500">
        <Link href="/decisions" className="ui-link">
          Back to decisions
        </Link>
        {" · "}
        <Link href="/decisions/compare" className="ui-link">
          Compare two decisions
        </Link>
      </p>
    </div>
  );
}
