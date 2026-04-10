import { NextResponse } from "next/server";
import { toSafeString } from "@/lib/v5/api";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { runIncrementalAssuranceChecks } from "@/lib/v6/assurance-checks";
import { recomputeSegmentMemberships } from "@/lib/v6/segments";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV6ApiFeature("v6Segments");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context("settings_manage");
  if (!ctx) return errorResponse!;

  const segmentId = toSafeString((await params).id);
  const result = await recomputeSegmentMemberships(ctx.admin, ctx.orgId, segmentId);
  if ("error" in result && result.error) {
    const msg =
      typeof result.error === "object" && result.error && "message" in result.error
        ? String((result.error as { message: string }).message)
        : "Segment recompute failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
  }
  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_post_segment_recompute_total", 1).catch(() => undefined);
  return NextResponse.json({ ok: true, membershipCount: result.count });
}
