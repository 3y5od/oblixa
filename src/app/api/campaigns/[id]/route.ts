import { NextResponse } from "next/server";
import { canManageCapability, getApiAuthContext } from "@/lib/v4/api-auth";
import { readJsonBody, toSafeString } from "@/lib/v5/api";
import {
  parseCampaignAssignmentJson,
} from "@/lib/v5/campaign-assignment";
import {
  campaignTypeValidationError,
  isValidCampaignType,
} from "@/lib/v5/campaign-types";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { runIncrementalAssuranceChecks } from "@/lib/v6/assurance-checks";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV5ApiFeature("v5PortfolioCampaigns");
  if (disabled) return disabled;
  const { id } = await params;
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/campaigns/[id]",
  });
  if (modeGate) return modeGate;

  const { data, error } = await ctx.admin
    .from("portfolio_campaigns")
    .select(
      "id, name, campaign_type, status, owner_user_id, eligibility_json, assignment_json, preview_summary_json, progress_summary_json, rollback_safe, rolled_back_at, updated_at"
    )
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const [{ data: contracts }, { data: events }] = await Promise.all([
    ctx.admin
      .from("portfolio_campaign_contracts")
      .select("id, contract_id, status, status_reason, segment_key, assigned_team, updated_at")
      .eq("organization_id", ctx.orgId)
      .eq("campaign_id", id)
      .order("updated_at", { ascending: false })
      .limit(500),
    ctx.admin
      .from("portfolio_campaign_events")
      .select("id, event_type, payload_json, actor_user_id, created_at")
      .eq("organization_id", ctx.orgId)
      .eq("campaign_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  return NextResponse.json({
    campaign: data,
    contracts: contracts ?? [],
    events: events ?? [],
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV5ApiFeature("v5PortfolioCampaigns");
  if (disabled) return disabled;
  const { id } = await params;
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/campaigns/[id]",
  });
  if (modeGate) return modeGate;
  if (!(await canManageCapability(ctx, "maintenance_manage"))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const raw = await request.json().catch(() => ({}));
  const body = readJsonBody<{
    name?: string;
    campaignType?: string;
    assignmentJson?: unknown;
    eligibilityJson?: unknown;
  }>(raw, {});
  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const n = toSafeString(body.name);
    if (!n) return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
    patch.name = n;
  }
  if (body.campaignType !== undefined) {
    const ct = toSafeString(body.campaignType);
    if (!ct || !isValidCampaignType(ct)) {
      return NextResponse.json({ error: campaignTypeValidationError() }, { status: 400 });
    }
    patch.campaign_type = ct;
  }
  if (body.assignmentJson !== undefined) {
    const parsed = parseCampaignAssignmentJson(body.assignmentJson);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    patch.assignment_json = parsed.value;
  }
  if (body.eligibilityJson !== undefined) {
    if (
      body.eligibilityJson === null ||
      typeof body.eligibilityJson !== "object" ||
      Array.isArray(body.eligibilityJson)
    ) {
      return NextResponse.json({ error: "eligibilityJson must be a JSON object" }, { status: 400 });
    }
    patch.eligibility_json = body.eligibilityJson;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await ctx.admin
    .from("portfolio_campaigns")
    .update(patch)
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .select("id, name, campaign_type, status, eligibility_json, assignment_json, updated_at")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  await ctx.admin.from("portfolio_campaign_events").insert({
    organization_id: ctx.orgId,
    campaign_id: id,
    event_type: "campaign.updated",
    payload_json: { fields: Object.keys(patch) },
    actor_user_id: ctx.userId,
  });

  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
  }

  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_patch_campaign_total", 1).catch(() => undefined);

  return NextResponse.json({ campaign: data });
}

