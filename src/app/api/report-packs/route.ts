import { NextResponse } from "next/server";
import { getApiAuthContext, canManageCapability } from "@/lib/v4/api-auth";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { parseWorkspaceMode } from "@/lib/product-surface/context";
import { workspaceModeAllowsReportType } from "@/lib/product-surface/feature-registry";
import { getV6OrgSettingsJson } from "@/lib/v6/org-settings";

export async function GET() {
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/report-packs",
  });
  if (modeGate) return modeGate;

  const v6 = await getV6OrgSettingsJson(ctx.admin, ctx.orgId);
  const mode = parseWorkspaceMode(v6);

  const { data, error } = await ctx.admin
    .from("report_packs")
    .select("id, name, description, report_type, schedule, active, updated_at")
    .eq("organization_id", ctx.orgId)
    .order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const rows = (data ?? []).filter((row) =>
    workspaceModeAllowsReportType(mode, String((row as { report_type?: string }).report_type ?? ""))
  );
  return NextResponse.json({ reportPacks: rows });
}

export async function POST(request: Request) {
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/report-packs",
  });
  if (modeGate) return modeGate;
  if (!(await canManageCapability(ctx, "contracts_edit"))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    description?: string;
    reportType?: string;
    schedule?: string;
    config?: Record<string, unknown>;
    delivery?: Record<string, unknown>;
  };
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const reportType = body.reportType?.trim() || "weekly_execution_health";
  const v6 = await getV6OrgSettingsJson(ctx.admin, ctx.orgId);
  const mode = parseWorkspaceMode(v6);
  if (!workspaceModeAllowsReportType(mode, reportType)) {
    return NextResponse.json({ error: "Feature not available in workspace mode" }, { status: 404 });
  }

  const { data, error } = await ctx.admin
    .from("report_packs")
    .insert({
      organization_id: ctx.orgId,
      name,
      description: body.description?.trim() || null,
      report_type: reportType,
      schedule: body.schedule?.trim() || null,
      config_json: body.config ?? {},
      delivery_json: body.delivery ?? {},
      created_by: ctx.userId,
      active: true,
    })
    .select("id, name, report_type, schedule, active")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ reportPack: data }, { status: 201 });
}
