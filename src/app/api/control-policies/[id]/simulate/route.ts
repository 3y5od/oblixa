import { NextResponse } from "next/server";
import { toSafeString } from "@/lib/v5/api";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { simulateControlPolicy } from "@/lib/v6/control-policies";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV6ApiFeature("v6ControlPolicies");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context();
  if (!ctx) return errorResponse!;

  const policyId = toSafeString((await params).id);
  const result = await simulateControlPolicy(ctx.admin, ctx.orgId, policyId, ctx.userId);
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_post_control_policy_simulate_total", 1).catch(
    () => undefined
  );
  return NextResponse.json(
    { simulation: result.data, evaluations: result.evaluations ?? [] },
    { status: 201 }
  );
}
