import { NextResponse } from "next/server";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { canManageCapability, getApiAuthContext } from "@/lib/v4/api-auth";
import { readJsonBody, toSafeString } from "@/lib/v5/api";
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
    apiPath: "/api/decisions/[id]/stakeholders",
  });
  if (modeGate) return modeGate;
  if (!(await canManageCapability(ctx, "renewals_manage"))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const _limitedBody = await readJsonBodyLimited(request);
  if (!_limitedBody.ok) return _limitedBody.response;
  const raw = _limitedBody.body ?? {};
  const body = readJsonBody<{
    stakeholderUserId?: string;
    stakeholderRole?: string;
    notes?: string;
  }>(raw, {});
  const stakeholderUserId = toSafeString(body.stakeholderUserId);
  if (!stakeholderUserId) {
    return NextResponse.json({ error: "stakeholderUserId is required" }, { status: 400 });
  }

  const { data: exists } = await ctx.admin
    .from("decision_workspaces")
    .select("id")
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .maybeSingle();
  if (!exists) return NextResponse.json({ error: "Decision not found" }, { status: 404 });

  const { data: memberCheck } = await ctx.admin
    .from("organization_members")
    .select("id")
    .eq("organization_id", ctx.orgId)
    .eq("user_id", stakeholderUserId)
    .maybeSingle();
  if (!memberCheck) return NextResponse.json({ error: "Stakeholder must be an organization member" }, { status: 400 });

  const { data, error } = await ctx.admin
    .from("decision_workspace_stakeholders")
    .insert({
      organization_id: ctx.orgId,
      decision_workspace_id: id,
      stakeholder_user_id: stakeholderUserId,
      stakeholder_role: toSafeString(body.stakeholderRole) || "reviewer",
      notes: toSafeString(body.notes) || null,
    })
    .select("id, stakeholder_user_id, stakeholder_role, status, notes, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await ctx.admin.from("decision_workspace_events").insert({
    organization_id: ctx.orgId,
    decision_workspace_id: id,
    event_type: "decision.stakeholder_added",
    payload_json: { stakeholder_id: data.id },
    actor_user_id: ctx.userId,
  });

  return NextResponse.json({ stakeholder: data }, { status: 201 });
}
