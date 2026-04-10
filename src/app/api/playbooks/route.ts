import { NextResponse } from "next/server";
import { readJsonBody, toSafeString } from "@/lib/v5/api";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { createPlaybook, listPlaybooks } from "@/lib/v6/playbooks";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";

export async function GET() {
  const disabled = requireV6ApiFeature("v6AdaptivePlaybooks");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context();
  if (!ctx) return errorResponse!;

  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_get_playbooks_list_total", 1).catch(() => undefined);

  const { data, error } = await listPlaybooks(ctx.admin, ctx.orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ playbooks: data ?? [] });
}

export async function POST(request: Request) {
  const disabled = requireV6ApiFeature("v6AdaptivePlaybooks");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context("maintenance_manage");
  if (!ctx) return errorResponse!;

  const body = readJsonBody<{ name?: string; playbookType?: string }>(await request.json().catch(() => ({})), {});
  const name = toSafeString(body.name);
  const playbookType = toSafeString(body.playbookType) || "custom";
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const result = await createPlaybook(ctx.admin, ctx.orgId, ctx.userId, { name, playbookType });
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
  return NextResponse.json({ playbook: result.data }, { status: 201 });
}
