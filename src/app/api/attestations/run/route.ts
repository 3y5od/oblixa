import { NextResponse } from "next/server";
import { jsonForbidden, jsonUnauthorized } from "@/lib/http/problem";
import { getApiAuthContext, canManageCapability } from "@/lib/contract-operations/api-auth";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";

const ROUTE = "/api/attestations/run";

export async function GET() {
  const ctx = await getApiAuthContext();
  if (!ctx) return jsonUnauthorized(ROUTE);
  if (!(await canManageCapability(ctx, "maintenance_manage"))) {
    return jsonForbidden(ROUTE);
  }
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/attestations/run",
  });
  if (modeGate) return modeGate;

  const today = new Date().toISOString();
  const { data: dueRequests } = await ctx.admin
    .from("attestation_requests")
    .select("id")
    .eq("organization_id", ctx.orgId)
    .in("status", ["open", "overdue"])
    .lte("due_at", today)
    .limit(200);

  if (!dueRequests?.length) return NextResponse.json({ issued: 0 });

  const ids = dueRequests.map((r) => r.id);
  await ctx.admin
    .from("attestation_requests")
    .update({ status: "overdue", last_reminded_at: today })
    .in("id", ids)
    .eq("organization_id", ctx.orgId);

  await ctx.admin.from("audit_events").insert({
    organization_id: ctx.orgId,
    user_id: ctx.userId,
    action: "attestations.run",
    details: { overdue_count: ids.length },
  });

  return NextResponse.json({ issued: ids.length, requestIds: ids });
}
