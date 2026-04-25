import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getApiAuthContext, canManageCapability } from "@/lib/v4/api-auth";
import { appendCasefileEvent } from "@/lib/v4/casefile";
import { enqueueOutboundEvent } from "@/lib/integrations/events";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { emitProductTelemetryEvent } from "@/lib/product-telemetry";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; action: string }> }
) {
  const { id, action } = await params;
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/evidence/[id]/[action]",
  });
  if (modeGate) return modeGate;
  if (!(await canManageCapability(ctx, "approvals_manage"))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const { data: submission } = await ctx.admin
    .from("evidence_submissions")
    .select("id, requirement_id")
    .eq("id", id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!submission) return NextResponse.json({ error: "Submission not found" }, { status: 404 });

  const { data: requirementRow } = await ctx.admin
    .from("evidence_requirements")
    .select("contract_id, title")
    .eq("id", submission.requirement_id as string)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();

  if (action === "approve") {
    const { error } = await ctx.admin
      .from("evidence_submissions")
      .update({ status: "approved", reviewer_id: ctx.userId, reviewed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("organization_id", ctx.orgId);
    if (error) return NextResponse.json({ error: "Failed to update submission" }, { status: 500 });
    const { error: reqError } = await ctx.admin
      .from("evidence_requirements")
      .update({ status: "approved" })
      .eq("id", submission.requirement_id)
      .eq("organization_id", ctx.orgId);
    if (reqError) return NextResponse.json({ error: "Failed to update requirement" }, { status: 500 });
    const cid = requirementRow?.contract_id as string | null;
    if (cid) {
      await appendCasefileEvent({
        admin: ctx.admin,
        organizationId: ctx.orgId,
        contractId: cid,
        eventType: "evidence.approved",
        entityType: "evidence_submission",
        entityId: id,
        actorUserId: ctx.userId,
        details: { requirement_id: submission.requirement_id },
      });
    }
    await enqueueOutboundEvent({
      organizationId: ctx.orgId,
      eventType: "evidence.submission_approved",
      entityType: "evidence_submission",
      entityId: id,
      payload: {
        contract_id: cid,
        requirement_id: submission.requirement_id,
        title: requirementRow?.title,
      },
    });
    await emitProductTelemetryEvent(ctx.admin, {
      organizationId: ctx.orgId,
      userId: ctx.userId,
      contractId: cid,
      action: "product.v9.evidence_review_decision_recorded",
      details: { decision: "approve", requirementId: String(submission.requirement_id) },
    });
    revalidatePath("/contracts/evidence-studio");
    if (cid) revalidatePath(`/contracts/${cid}`);
    return NextResponse.json({ ok: true });
  }

  if (action === "reject") {
    const body = (await request.json().catch(() => ({}))) as { reason?: string };
    if (body.reason && body.reason.length > 4000) return NextResponse.json({ error: "Reason is too long" }, { status: 400 });
    const { error } = await ctx.admin
      .from("evidence_submissions")
      .update({
        status: "rejected",
        reviewer_id: ctx.userId,
        reviewed_at: new Date().toISOString(),
        rejection_reason: body.reason?.trim() || "Rejected by reviewer",
      })
      .eq("id", id)
      .eq("organization_id", ctx.orgId);
    if (error) return NextResponse.json({ error: "Failed to update submission" }, { status: 500 });
    const { error: reqError } = await ctx.admin
      .from("evidence_requirements")
      .update({ status: "rejected" })
      .eq("id", submission.requirement_id)
      .eq("organization_id", ctx.orgId);
    if (reqError) return NextResponse.json({ error: "Failed to update requirement" }, { status: 500 });
    const cid = requirementRow?.contract_id as string | null;
    await emitProductTelemetryEvent(ctx.admin, {
      organizationId: ctx.orgId,
      userId: ctx.userId,
      contractId: cid,
      action: "product.v9.evidence_review_decision_recorded",
      details: { decision: "reject", requirementId: String(submission.requirement_id) },
    });
    await emitProductTelemetryEvent(ctx.admin, {
      organizationId: ctx.orgId,
      userId: ctx.userId,
      contractId: cid,
      action: "product.v9.evidence_rejected",
      details: { requirementId: String(submission.requirement_id) },
    });
    revalidatePath("/contracts/evidence-studio");
    if (cid) revalidatePath(`/contracts/${cid}`);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 404 });
}
