import { NextResponse } from "next/server";
import { getApiAuthContext, canManageCapability } from "@/lib/v4/api-auth";
import { appendCasefileEvent } from "@/lib/v4/casefile";
import { enqueueOutboundEvent } from "@/lib/integrations/events";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; action: string }> }
) {
  const { id, action } = await params;
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
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
    await ctx.admin
      .from("evidence_submissions")
      .update({ status: "approved", reviewer_id: ctx.userId, reviewed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("organization_id", ctx.orgId);
    await ctx.admin
      .from("evidence_requirements")
      .update({ status: "approved" })
      .eq("id", submission.requirement_id)
      .eq("organization_id", ctx.orgId);
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
    return NextResponse.json({ ok: true });
  }

  if (action === "reject") {
    const body = (await request.json().catch(() => ({}))) as { reason?: string };
    await ctx.admin
      .from("evidence_submissions")
      .update({
        status: "rejected",
        reviewer_id: ctx.userId,
        reviewed_at: new Date().toISOString(),
        rejection_reason: body.reason?.trim() || "Rejected by reviewer",
      })
      .eq("id", id)
      .eq("organization_id", ctx.orgId);
    await ctx.admin
      .from("evidence_requirements")
      .update({ status: "rejected" })
      .eq("id", submission.requirement_id)
      .eq("organization_id", ctx.orgId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 404 });
}
