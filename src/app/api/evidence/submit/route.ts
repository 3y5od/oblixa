import { NextResponse } from "next/server";
import { getApiAuthContext, canManageCapability } from "@/lib/v4/api-auth";

export async function POST(request: Request) {
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await canManageCapability(ctx, "contracts_edit"))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    requirementId?: string;
    payload?: Record<string, unknown>;
  };
  const requirementId = String(body.requirementId ?? "").trim();
  if (!requirementId) {
    return NextResponse.json({ error: "requirementId is required" }, { status: 400 });
  }

  const { data: requirement } = await ctx.admin
    .from("evidence_requirements")
    .select("id, organization_id")
    .eq("id", requirementId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!requirement) return NextResponse.json({ error: "Requirement not found" }, { status: 404 });

  const { data: submission, error } = await ctx.admin
    .from("evidence_submissions")
    .insert({
      organization_id: ctx.orgId,
      requirement_id: requirementId,
      submitted_by: ctx.userId,
      status: "submitted",
      payload_json: body.payload ?? {},
    })
    .select("id, requirement_id, status, submitted_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await ctx.admin
    .from("evidence_requirements")
    .update({ status: "submitted" })
    .eq("id", requirementId)
    .eq("organization_id", ctx.orgId);

  return NextResponse.json({ submission }, { status: 201 });
}
