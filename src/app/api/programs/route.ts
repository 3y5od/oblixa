import { NextResponse } from "next/server";
import { jsonForbidden, jsonProblem, jsonUnauthorized } from "@/lib/http/problem";
import { getApiAuthContext, canManageCapability } from "@/lib/contract-operations/api-auth";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { secFetchSiteAllowsSensitiveMutation } from "@/lib/security/sec-fetch-policy";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { enforceIdempotency } from "@/lib/idempotency";

const ROUTE = "/api/programs";

export async function GET() {
  const ctx = await getApiAuthContext();
  if (!ctx) return jsonUnauthorized(ROUTE);
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/programs",
  });
  if (modeGate) return modeGate;

  const { data, error } = await ctx.admin
    .from("contract_programs")
    .select("id, name, description, state, current_version_id, created_at, updated_at")
    .eq("organization_id", ctx.orgId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    return jsonProblem(400, {
      error: "Failed to load programs",
      code: "programs_list_failed",
      diagnostic_id: "programs_list_failed",
      route: ROUTE,
    });
  }

  return NextResponse.json({ programs: data ?? [] });
}

export async function POST(request: Request) {
  const ctx = await getApiAuthContext();
  if (!ctx) return jsonUnauthorized(ROUTE);
  if (!(await canManageCapability(ctx, "contracts_edit"))) {
    return jsonForbidden(ROUTE);
  }
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/programs",
  });
  if (modeGate) return modeGate;

  const duplicate = await enforceIdempotency(request, {
    scope: "api.programs",
    actorKey: `${ctx.orgId}:${ctx.userId}`,
  });
  if (duplicate) return duplicate;
  if (!secFetchSiteAllowsSensitiveMutation(request)) {
    return jsonProblem(403, {
      error: "Cross-site request rejected",
      code: "cross_site_request_rejected",
      diagnostic_id: "programs_cross_site_rejected",
      route: ROUTE,
    });
  }

  const parsed = await readJsonBodyLimited(request);
  if (!parsed.ok) return parsed.response;
  const body = (parsed.body ?? {}) as {
    name?: string;
    description?: string;
    autoAssignmentRules?: unknown[];
    defaultRouting?: Record<string, unknown>;
  };
  const name = String(body.name ?? "").trim();
  if (!name) {
    return jsonProblem(400, {
      error: "name is required",
      code: "name_required",
      diagnostic_id: "program_name_required",
      route: ROUTE,
    });
  }

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
  if (error) {
    return jsonProblem(400, {
      error: "Failed to create program",
      code: "program_create_failed",
      diagnostic_id: "program_create_failed",
      route: ROUTE,
    });
  }

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
