import { NextResponse } from "next/server";
import { readJsonBody, toSafeString } from "@/lib/v5/api";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { runIncrementalAssuranceChecks } from "@/lib/v6/assurance-checks";
import { createSegment, listSegments } from "@/lib/v6/segments";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";

const ALLOWED_SEGMENT_TYPES = new Set([
  "business_unit",
  "region",
  "product_line",
  "contract_class",
  "customer_tier",
  "operational_tier",
  "control_sensitivity_tier",
  "custom",
]);

export async function GET() {
  const disabled = requireV6ApiFeature("v6Segments");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context();
  if (!ctx) return errorResponse!;

  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/segments",
  });
  if (modeGate) return modeGate;

  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_get_segments_list_total", 1).catch(() => undefined);

  const { data, error } = await listSegments(ctx.admin, ctx.orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ segments: data ?? [] });
}

export async function POST(request: Request) {
  const disabled = requireV6ApiFeature("v6Segments");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context("settings_manage");
  if (!ctx) return errorResponse!;

  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/segments",
  });
  if (modeGate) return modeGate;

  const body = readJsonBody<{ segmentType?: string; key?: string; name?: string; criteria?: Record<string, unknown> }>(
    await request.json().catch(() => ({})),
    {}
  );

  const segmentType = toSafeString(body.segmentType) || "custom";
  if (!ALLOWED_SEGMENT_TYPES.has(segmentType)) {
    return NextResponse.json(
      { error: `segmentType must be one of: ${[...ALLOWED_SEGMENT_TYPES].join(", ")}` },
      { status: 400 }
    );
  }
  const key = toSafeString(body.key);
  const name = toSafeString(body.name);
  if (!key || !name) return NextResponse.json({ error: "key and name are required" }, { status: 400 });

  const result = await createSegment(ctx.admin, ctx.orgId, ctx.userId, {
    segmentType,
    key,
    name,
    criteria: body.criteria,
  });
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_post_segment_create_total", 1).catch(() => undefined);
  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
  }
  return NextResponse.json({ segment: result.data }, { status: 201 });
}
