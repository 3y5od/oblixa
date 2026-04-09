import { NextResponse } from "next/server";
import { canManageCapability, getApiAuthContext } from "@/lib/v4/api-auth";
import { clampConfidence, readJsonBody, toSafeString } from "@/lib/v5/api";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV5ApiFeature("v5DecisionFoundation");
  if (disabled) return disabled;
  const { id } = await params;
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await canManageCapability(ctx, "renewals_manage"))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const raw = await request.json().catch(() => ({}));
  const body = readJsonBody<{
    recommendationType?: string;
    recommendationText?: string;
    reasons?: unknown[];
    sourceObjectRefs?: unknown[];
    confidence?: number;
  }>(raw, {});
  const recommendationText = toSafeString(body.recommendationText);
  if (!recommendationText) {
    return NextResponse.json({ error: "recommendationText is required" }, { status: 400 });
  }
  const reasons = Array.isArray(body.reasons) ? body.reasons : [];
  const sourceObjectRefs = Array.isArray(body.sourceObjectRefs) ? body.sourceObjectRefs : [];
  if (reasons.length === 0) {
    return NextResponse.json({ error: "reasons must include at least one grounded reason" }, { status: 400 });
  }
  if (sourceObjectRefs.length === 0) {
    return NextResponse.json(
      { error: "sourceObjectRefs must include at least one linked object reference" },
      { status: 400 }
    );
  }

  const { data, error } = await ctx.admin
    .from("decision_recommendations")
    .insert({
      organization_id: ctx.orgId,
      decision_workspace_id: id,
      recommendation_type: toSafeString(body.recommendationType) || "review_priority_suggestion",
      recommendation_text: recommendationText,
      reasons_json: reasons,
      source_object_refs_json: sourceObjectRefs,
      confidence: clampConfidence(body.confidence),
    })
    .select(
      "id, recommendation_type, recommendation_text, confidence, reasons_json, source_object_refs_json, created_at"
    )
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await ctx.admin
    .from("decision_workspaces")
    .update({
      recommendation_json: {
        latest_recommendation_id: data.id,
        summary: recommendationText.slice(0, 500),
        updated_at: new Date().toISOString(),
      },
    })
    .eq("organization_id", ctx.orgId)
    .eq("id", id);

  await ctx.admin.from("decision_workspace_events").insert({
    organization_id: ctx.orgId,
    decision_workspace_id: id,
    event_type: "decision.recommendation_added",
    payload_json: { recommendation_id: data.id },
    actor_user_id: ctx.userId,
  });

  return NextResponse.json({ recommendation: data }, { status: 201 });
}

