import { NextResponse } from "next/server";
import { parseJsonBodyWithLimit } from "@/lib/security/read-json-body-limited";
import { readJsonBody, toSafeString } from "@/lib/v5/api";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { dismissFinding, resolveFinding } from "@/lib/v6/assurance";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV6ApiFeature("v6AssuranceCore");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context("maintenance_manage");
  if (!ctx) return errorResponse!;

  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/assurance/findings/[id]/resolve",
  });
  if (modeGate) return modeGate;

  const parsedBody = await parseJsonBodyWithLimit(request, (raw) =>
    readJsonBody<{ note?: string; action?: string; signalFeedback?: string }>(raw ?? {}, {})
  );
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;
  const findingId = toSafeString((await params).id);
  if (!findingId) return NextResponse.json({ error: "id is required" }, { status: 400 });

  if (body.action && !["resolve", "dismiss"].includes(body.action)) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const note = toSafeString(body.note);
  const feedbackRaw = toSafeString(body.signalFeedback).trim().toLowerCase();
  const allowed = new Set(["false_positive", "not_actionable", "confirmed_true"]);
  const signalFeedback = feedbackRaw && allowed.has(feedbackRaw) ? feedbackRaw : null;

  const result =
    body.action === "dismiss"
      ? await dismissFinding(ctx.admin, ctx.orgId, ctx.userId, findingId, note || undefined, signalFeedback)
      : await resolveFinding(ctx.admin, ctx.orgId, ctx.userId, findingId, note || undefined, signalFeedback);
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
  if (!result.data) return NextResponse.json({ error: "Finding not found" }, { status: 404 });
  if (signalFeedback === "false_positive") {
    await incrementV6QualityCounter(ctx.admin, ctx.orgId, "findings_labeled_false_positive_total", 1).catch(
      () => undefined
    );
  }
  return NextResponse.json({ finding: result.data });
}
