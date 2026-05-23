import { NextResponse } from "next/server";
import { jsonProblem, jsonUnauthorized } from "@/lib/http/problem";
import { getApiAuthContext } from "@/lib/v4/api-auth";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";
import { buildRelationshipKeyMetrics } from "@/lib/v5/relationship-key-metrics";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import {
  isAdvancedModuleHidden,
  isAssuranceModuleHidden,
  loadProductSurfaceContext,
} from "@/lib/product-surface/context";
import type { WorkspaceRole } from "@/lib/navigation";
import {
  ensureCounterpartyWorkspaceFromContracts,
  ensureTimelineForCounterparty,
} from "@/lib/v5/relationship-bootstrap";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";

const ROUTE = "/api/counterparties/[key]/summary";

/** `key` is the counterparty_key string (same as /counterparties/[key] pages), not the workspace row UUID. */
export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const disabled = requireV5ApiFeature("v5RelationshipLayer");
  if (disabled) return disabled;
  const ctx = await getApiAuthContext();
  if (!ctx) return jsonUnauthorized(ROUTE);
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/counterparties/[key]/summary",
  });
  if (modeGate) return modeGate;
  const productSurface = await loadProductSurfaceContext(
    ctx.admin,
    ctx.orgId,
    ctx.role as WorkspaceRole
  );

  const { key: rawKey } = await params;

  const routeParamRejection = rejectUnsafeRouteParams({ key: rawKey }, ["key"], "/api/counterparties/[key]/summary");

  if (routeParamRejection) return routeParamRejection;
  const counterpartyKey = decodeURIComponent(rawKey);
  const ensured = await ensureCounterpartyWorkspaceFromContracts(
    ctx.admin,
    ctx.orgId,
    counterpartyKey
  );
  if (!ensured) {
    return jsonProblem(400, {
      error: "Unable to resolve counterparty workspace",
      code: "counterparty_workspace_resolve_failed",
      diagnostic_id: "counterparty_workspace_resolve_failed",
      route: ROUTE,
    });
  }

  const [{ data: workspace, error }, { data: contracts }] = await Promise.all([
    ctx.admin
      .from("counterparty_workspaces")
      .select("id, counterparty_key, display_name, summary_json, health_signal_json, updated_at")
      .eq("organization_id", ctx.orgId)
      .eq("id", ensured.id)
      .single(),
    ctx.admin
      .from("contracts")
      .select("id, title, counterparty, status, annual_value")
      .eq("organization_id", ctx.orgId)
      .eq("counterparty_key", counterpartyKey)
      .order("updated_at", { ascending: false })
      .limit(200),
  ]);
  if (error) {
    return jsonProblem(400, {
      error: error.message,
      code: "counterparty_workspace_load_failed",
      diagnostic_id: "counterparty_workspace_load_failed",
      route: ROUTE,
    });
  }

  const timelineId = await ensureTimelineForCounterparty(
    ctx.admin,
    ctx.orgId,
    ensured.id,
    `Timeline · ${ensured.display_name}`
  );

  let timelineEvents: unknown[] = [];
  if (timelineId) {
    const { data: evs } = await ctx.admin
      .from("relationship_timeline_events")
      .select("id, event_type, event_at, payload_json, linked_contract_id")
      .eq("organization_id", ctx.orgId)
      .eq("relationship_timeline_id", timelineId)
      .order("event_at", { ascending: false })
      .limit(25);
    timelineEvents = evs ?? [];
  }
  const filteredTimelineEvents = (timelineEvents as Array<{ event_type?: string }>).filter((evt) => {
    const type = String(evt.event_type ?? "").toLowerCase();
    if (type.startsWith("decision.")) {
      return productSurface.mode !== "core" && !isAdvancedModuleHidden(productSurface, "decisions");
    }
    if (type.startsWith("campaign.")) {
      return productSurface.mode !== "core" && !isAdvancedModuleHidden(productSurface, "campaigns");
    }
    if (type.startsWith("program.")) {
      return productSurface.mode !== "core" && !isAdvancedModuleHidden(productSurface, "programs");
    }
    if (type.startsWith("relationship.")) {
      return productSurface.mode !== "core" && !isAdvancedModuleHidden(productSurface, "relationships");
    }
    if (type.startsWith("finding.")) {
      return productSurface.mode === "assurance" && !isAssuranceModuleHidden(productSurface, "findings");
    }
    if (type.startsWith("playbook.")) {
      return productSurface.mode === "assurance" && !isAssuranceModuleHidden(productSurface, "playbooks");
    }
    return true;
  });

  const contractIds = (contracts ?? []).map((c) => String(c.id));
  const liveMetrics = await buildRelationshipKeyMetrics(ctx.admin, ctx.orgId, contractIds);

  return NextResponse.json({
    workspace,
    contracts: contracts ?? [],
    timelineEvents: filteredTimelineEvents,
    liveMetrics,
  });
}
