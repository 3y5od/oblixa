import { NextResponse } from "next/server";
import { getApiAuthContext, canManageCapability } from "@/lib/v4/api-auth";
import { appendCasefileEvent } from "@/lib/v4/casefile";
import { enqueueOutboundEvent } from "@/lib/integrations/events";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { runIncrementalAssuranceChecks } from "@/lib/v6/assurance-checks";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; action: string }> }
) {
  const { id, action } = await params;
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await canManageCapability(ctx, "maintenance_manage"))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const { data: row } = await ctx.admin
    .from("exceptions")
    .select("id, contract_id, status, reopen_count")
    .eq("id", id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "Exception not found" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as {
    ownerId?: string;
    resolutionNote?: string;
    rootCause?: string;
    dueDate?: string;
  };
  const now = new Date().toISOString();

  if (action === "assign") {
    const ownerId = String(body.ownerId ?? "").trim();
    if (!ownerId) return NextResponse.json({ error: "ownerId is required" }, { status: 400 });
    const { data: ownerMember, error: ownerMemberError } = await ctx.admin
      .from("organization_members")
      .select("id")
      .eq("organization_id", ctx.orgId)
      .eq("user_id", ownerId)
      .maybeSingle();
    if (ownerMemberError) return NextResponse.json({ error: ownerMemberError.message }, { status: 400 });
    if (!ownerMember) {
      return NextResponse.json({ error: "ownerId must belong to your organization" }, { status: 400 });
    }
    const { error } = await ctx.admin
      .from("exceptions")
      .update({ owner_id: ownerId, due_date: body.dueDate || null, status: "in_progress" })
      .eq("id", id)
      .eq("organization_id", ctx.orgId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await ctx.admin.from("exception_events").insert({
      organization_id: ctx.orgId,
      exception_id: id,
      event_type: "assigned",
      actor_user_id: ctx.userId,
      details: { owner_id: ownerId, due_date: body.dueDate ?? null },
    });
    if (row.contract_id) {
      await appendCasefileEvent({
        admin: ctx.admin,
        organizationId: ctx.orgId,
        contractId: row.contract_id,
        eventType: "exception.assigned",
        entityType: "exception",
        entityId: id,
        actorUserId: ctx.userId,
        details: { owner_id: ownerId, due_date: body.dueDate ?? null },
      });
    }
    if (isFeatureEnabled("v6AssuranceCore")) {
      await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "resolve") {
    const { error } = await ctx.admin
      .from("exceptions")
      .update({
        status: "resolved",
        root_cause: body.rootCause?.trim() || null,
        resolution_note: body.resolutionNote?.trim() || null,
        resolved_at: now,
        resolved_by: ctx.userId,
      })
      .eq("id", id)
      .eq("organization_id", ctx.orgId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await ctx.admin.from("exception_events").insert({
      organization_id: ctx.orgId,
      exception_id: id,
      event_type: "resolved",
      actor_user_id: ctx.userId,
      details: { root_cause: body.rootCause ?? null, resolution_note: body.resolutionNote ?? null },
    });
    if (row.contract_id) {
      await appendCasefileEvent({
        admin: ctx.admin,
        organizationId: ctx.orgId,
        contractId: row.contract_id,
        eventType: "exception.resolved",
        entityType: "exception",
        entityId: id,
        actorUserId: ctx.userId,
      });
    }
    await enqueueOutboundEvent({
      organizationId: ctx.orgId,
      eventType: "exception.resolved",
      entityType: "exception",
      entityId: id,
      payload: {
        contract_id: row.contract_id,
        resolution_note: body.resolutionNote ?? null,
      },
    });
    if (isFeatureEnabled("v6AssuranceCore")) {
      await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "reopen") {
    const { error } = await ctx.admin
      .from("exceptions")
      .update({
        status: "open",
        resolved_at: null,
        resolved_by: null,
        reopen_count: (row.reopen_count ?? 0) + 1,
      })
      .eq("id", id)
      .eq("organization_id", ctx.orgId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await ctx.admin.from("exception_events").insert({
      organization_id: ctx.orgId,
      exception_id: id,
      event_type: "reopened",
      actor_user_id: ctx.userId,
      details: {},
    });
    if (row.contract_id) {
      await appendCasefileEvent({
        admin: ctx.admin,
        organizationId: ctx.orgId,
        contractId: row.contract_id,
        eventType: "exception.reopened",
        entityType: "exception",
        entityId: id,
        actorUserId: ctx.userId,
      });
    }
    if (isFeatureEnabled("v6AssuranceCore")) {
      await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 404 });
}
