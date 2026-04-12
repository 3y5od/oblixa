import { NextResponse } from "next/server";
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
  ensureAccountWorkspaceFromContracts,
  ensureTimelineForAccount,
} from "@/lib/v5/relationship-bootstrap";

/** `key` is the account_key string (same identifier used in /accounts/[key] pages), not the workspace row UUID. */
export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const disabled = requireV5ApiFeature("v5RelationshipLayer");
  if (disabled) return disabled;
  const { key: rawKey } = await params;
  const accountKey = decodeURIComponent(rawKey);
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/accounts/[key]/summary",
  });
  if (modeGate) return modeGate;
  const productSurface = await loadProductSurfaceContext(
    ctx.admin,
    ctx.orgId,
    ctx.role as WorkspaceRole
  );

  const ensured = await ensureAccountWorkspaceFromContracts(ctx.admin, ctx.orgId, accountKey);
  if (!ensured) {
    return NextResponse.json({ error: "Unable to resolve account workspace" }, { status: 400 });
  }

  const [{ data: workspace, error }, { data: contracts }] = await Promise.all([
    ctx.admin
      .from("account_workspaces")
      .select("id, account_key, display_name, summary_json, health_signal_json, updated_at")
      .eq("organization_id", ctx.orgId)
      .eq("id", ensured.id)
      .single(),
    ctx.admin
      .from("contracts")
      .select("id, title, counterparty, status, annual_value")
      .eq("organization_id", ctx.orgId)
      .eq("account_key", accountKey)
      .order("updated_at", { ascending: false })
      .limit(200),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const timelineId = await ensureTimelineForAccount(
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
