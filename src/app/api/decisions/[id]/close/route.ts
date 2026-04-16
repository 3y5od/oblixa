import { NextResponse } from "next/server";
import { canManageCapability, getApiAuthContext } from "@/lib/v4/api-auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { readJsonBody } from "@/lib/v5/api";
import {
  executePostDecisionActions,
  suggestDefaultPostDecisionActions,
} from "@/lib/v5/post-decision-actions";
import {
  appendAccountTimelineEvent,
  appendCounterpartyTimelineEvent,
} from "@/lib/v5/relationship-timeline";
import { incrementOrgV5SignalQuality } from "@/lib/v5/persist-signal-quality";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV5ApiFeature("v5DecisionFoundation");
  if (disabled) return disabled;
  const { id } = await params;
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/decisions/[id]/close",
  });
  if (modeGate) return modeGate;
  if (!(await canManageCapability(ctx, "renewals_manage"))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const raw = await request.json().catch(() => ({}));
  const body = readJsonBody<{ finalDisposition?: Record<string, unknown>; postActions?: unknown[] }>(raw, {});

  const { data: prior } = await ctx.admin
    .from("decision_workspaces")
    .select(
      "status, linked_account_key, linked_counterparty_key, title, decision_type, linked_contract_ids"
    )
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .maybeSingle();
  if (!prior) return NextResponse.json({ error: "Decision not found" }, { status: 404 });

  const wasClosed = prior.status === "closed";

  if (wasClosed) {
    const { data: existingData } = await ctx.admin
      .from("decision_workspaces")
      .select("id, status, final_disposition_json, post_decision_actions_json, updated_at")
      .eq("organization_id", ctx.orgId)
      .eq("id", id)
      .maybeSingle();
    return NextResponse.json({ decision: existingData, postActionResult: null });
  }

  const bodyPost = Array.isArray(body.postActions) ? body.postActions : [];
  const postActions =
    bodyPost.length > 0
      ? bodyPost
      : suggestDefaultPostDecisionActions(
          String(prior.decision_type ?? ""),
          prior.linked_contract_ids
        );

  const { data, error } = await ctx.admin
    .from("decision_workspaces")
    .update({
      status: "closed",
      final_disposition_json: body.finalDisposition ?? {},
      post_decision_actions_json: postActions,
    })
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .select("id, status, final_disposition_json, post_decision_actions_json, updated_at")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Decision not found" }, { status: 404 });

  await ctx.admin.from("decision_workspace_events").insert({
    organization_id: ctx.orgId,
    decision_workspace_id: id,
    event_type: "decision.closed",
    payload_json: { has_disposition: Boolean(body.finalDisposition) },
    actor_user_id: ctx.userId,
  });

  if (!wasClosed && isFeatureEnabled("v5RelationshipLayer")) {
    const basePayload = {
      decision_workspace_id: id,
      title: prior.title,
    };
    if (prior.linked_account_key) {
      await appendAccountTimelineEvent(
        ctx.admin,
        ctx.orgId,
        prior.linked_account_key,
        "relationship.decision_closed",
        basePayload
      );
    }
    if (prior.linked_counterparty_key) {
      await appendCounterpartyTimelineEvent(
        ctx.admin,
        ctx.orgId,
        prior.linked_counterparty_key,
        "relationship.decision_closed",
        basePayload
      );
    }
  }

  let postActionResult: Awaited<ReturnType<typeof executePostDecisionActions>> | null = null;
  if (!wasClosed) {
    await incrementOrgV5SignalQuality({
      admin: ctx.admin,
      organizationId: ctx.orgId,
      increments: { v5_decisions_closed: 1 },
    });
  }

  if (!wasClosed && postActions.length > 0) {
    postActionResult = await executePostDecisionActions({
      admin: ctx.admin,
      organizationId: ctx.orgId,
      userId: ctx.userId,
      decisionWorkspaceId: id,
      actions: postActions as Record<string, unknown>[],
    });
    await ctx.admin.from("decision_workspace_events").insert({
      organization_id: ctx.orgId,
      decision_workspace_id: id,
      event_type: "decision.post_actions_applied",
      payload_json: {
        tasks_created: postActionResult.tasksCreated,
        exceptions_linked: postActionResult.exceptionsLinked,
        errors: postActionResult.errors,
      },
      actor_user_id: ctx.userId,
    });
  }

  return NextResponse.json({ decision: data, postActionResult });
}

