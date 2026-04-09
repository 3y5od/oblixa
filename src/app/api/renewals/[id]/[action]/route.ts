import { NextResponse } from "next/server";
import { getApiAuthContext, canManageCapability } from "@/lib/v4/api-auth";
import { appendCasefileEvent } from "@/lib/v4/casefile";
import { buildRenewalDecisionPacketPayload } from "@/lib/v4/renewal-decision-packet";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; action: string }> }
) {
  const { id, action } = await params;
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await canManageCapability(ctx, "renewals_manage"))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const { data: checkpoint } = await ctx.admin
    .from("contract_renewal_checkpoints")
    .select(
      "id, contract_id, organization_id, label, due_date, status, workspace_json, renewal_state, scenario_id"
    )
    .eq("id", id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!checkpoint) return NextResponse.json({ error: "Renewal checkpoint not found" }, { status: 404 });

  if (action === "generate-decision-packet") {
    const payload = (await request.json().catch(() => ({}))) as {
      assumptions?: Record<string, unknown>;
      summary?: string;
    };
    const scenarioId = checkpoint.scenario_id as string | null | undefined;
    let scenarioRow: {
      id: string;
      scenario: string | null;
      workspace_status: string | null;
      target_decision_date: string | null;
      decision_date: string | null;
    } | null = null;
    if (scenarioId) {
      const { data: s } = await ctx.admin
        .from("contract_renewal_scenarios")
        .select("id, scenario, workspace_status, target_decision_date, decision_date")
        .eq("id", scenarioId)
        .eq("organization_id", ctx.orgId)
        .maybeSingle();
      if (s) scenarioRow = s;
    }
    const { packet_json, assumptions_json } = buildRenewalDecisionPacketPayload({
      checkpoint: {
        label: checkpoint.label as string | null,
        due_date: checkpoint.due_date as string | null,
        status: checkpoint.status as string | null,
        renewal_state: checkpoint.renewal_state as string | null,
        workspace_json: checkpoint.workspace_json,
      },
      scenarioRow,
      assumptionsFromRequest: payload.assumptions ?? null,
    });
    const { data: packet, error } = await ctx.admin
      .from("renewal_decision_packets")
      .insert({
        organization_id: ctx.orgId,
        contract_id: checkpoint.contract_id,
        checkpoint_id: checkpoint.id,
        status: "draft",
        summary: payload.summary?.trim() || null,
        assumptions_json,
        packet_json,
        generated_by: ctx.userId,
        generated_at: new Date().toISOString(),
      })
      .select("id, status, summary, created_at")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await ctx.admin
      .from("contract_renewal_checkpoints")
      .update({ decision_packet_id: packet.id, renewal_state: "under_review" })
      .eq("id", checkpoint.id)
      .eq("organization_id", ctx.orgId);

    await appendCasefileEvent({
      admin: ctx.admin,
      organizationId: ctx.orgId,
      contractId: checkpoint.contract_id,
      eventType: "renewal.decision_packet_generated",
      entityType: "renewal_decision_packet",
      entityId: packet.id,
      actorUserId: ctx.userId,
    });
    return NextResponse.json({ packet }, { status: 201 });
  }

  if (action === "recommendation") {
    const body = (await request.json().catch(() => ({}))) as {
      packetId?: string;
      recommendation?: "renew" | "amend" | "terminate";
      summary?: string;
    };
    const packetId = String(body.packetId ?? "").trim();
    if (!packetId) return NextResponse.json({ error: "packetId is required" }, { status: 400 });

    const { error } = await ctx.admin
      .from("renewal_decision_packets")
      .update({
        recommendation: body.recommendation ?? null,
        summary: body.summary?.trim() || null,
        status: "recommended",
      })
      .eq("id", packetId)
      .eq("organization_id", ctx.orgId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await ctx.admin
      .from("contract_renewal_checkpoints")
      .update({ renewal_state: "decision_pending" })
      .eq("id", checkpoint.id)
      .eq("organization_id", ctx.orgId);

    await appendCasefileEvent({
      admin: ctx.admin,
      organizationId: ctx.orgId,
      contractId: checkpoint.contract_id,
      eventType: "renewal.recommendation_updated",
      entityType: "renewal_decision_packet",
      entityId: packetId,
      actorUserId: ctx.userId,
      details: { recommendation: body.recommendation ?? null },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 404 });
}
