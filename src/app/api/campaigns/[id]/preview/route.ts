import { NextResponse } from "next/server";
import { jsonForbidden, jsonNotFound, jsonProblem, jsonUnauthorized } from "@/lib/http/problem";
import { canManageCapability, getApiAuthContext } from "@/lib/v4/api-auth";
import { nowIso } from "@/lib/v5/api";
import { parseCampaignAssignmentJson } from "@/lib/v5/campaign-assignment";
import {
  countContractsMatchingEligibility,
  syncCampaignContractsFromEligibility,
} from "@/lib/v5/campaign-eligibility";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { runIncrementalAssuranceChecks } from "@/lib/v6/assurance-checks";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { rejectUnexpectedBody } from "@/lib/security/read-json-body-limited";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";

const ROUTE = "/api/campaigns/[id]/preview";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV5ApiFeature("v5PortfolioCampaigns");
  if (disabled) return disabled;
  const ctx = await getApiAuthContext();
  if (!ctx) return jsonUnauthorized(ROUTE);
  if (!(await canManageCapability(ctx, "maintenance_manage"))) {
    return jsonForbidden(ROUTE);
  }
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/campaigns/[id]/preview",
  });
  if (modeGate) return modeGate;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/campaigns/[id]/preview",
    method: "POST",
  }).catch(() => undefined);

  const unexpectedBody = await rejectUnexpectedBody(request);
  if (unexpectedBody) return unexpectedBody;

  const { id } = await params;

  const routeParamRejection = rejectUnsafeRouteParams({ id }, ["id"], "/api/campaigns/[id]/preview");

  if (routeParamRejection) return routeParamRejection;
  const { data: campaignRow } = await ctx.admin
    .from("portfolio_campaigns")
    .select("eligibility_json, assignment_json")
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .maybeSingle();
  const elig = campaignRow?.eligibility_json;
  const assignParsed = parseCampaignAssignmentJson(campaignRow?.assignment_json);
  if (!assignParsed.ok) {
    return jsonProblem(400, {
      error: assignParsed.error,
      code: "invalid_campaign_assignment",
      diagnostic_id: "campaign_preview_assignment_invalid",
      route: ROUTE,
    });
  }
  let eligibilityMatchCount = 0;
  if (elig && typeof elig === "object" && !Array.isArray(elig)) {
    const e = elig as Record<string, unknown>;
    eligibilityMatchCount = await countContractsMatchingEligibility(ctx.admin, ctx.orgId, e);
    await syncCampaignContractsFromEligibility(
      ctx.admin,
      ctx.orgId,
      id,
      e,
      assignParsed.value
    );
  }

  const [{ count: pending }, { count: inProgress }, { count: processed }, { count: failed }] =
    await Promise.all([
      ctx.admin
        .from("portfolio_campaign_contracts")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", ctx.orgId)
        .eq("campaign_id", id)
        .eq("status", "pending"),
      ctx.admin
        .from("portfolio_campaign_contracts")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", ctx.orgId)
        .eq("campaign_id", id)
        .eq("status", "in_progress"),
      ctx.admin
        .from("portfolio_campaign_contracts")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", ctx.orgId)
        .eq("campaign_id", id)
        .eq("status", "processed"),
      ctx.admin
        .from("portfolio_campaign_contracts")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", ctx.orgId)
        .eq("campaign_id", id)
        .eq("status", "failed"),
    ]);

  const preview = {
    pending: pending ?? 0,
    in_progress: inProgress ?? 0,
    processed: processed ?? 0,
    failed: failed ?? 0,
    eligibility_match_count: eligibilityMatchCount,
    previewed_at: nowIso(),
  };

  const { data, error } = await ctx.admin
    .from("portfolio_campaigns")
    .update({ status: "previewed", preview_summary_json: preview })
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .select("id, status, preview_summary_json, updated_at")
    .maybeSingle();
  if (error) {
    return jsonProblem(400, {
      error: error.message,
      code: "campaign_preview_failed",
      diagnostic_id: "campaign_preview_failed",
      route: ROUTE,
    });
  }
  if (!data) return jsonNotFound(ROUTE);

  await ctx.admin.from("portfolio_campaign_events").insert({
    organization_id: ctx.orgId,
    campaign_id: id,
    event_type: "campaign.previewed",
    payload_json: preview,
    actor_user_id: ctx.userId,
  });

  // Preview mutates campaign + portfolio_campaign_contracts membership; refresh assurance signals.
  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
  }

  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_post_campaign_preview_total", 1).catch(() => undefined);

  return NextResponse.json({ campaign: data, preview });
}

