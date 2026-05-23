import { NextResponse } from "next/server";
import { jsonForbidden, jsonNotFound, jsonProblem, jsonUnauthorized } from "@/lib/http/problem";
import { canManageCapability, getApiAuthContext } from "@/lib/v4/api-auth";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { collectSupabaseRangePages } from "@/lib/supabase/range-pagination";
import { escapeCsvCellForSpreadsheet } from "@/lib/csv-formula-safe";
import {
  contentDispositionAttachment,
  sanitizeExportFileName,
  sanitizeExportFileNameToken,
} from "@/lib/security/export-filename";
import { recordApiRouteAuditEvent } from "@/lib/security/api-mutation-audit";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";
import { parseFixedEnumParam } from "@/lib/security/validation";

/** Buffered export cap; full dataset via paged `.range` (see collectSupabaseRangePages). Streaming CSV remains future work if memory becomes an issue. */
const EXPORT_CAMPAIGN_CONTRACTS_MAX_ROWS = 250_000;
const ROUTE = "/api/campaigns/[id]/export";

export const maxDuration = 60;

type CampaignContractExportRow = {
  contract_id: string;
  status: string;
  segment_key: string | null;
  assigned_team: string | null;
  status_reason: string | null;
  updated_at: string;
};

function toCsv(rows: Record<string, string | number | null | undefined>[]) {
  if (rows.length === 0) return "contract_id,status,segment_key,assigned_team\n";
  const keys = Object.keys(rows[0]);
  const esc = (v: unknown) => escapeCsvCellForSpreadsheet(v == null ? "" : String(v));
  return [keys.join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n");
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    apiPath: "/api/campaigns/[id]/export",
  });
  if (modeGate) return modeGate;

  const { id } = await params;

  const routeParamRejection = rejectUnsafeRouteParams({ id }, ["id"], "/api/campaigns/[id]/export");

  if (routeParamRejection) return routeParamRejection;
  void recordApiRouteAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: ROUTE,
    method: "GET",
    action: "api.sensitive_read_authorized",
  }).catch(() => undefined);

  const { searchParams } = new URL(request.url);
  const format = parseFixedEnumParam(searchParams.get("format"), ["json", "csv"] as const, "json");
  const safeCampaignId = sanitizeExportFileNameToken(id);

  const { data: campaign } = await ctx.admin
    .from("portfolio_campaigns")
    .select("id, name, campaign_type, status, preview_summary_json, progress_summary_json, updated_at")
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .maybeSingle();
  if (!campaign) return jsonNotFound(ROUTE);

  const { rows, error, truncated } = await collectSupabaseRangePages<CampaignContractExportRow>(
    (from, to) =>
      ctx.admin
        .from("portfolio_campaign_contracts")
        .select("contract_id, status, segment_key, assigned_team, status_reason, updated_at")
        .eq("organization_id", ctx.orgId)
        .eq("campaign_id", id)
        .order("updated_at", { ascending: false })
        .range(from, to),
    { pageSize: 1000, maxRows: EXPORT_CAMPAIGN_CONTRACTS_MAX_ROWS }
  );
  if (error) {
    return jsonProblem(400, {
      error: error.message,
      code: "campaign_export_failed",
      diagnostic_id: "campaign_export_failed",
      route: ROUTE,
    });
  }
  if (format === "csv") {
    const fileName = sanitizeExportFileName(`campaign-${safeCampaignId}.csv`);
    const csv = toCsv(
      rows.map((r) => ({
        contract_id: String(r.contract_id),
        status: r.status,
        segment_key: r.segment_key ?? "",
        assigned_team: r.assigned_team ?? "",
        status_reason: r.status_reason ?? "",
        updated_at: r.updated_at,
      }))
    );
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": contentDispositionAttachment(fileName),
        "Cache-Control": "private, no-store",
      },
    });
  }

  return NextResponse.json(
    {
      campaign,
      contracts: rows,
      exported_at: new Date().toISOString(),
      ...(truncated ? { truncated: true as const } : {}),
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
