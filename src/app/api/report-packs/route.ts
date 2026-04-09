import { NextResponse } from "next/server";
import { getApiAuthContext, canManageCapability } from "@/lib/v4/api-auth";

export async function GET() {
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data, error } = await ctx.admin
    .from("report_packs")
    .select("id, name, description, report_type, schedule, active, updated_at")
    .eq("organization_id", ctx.orgId)
    .order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ reportPacks: data ?? [] });
}

export async function POST(request: Request) {
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
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

  const { data, error } = await ctx.admin
    .from("report_packs")
    .insert({
      organization_id: ctx.orgId,
      name,
      description: body.description?.trim() || null,
      report_type: body.reportType?.trim() || "weekly_execution_health",
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
