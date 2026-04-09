import { NextResponse } from "next/server";
import { getApiAuthContext, canManageCapability } from "@/lib/v4/api-auth";
import { recordAutomationEvent } from "@/lib/v4/automation-audit";
import { upsertDetectedExceptions } from "@/lib/v4/exceptions";

export async function POST() {
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await canManageCapability(ctx, "maintenance_manage"))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const now = new Date().toISOString();

  const [overdueTasksRes, overdueObligationsRes, missingOwnerRes] = await Promise.all([
    ctx.admin
      .from("contract_tasks")
      .select("id, contract_id, title")
      .eq("organization_id", ctx.orgId)
      .in("status", ["open", "in_progress", "blocked"])
      .lt("due_date", now.slice(0, 10))
      .limit(200),
    ctx.admin
      .from("contract_obligations")
      .select("id, contract_id, title")
      .eq("organization_id", ctx.orgId)
      .in("status", ["open", "in_progress"])
      .lt("due_date", now.slice(0, 10))
      .limit(200),
    ctx.admin
      .from("contracts")
      .select("id, title")
      .eq("organization_id", ctx.orgId)
      .is("owner_id", null)
      .limit(200),
  ]);

  const inserts = [
    ...(overdueTasksRes.data ?? []).map((row) => ({
      organizationId: ctx.orgId,
      contractId: row.contract_id,
      linkedEntityType: "task",
      linkedEntityId: row.id,
      exceptionType: "overdue_task",
      title: `Overdue task: ${row.title}`,
      severity: "high" as const,
    })),
    ...(overdueObligationsRes.data ?? []).map((row) => ({
      organizationId: ctx.orgId,
      contractId: row.contract_id,
      linkedEntityType: "obligation",
      linkedEntityId: row.id,
      exceptionType: "overdue_obligation",
      title: `Overdue obligation: ${row.title}`,
      severity: "high" as const,
    })),
    ...(missingOwnerRes.data ?? []).map((row) => ({
      organizationId: ctx.orgId,
      contractId: row.id,
      linkedEntityType: "contract",
      linkedEntityId: row.id,
      exceptionType: "missing_owner",
      title: `Contract missing owner: ${row.title}`,
      severity: "medium" as const,
    })),
  ];

  if (inserts.length === 0) return NextResponse.json({ detected: 0 });
  const result = await upsertDetectedExceptions({
    admin: ctx.admin,
    detector: "manual_run_detection",
    rows: inserts,
  });

  await recordAutomationEvent({
    admin: ctx.admin,
    organizationId: ctx.orgId,
    action: "exceptions_detect",
    details: { detector: "manual", touched: result.touched },
  });

  return NextResponse.json({ detected: result.touched });
}
