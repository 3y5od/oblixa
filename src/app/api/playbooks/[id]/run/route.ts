import { NextResponse } from "next/server";
import { readJsonBody, toSafeString } from "@/lib/v5/api";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { runIncrementalAssuranceChecks } from "@/lib/v6/assurance-checks";
import { runPlaybook } from "@/lib/v6/playbooks";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV6ApiFeature("v6AdaptivePlaybooks");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context("maintenance_manage");
  if (!ctx) return errorResponse!;

  const body = readJsonBody<{ sourceFindingId?: string }>(await request.json().catch(() => ({})), {});
  const playbookId = toSafeString((await params).id);
  const result = await runPlaybook(ctx.admin, ctx.orgId, playbookId, ctx.userId, {
    sourceFindingId: body.sourceFindingId ? toSafeString(body.sourceFindingId) : null,
  });
  if (result.error) {
    const msg =
      typeof result.error === "object" && result.error && "message" in result.error
        ? String((result.error as { message: string }).message)
        : "Playbook run failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
  }
  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_post_playbook_run_total", 1).catch(() => undefined);
  return NextResponse.json({ run: result.data }, { status: 201 });
}
