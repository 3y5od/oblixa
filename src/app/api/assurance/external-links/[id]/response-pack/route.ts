import { NextResponse } from "next/server";
import { readJsonBody, toSafeString } from "@/lib/v5/api";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { mergeExternalResponsePack } from "@/lib/v6/external-collaboration";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";

/**
 * Internal merge for counterparty response pack metadata (v6.md §9.9).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV6ApiFeature("v6AssuranceCore");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context("maintenance_manage");
  if (!ctx) return errorResponse!;

  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/assurance/external-links/[id]/response-pack",
  });
  if (modeGate) return modeGate;

  const linkId = toSafeString((await params).id);
  const body = readJsonBody<{ pack?: Record<string, unknown> }>(await request.json().catch(() => ({})), {});
  const pack = body.pack && typeof body.pack === "object" ? body.pack : null;
  if (!pack || Object.keys(pack).length === 0) {
    return NextResponse.json({ error: "pack object is required" }, { status: 400 });
  }

  const { data: link } = await ctx.admin
    .from("external_action_links")
    .select("id")
    .eq("organization_id", ctx.orgId)
    .eq("id", linkId)
    .maybeSingle();
  if (!link) return NextResponse.json({ error: "External link not found" }, { status: 404 });

  const { data, error } = await mergeExternalResponsePack(ctx.admin, ctx.orgId, linkId, pack);
  if (error) {
    return NextResponse.json({ error: (error as { message?: string }).message ?? "merge failed" }, { status: 400 });
  }
  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "external_response_pack_merges_total", 1).catch(
    () => undefined
  );
  return NextResponse.json({ externalAction: data });
}
