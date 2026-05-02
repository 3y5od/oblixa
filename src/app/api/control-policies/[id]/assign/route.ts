import { NextResponse } from "next/server";
import { parseJsonBodyWithLimit } from "@/lib/security/read-json-body-limited";
import { readJsonBody, toSafeString } from "@/lib/v5/api";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { runIncrementalAssuranceChecks } from "@/lib/v6/assurance-checks";
import { assignControlPolicy } from "@/lib/v6/control-policies";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV6ApiFeature("v6ControlPolicies");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context("settings_manage");
  if (!ctx) return errorResponse!;

  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/control-policies/[id]/assign",
  });
  if (modeGate) return modeGate;

  const parsedBody = await parseJsonBodyWithLimit(request, (raw) =>
    readJsonBody<{ assignmentType?: string; segmentId?: string; targetRefType?: string; targetRefId?: string }>(
      raw ?? {},
      {}
    )
  );
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;
  const policyId = toSafeString((await params).id);
  const assignmentType = toSafeString(body.assignmentType) || "global";

  const result = await assignControlPolicy(ctx.admin, ctx.orgId, policyId, ctx.userId, {
    assignmentType,
    segmentId: toSafeString(body.segmentId) || undefined,
    targetRefType: toSafeString(body.targetRefType) || undefined,
    targetRefId: toSafeString(body.targetRefId) || undefined,
  });

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_post_control_policy_assign_total", 1).catch(() => undefined);
  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
  }
  return NextResponse.json({ assignment: result.data }, { status: 201 });
}
