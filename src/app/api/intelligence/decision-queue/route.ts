import { NextResponse } from "next/server";
import { jsonProblem, jsonUnauthorized } from "@/lib/http/problem";
import { getApiAuthContext } from "@/lib/v4/api-auth";
import { decisionQueueSlaFields } from "@/lib/v5/decision-queue-sla";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";

const ROUTE = "/api/intelligence/decision-queue";

export async function GET() {
  const disabled = requireV5ApiFeature("v5DecisionFoundation");
  if (disabled) return disabled;
  const ctx = await getApiAuthContext();
  if (!ctx) return jsonUnauthorized(ROUTE);
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/intelligence/decision-queue",
  });
  if (modeGate) return modeGate;

  const { data, error } = await ctx.admin
    .from("decision_workspaces")
    .select("id, title, decision_type, status, due_at, owner_user_id, linked_contract_ids, updated_at")
    .eq("organization_id", ctx.orgId)
    .in("status", ["open", "in_review"])
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(200);
  if (error) {
    return jsonProblem(400, {
      error: error.message,
      code: "decision_queue_load_failed",
      diagnostic_id: "decision_queue_load_failed",
      route: ROUTE,
    });
  }
  const rows = data ?? [];
  const queue = rows.map((row) => {
    const sla = decisionQueueSlaFields(row.due_at);
    return {
      ...row,
      sla_status: sla.sla_status,
      days_until_due: sla.days_until_due,
      priority: sla.priority,
    };
  });
  return NextResponse.json({ queue });
}

