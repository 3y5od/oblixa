import { NextResponse } from "next/server";
import { getApiAuthContext, canManageCapability } from "@/lib/v4/api-auth";

export async function GET() {
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await canManageCapability(ctx, "maintenance_manage"))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

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
