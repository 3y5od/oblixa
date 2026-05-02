import { NextResponse } from "next/server";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { canManageCapability, getApiAuthContext } from "@/lib/v4/api-auth";
import { readJsonBody, toSafeString } from "@/lib/v5/api";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { enforceIdempotency } from "@/lib/idempotency";

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
    apiPath: "/api/decisions/[id]/approve",
  });
  if (modeGate) return modeGate;
  if (!(await canManageCapability(ctx, "approvals_manage"))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  const duplicate = await enforceIdempotency(request, {
    scope: "decisions.approve",
    actorKey: `${ctx.orgId}:${ctx.userId}`,
  });
  if (duplicate) return duplicate;

  const _limitedBody = await readJsonBodyLimited(request);
  if (!_limitedBody.ok) return _limitedBody.response;
  const raw = _limitedBody.body ?? {};
  const body = readJsonBody<{ note?: string }>(raw, {});
  const note = toSafeString(body.note);

  const { data: current } = await ctx.admin
    .from("decision_workspaces")
    .select("status")
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .maybeSingle();
  if (!current) return NextResponse.json({ error: "Decision not found" }, { status: 404 });
  if (!["open", "in_review"].includes(current.status)) {
    return NextResponse.json(
      { error: "Only open or in_review decisions can be approved" },
      { status: 409 }
    );
  }

  const { data, error } = await ctx.admin
    .from("decision_workspaces")
    .update({ status: "approved" })
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .neq("status", "closed")
    .select("id, status, updated_at")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Decision not found" }, { status: 404 });

  await ctx.admin.from("decision_workspace_events").insert({
    organization_id: ctx.orgId,
    decision_workspace_id: id,
    event_type: "decision.approved",
    payload_json: {
      prior_status: current.status,
      note: note || undefined,
    },
    actor_user_id: ctx.userId,
  });

  return NextResponse.json({ decision: data });
}

