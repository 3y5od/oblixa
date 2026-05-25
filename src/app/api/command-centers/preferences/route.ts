import { NextResponse } from "next/server";
import { jsonProblem, jsonUnauthorized } from "@/lib/http/problem";
import { BODY_LIMIT_SMALL_JSON, readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { getApiAuthContext } from "@/lib/contract-operations/api-auth";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";

const ROUTE = "/api/command-centers/preferences";

export async function GET() {
  const ctx = await getApiAuthContext();
  if (!ctx) return jsonUnauthorized(ROUTE);
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/command-centers/preferences",
  });
  if (modeGate) return modeGate;

  const { data, error } = await ctx.admin
    .from("role_command_center_preferences")
    .select("id, role, preferences_json, updated_at")
    .eq("organization_id", ctx.orgId)
    .eq("user_id", ctx.userId)
    .eq("role", ctx.role)
    .maybeSingle();
  if (error) {
    return jsonProblem(400, {
      error: error.message,
      code: "command_center_preferences_load_failed",
      diagnostic_id: "command_center_preferences_load_failed",
      route: ROUTE,
    });
  }
  return NextResponse.json({ preferences: data ?? null });
}

export async function POST(request: Request) {
  const ctx = await getApiAuthContext();
  if (!ctx) return jsonUnauthorized(ROUTE);
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/command-centers/preferences",
  });
  if (modeGate) return modeGate;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/command-centers/preferences",
    method: "POST",
  }).catch(() => undefined);

  const _lb_body = await readJsonBodyLimited(request, BODY_LIMIT_SMALL_JSON);
  if (!_lb_body.ok) return _lb_body.response;
  const body = (_lb_body.body ?? {}) as { preferences?: Record<string, unknown> };
  const { data, error } = await ctx.admin
    .from("role_command_center_preferences")
    .upsert(
      {
        organization_id: ctx.orgId,
        user_id: ctx.userId,
        role: ctx.role,
        preferences_json: body.preferences ?? {},
      },
      {
        onConflict: "organization_id,user_id,role",
        ignoreDuplicates: false,
      }
    )
    .select("id, role, preferences_json, updated_at")
    .single();
  if (error) {
    return jsonProblem(400, {
      error: error.message,
      code: "command_center_preferences_update_failed",
      diagnostic_id: "command_center_preferences_update_failed",
      route: ROUTE,
    });
  }
  return NextResponse.json({ preferences: data });
}
