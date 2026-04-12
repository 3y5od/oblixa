import { NextResponse } from "next/server";
import { toSafeString } from "@/lib/v5/api";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV6ApiFeature("v6AssuranceCore");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context();
  if (!ctx) return errorResponse!;

  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/assurance/findings/[id]/events",
  });
  if (modeGate) return modeGate;

  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_get_assurance_finding_events_total", 1).catch(
    () => undefined
  );

  const findingId = toSafeString((await params).id);
  const { data: finding } = await ctx.admin
    .from("assurance_findings")
    .select("id")
    .eq("organization_id", ctx.orgId)
    .eq("id", findingId)
    .maybeSingle();
  if (!finding) {
    return NextResponse.json({ error: "finding_not_found" }, { status: 404 });
  }

  const { data: events, error } = await ctx.admin
    .from("assurance_finding_events")
    .select("id, event_type, payload_json, actor_user_id, created_at")
    .eq("organization_id", ctx.orgId)
    .eq("finding_id", findingId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ events: events ?? [] });
}
