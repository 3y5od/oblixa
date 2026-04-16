import { NextResponse } from "next/server";
import { canManageCapability, getApiAuthContext } from "@/lib/v4/api-auth";
import { parseCampaignAssignmentJson, resolveCampaignTaskRouting } from "@/lib/v5/campaign-assignment";
import { CAMPAIGN_TASK_MARKER } from "@/lib/v5/campaign-eligibility";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { runIncrementalAssuranceChecks } from "@/lib/v6/assurance-checks";
import { gatherPortfolioMetrics } from "@/lib/v6/portfolio-metrics";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { enforceIdempotency } from "@/lib/idempotency";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV5ApiFeature("v5PortfolioCampaigns");
  if (disabled) return disabled;
  const { id } = await params;
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/campaigns/[id]/start",
  });
  if (modeGate) return modeGate;
  if (!(await canManageCapability(ctx, "maintenance_manage"))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  const duplicate = await enforceIdempotency(request, {
    scope: "campaigns.start",
    actorKey: `${ctx.orgId}:${ctx.userId}`,
  });
  if (duplicate) return duplicate;

  const { data: campaignMeta } = await ctx.admin
    .from("portfolio_campaigns")
    .select("name, status, assignment_json, v6_effectiveness_json")
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .maybeSingle();
  if (!campaignMeta) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  if (!["draft", "previewed"].includes(campaignMeta.status)) {
    return NextResponse.json(
      { error: `Cannot start a campaign with status "${campaignMeta.status}"` },
      { status: 409 }
    );
  }
  const assignParsed = parseCampaignAssignmentJson(campaignMeta?.assignment_json);
  if (!assignParsed.ok) {
    return NextResponse.json({ error: assignParsed.error }, { status: 400 });
  }
  const assignment = assignParsed.value;

  const prevEff = (campaignMeta?.v6_effectiveness_json as Record<string, unknown> | null) ?? {};
  const metricsAtStart =
    isFeatureEnabled("v6AssuranceCore") || isFeatureEnabled("v6OutcomeIntelligence")
      ? await gatherPortfolioMetrics(ctx.admin, ctx.orgId)
      : undefined;
  const { data, error } = await ctx.admin
    .from("portfolio_campaigns")
    .update({
      status: "active",
      v6_effectiveness_json: {
        ...prevEff,
        ...(metricsAtStart != null ? { metrics_at_start: metricsAtStart } : {}),
        campaign_started_at: new Date().toISOString(),
        started_by_user_id: ctx.userId,
        assurance_hook: "v6_incremental_check",
      },
    })
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .select("id, status, updated_at")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const { data: pendingRows } = await ctx.admin
    .from("portfolio_campaign_contracts")
    .select("id, contract_id, segment_key, assigned_team")
    .eq("organization_id", ctx.orgId)
    .eq("campaign_id", id)
    .eq("status", "pending")
    .limit(500);

  const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const campaignTitle = campaignMeta?.name ?? "Portfolio campaign";
  let tasksSeeded = 0;

  for (const row of pendingRows ?? []) {
    const routing = resolveCampaignTaskRouting({
      segmentKey: row.segment_key,
      assignedTeam: row.assigned_team,
      assignment,
    });
    await ctx.admin.from("contract_tasks").insert({
      contract_id: row.contract_id,
      organization_id: ctx.orgId,
      created_by: ctx.userId,
      assignee_id: routing.assigneeId,
      title: `Campaign follow-up: ${campaignTitle}`,
      details: `Work seeded when the portfolio campaign started. Complete or reassign as needed.\n\n${CAMPAIGN_TASK_MARKER(id)}`,
      status: "open",
      priority: "medium",
      due_date: dueDate,
      created_via: "manual",
      team_key: routing.teamKey,
    });
    await ctx.admin
      .from("portfolio_campaign_contracts")
      .update({ status: "in_progress", updated_at: new Date().toISOString() })
      .eq("organization_id", ctx.orgId)
      .eq("id", row.id);
    await ctx.admin
      .from("contract_program_assignments")
      .update({ v5_campaign_id: id })
      .eq("organization_id", ctx.orgId)
      .eq("contract_id", row.contract_id)
      .eq("status", "active");
    tasksSeeded += 1;
  }

  await ctx.admin.from("portfolio_campaign_events").insert({
    organization_id: ctx.orgId,
    campaign_id: id,
    event_type: "campaign.started",
    payload_json: { tasks_seeded: tasksSeeded },
    actor_user_id: ctx.userId,
  });

  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
  }

  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_post_campaign_start_total", 1).catch(() => undefined);

  return NextResponse.json({ campaign: data, tasksSeeded });
}

