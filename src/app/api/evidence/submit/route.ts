import { NextResponse } from "next/server";
import { getApiAuthContext, canManageCapability } from "@/lib/v4/api-auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { runIncrementalAssuranceChecks } from "@/lib/v6/assurance-checks";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";

export async function POST(request: Request) {
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/evidence/submit",
  });
  if (modeGate) return modeGate;
  if (!(await canManageCapability(ctx, "contracts_edit"))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    requirementId?: string;
    payload?: Record<string, unknown>;
  };
  if (JSON.stringify(body).length > 50000) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
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
      v6_freshness_score: 100,
    })
    .select("id, requirement_id, status, submitted_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await ctx.admin
    .from("evidence_requirements")
    .update({ status: "submitted" })
    .eq("id", requirementId)
    .eq("organization_id", ctx.orgId);

  if (isFeatureEnabled("v6AssuranceCore")) {
    await incrementV6QualityCounter(ctx.admin, ctx.orgId, "evidence_submit_incremental_assurance_hook_total", 1).catch(
      () => undefined
    );
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
  }

  return NextResponse.json({ submission }, { status: 201 });
}
