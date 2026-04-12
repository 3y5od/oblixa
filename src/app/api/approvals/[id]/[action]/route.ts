import { NextResponse } from "next/server";
import { getApiAuthContext, canManageCapability } from "@/lib/v4/api-auth";
import { appendCasefileEvent } from "@/lib/v4/casefile";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";

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
    apiPath: "/api/approvals/[id]/[action]",
  });
  if (modeGate) return modeGate;
  if (!(await canManageCapability(ctx, "approvals_manage"))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const { data: approval } = await ctx.admin
    .from("contract_approvals")
    .select("id, organization_id, status, contract_id")
    .eq("id", id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!approval) return NextResponse.json({ error: "Approval not found" }, { status: 404 });

  if (action === "delegate") {
    const body = (await request.json().catch(() => ({}))) as { delegateUserId?: string };
    const delegateUserId = String(body.delegateUserId ?? "").trim();
    if (!delegateUserId) {
      return NextResponse.json({ error: "delegateUserId is required" }, { status: 400 });
    }
    const { data: delegateMember, error: delegateMemberError } = await ctx.admin
      .from("organization_members")
      .select("id")
      .eq("organization_id", ctx.orgId)
      .eq("user_id", delegateUserId)
      .maybeSingle();
    if (delegateMemberError) {
      return NextResponse.json({ error: delegateMemberError.message }, { status: 400 });
    }
    if (!delegateMember) {
      return NextResponse.json(
        { error: "delegateUserId must belong to your organization" },
        { status: 400 }
      );
    }
    await ctx.admin
      .from("contract_approvals")
      .update({
        approver_id: delegateUserId,
        escalation_status: "none",
        escalation_at: null,
      })
      .eq("id", id)
      .eq("organization_id", ctx.orgId);

    await ctx.admin.from("contract_approval_events").insert({
      organization_id: ctx.orgId,
      contract_id: approval.contract_id,
      approval_id: id,
      actor_id: ctx.userId,
      event_type: "delegated",
      details: { delegate_user_id: delegateUserId },
    });
    await appendCasefileEvent({
      admin: ctx.admin,
      organizationId: ctx.orgId,
      contractId: approval.contract_id,
      eventType: "approval.delegated",
      entityType: "approval",
      entityId: id,
      actorUserId: ctx.userId,
      details: { delegate_user_id: delegateUserId },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "escalate") {
    await ctx.admin
      .from("contract_approvals")
      .update({
        escalation_status: "escalated",
        escalated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("organization_id", ctx.orgId);

    await ctx.admin.from("contract_approval_events").insert({
      organization_id: ctx.orgId,
      contract_id: approval.contract_id,
      approval_id: id,
      actor_id: ctx.userId,
      event_type: "escalated",
      details: {},
    });
    await appendCasefileEvent({
      admin: ctx.admin,
      organizationId: ctx.orgId,
      contractId: approval.contract_id,
      eventType: "approval.escalated",
      entityType: "approval",
      entityId: id,
      actorUserId: ctx.userId,
      details: {},
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 404 });
}
