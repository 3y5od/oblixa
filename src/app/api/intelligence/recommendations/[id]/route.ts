import { NextResponse } from "next/server";
import { canManageCapability, getApiAuthContext } from "@/lib/v4/api-auth";
import { readJsonBody, toSafeString } from "@/lib/v5/api";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";
import { incrementOrgV5SignalQuality } from "@/lib/v5/persist-signal-quality";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV5ApiFeature("v5SimulationAndIntelligence");
  if (disabled) return disabled;
  const { id } = await params;
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/intelligence/recommendations/[id]",
  });
  if (modeGate) return modeGate;
  if (!(await canManageCapability(ctx, "renewals_manage"))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const raw = await request.json().catch(() => ({}));
  const body = readJsonBody<{ action?: string }>(raw, {});
  const action = toSafeString(body.action).toLowerCase();
  if (action !== "accept" && action !== "dismiss") {
    return NextResponse.json({ error: "action must be accept or dismiss" }, { status: 400 });
  }

  const patch =
    action === "accept"
      ? { accepted: true, dismissed: false }
      : { accepted: false, dismissed: true };

  const { data, error } = await ctx.admin
    .from("operational_recommendations")
    .update(patch)
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .select("id, accepted, dismissed, recommendation_type, generated_at")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Recommendation not found" }, { status: 404 });

  await ctx.admin.from("audit_events").insert({
    organization_id: ctx.orgId,
    user_id: ctx.userId,
    action: action === "accept" ? "v5.recommendation.accepted" : "v5.recommendation.dismissed",
    details: {
      recommendation_id: id,
      recommendation_type: data.recommendation_type,
      idempotent: true,
    },
  });

  await incrementOrgV5SignalQuality({
    admin: ctx.admin,
    organizationId: ctx.orgId,
    increments:
      action === "accept" ? { v5_recommendation_accepted: 1 } : { v5_recommendation_dismissed: 1 },
  });

  return NextResponse.json({ recommendation: data });
}
