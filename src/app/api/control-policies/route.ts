import { NextResponse } from "next/server";
import { readJsonBody, toSafeString } from "@/lib/v5/api";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { runIncrementalAssuranceChecks } from "@/lib/v6/assurance-checks";
import { createControlPolicy, listControlPolicies } from "@/lib/v6/control-policies";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";

export async function GET() {
  const disabled = requireV6ApiFeature("v6ControlPolicies");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context();
  if (!ctx) return errorResponse!;

  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_get_control_policies_list_total", 1).catch(
    () => undefined
  );

  const { data, error } = await listControlPolicies(ctx.admin, ctx.orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ policies: data ?? [] });
}

export async function POST(request: Request) {
  const disabled = requireV6ApiFeature("v6ControlPolicies");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context("settings_manage");
  if (!ctx) return errorResponse!;

  const body = readJsonBody<{ name?: string; objective?: string; enforcementMode?: string; scope?: Record<string, unknown> }>(
    await request.json().catch(() => ({})),
    {}
  );

  const name = toSafeString(body.name);
  const objective = toSafeString(body.objective);
  if (!name || !objective) {
    return NextResponse.json({ error: "name and objective are required" }, { status: 400 });
  }

  const result = await createControlPolicy(ctx.admin, ctx.orgId, ctx.userId, {
    name,
    objective,
    enforcementMode: toSafeString(body.enforcementMode) || undefined,
    scope: body.scope,
  });

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_post_control_policies_create_total", 1).catch(
    () => undefined
  );
  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
  }
  return NextResponse.json({ policy: result.data }, { status: 201 });
}
