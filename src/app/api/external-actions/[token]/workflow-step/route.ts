import { NextResponse } from "next/server";
import { canManageCapability, getApiAuthContext } from "@/lib/v4/api-auth";
import { readJsonBody, toSafeString } from "@/lib/v5/api";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { appendExternalWorkflowStep, setExternalWorkflowAckDeadline } from "@/lib/v6/external-collaboration";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const disabled = requireV5ApiFeature("v5ExternalCollaboration");
  if (disabled) return disabled;

  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await canManageCapability(ctx, "contracts_edit"))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const token = toSafeString((await params).token);
  const { data: link, error } = await ctx.admin
    .from("external_action_links")
    .select("id, organization_id")
    .eq("organization_id", ctx.orgId)
    .eq("token", token)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!link) return NextResponse.json({ error: "External action not found" }, { status: 404 });

  const body = readJsonBody<{
    stepType?: string;
    payload?: Record<string, unknown>;
    ackDeadlineIso?: string;
  }>(await request.json().catch(() => ({})), {});
  const stepType = toSafeString(body.stepType) || "handoff";

  const result = await appendExternalWorkflowStep(
    ctx.admin,
    ctx.orgId,
    String(link.id),
    stepType,
    body.payload ?? {},
    ctx.userId
  );

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });

  if (isFeatureEnabled("v6AssuranceCore")) {
    await incrementV6QualityCounter(ctx.admin, ctx.orgId, "external_workflow_step_appends_total", 1).catch(
      () => undefined
    );
  }

  const ack = toSafeString(body.ackDeadlineIso);
  if (ack) {
    await setExternalWorkflowAckDeadline(ctx.admin, ctx.orgId, String(link.id), ack);
  }

  return NextResponse.json({ externalAction: result.data }, { status: 201 });
}
