import { NextResponse } from "next/server";
import { canManageCapability, getApiAuthContext } from "@/lib/v4/api-auth";
import { readJsonBody, toSafeString } from "@/lib/v5/api";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";

function nextStatusForAction(action: string): "approved" | "open" | null {
  if (action === "approve") return "approved";
  if (action === "return_for_revision") return "open";
  if (action === "reject") return "open";
  return null;
}

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
    apiPath: "/api/decisions/[id]/review",
  });
  if (modeGate) return modeGate;
  if (!(await canManageCapability(ctx, "approvals_manage"))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const raw = await request.json().catch(() => ({}));
  const body = readJsonBody<{ action?: string; note?: string }>(raw, {});
  const action = toSafeString(body.action).toLowerCase();
  const note = toSafeString(body.note);
  const status = nextStatusForAction(action);
  if (!status) {
    return NextResponse.json(
      { error: "action must be one of: approve, reject, return_for_revision" },
      { status: 400 }
    );
  }

  const { data: prior, error: priorError } = await ctx.admin
    .from("decision_workspaces")
    .select("id, status, title, owner_user_id")
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .maybeSingle();
  if (priorError) return NextResponse.json({ error: priorError.message }, { status: 400 });
  if (!prior) return NextResponse.json({ error: "Decision not found" }, { status: 404 });
  if (!["open", "in_review"].includes(prior.status)) {
    return NextResponse.json(
      { error: "Only open or in_review decisions are review-actionable" },
      { status: 409 }
    );
  }

  const { data, error } = await ctx.admin
    .from("decision_workspaces")
    .update({ status })
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .select("id, status, updated_at")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Decision not found" }, { status: 404 });

  const eventType =
    action === "approve"
      ? "decision.review_approved"
      : action === "reject"
        ? "decision.review_rejected"
        : "decision.review_returned";

  await ctx.admin.from("decision_workspace_events").insert({
    organization_id: ctx.orgId,
    decision_workspace_id: id,
    event_type: eventType,
    payload_json: {
      prior_status: prior.status,
      next_status: status,
      action,
      note: note || undefined,
    },
    actor_user_id: ctx.userId,
  });

  return NextResponse.json({ decision: data });
}
