import { NextResponse } from "next/server";
import { getApiAuthContext, canManageCapability } from "@/lib/v4/api-auth";

export async function GET() {
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data, error } = await ctx.admin
    .from("contract_programs")
    .select("id, name, description, state, current_version_id, created_at, updated_at")
    .eq("organization_id", ctx.orgId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ programs: data ?? [] });
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
    autoAssignmentRules?: unknown[];
    defaultRouting?: Record<string, unknown>;
  };
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const { data, error } = await ctx.admin
    .from("contract_programs")
    .insert({
      organization_id: ctx.orgId,
      name,
      description: body.description?.trim() || null,
      auto_assignment_rules: body.autoAssignmentRules ?? [],
      default_routing_json: body.defaultRouting ?? {},
      created_by: ctx.userId,
      state: "draft",
    })
    .select("id, name, description, state, current_version_id, created_at, updated_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const { data: version } = await ctx.admin
    .from("contract_program_versions")
    .insert({
      organization_id: ctx.orgId,
      program_id: data.id,
      version_number: 1,
      state: "draft",
      definition_json: {
        taskBundles: [],
        obligationBundles: [],
        approvalSequences: [],
        renewalCheckpoints: [],
        slas: [],
        escalationRules: [],
      },
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (version?.id) {
    await ctx.admin
      .from("contract_programs")
      .update({ current_version_id: version.id })
      .eq("id", data.id)
      .eq("organization_id", ctx.orgId);
    data.current_version_id = version.id;
  }

  await ctx.admin.from("audit_events").insert({
    organization_id: ctx.orgId,
    user_id: ctx.userId,
    action: "program.created",
    details: { program_id: data.id, name: data.name },
  });

  return NextResponse.json({ program: data }, { status: 201 });
}
