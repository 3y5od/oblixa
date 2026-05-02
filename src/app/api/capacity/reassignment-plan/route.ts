import { NextResponse } from "next/server";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { canManageCapability, getApiAuthContext } from "@/lib/v4/api-auth";
import { readJsonBody, toSafeString } from "@/lib/v5/api";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";

export async function POST(request: Request) {
  const disabled = requireV5ApiFeature("v5SimulationAndIntelligence");
  if (disabled) return disabled;
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/capacity/reassignment-plan",
  });
  if (modeGate) return modeGate;
  if (!(await canManageCapability(ctx, "renewals_manage"))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const _limitedBody = await readJsonBodyLimited(request);
  if (!_limitedBody.ok) return _limitedBody.response;
  const raw = _limitedBody.body ?? {};
  const body = readJsonBody<{
    teamKey?: string;
    currentLoad?: number;
    targetLoad?: number;
    notes?: string;
  }>(raw, {});
  const teamKey = toSafeString(body.teamKey);
  const currentLoad = Number(body.currentLoad ?? 0);
  const targetLoad = Number(body.targetLoad ?? 0);
  if (!teamKey) return NextResponse.json({ error: "teamKey is required" }, { status: 400 });
  if (!Number.isFinite(currentLoad) || !Number.isFinite(targetLoad)) {
    return NextResponse.json({ error: "currentLoad and targetLoad must be numbers" }, { status: 400 });
  }
  const overload = Math.max(0, Math.round(currentLoad - targetLoad));
  const suggestedMoves = overload > 0 ? overload : 0;

  await ctx.admin.from("audit_events").insert({
    organization_id: ctx.orgId,
    user_id: ctx.userId,
    action: "v5.capacity.reassignment_plan.generated",
    details: {
      team_key: teamKey,
      current_load: currentLoad,
      target_load: targetLoad,
      suggested_moves: suggestedMoves,
      notes: toSafeString(body.notes) || null,
    },
  });

  return NextResponse.json({
    plan: {
      team_key: teamKey,
      overload,
      suggested_moves: suggestedMoves,
      guidance:
        overload > 0
          ? "Reassign this many approval/task owners to reach target load."
          : "Current load is within target. No reassignment required.",
    },
  });
}
