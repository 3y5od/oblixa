import { NextResponse } from "next/server";
import { jsonProblem, jsonUnauthorized } from "@/lib/http/problem";
import { getApiAuthContext } from "@/lib/contract-operations/api-auth";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { parseFixedEnumParam } from "@/lib/security/validation";

const ROUTE = "/api/exceptions";
const EXCEPTION_STATUSES = ["", "open", "in_review", "resolved", "dismissed"] as const;
const EXCEPTION_SEVERITIES = ["", "low", "medium", "high", "critical"] as const;

export async function GET(request: Request) {
  const ctx = await getApiAuthContext();
  if (!ctx) return jsonUnauthorized(ROUTE);
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/exceptions",
  });
  if (modeGate) return modeGate;

  const url = new URL(request.url);
  const status = parseFixedEnumParam(url.searchParams.get("status"), EXCEPTION_STATUSES, "");
  const severity = parseFixedEnumParam(url.searchParams.get("severity"), EXCEPTION_SEVERITIES, "");

  let query = ctx.admin
    .from("exceptions")
    .select(
      "id, contract_id, exception_type, title, severity, status, owner_id, due_date, root_cause, updated_at"
    )
    .eq("organization_id", ctx.orgId)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (status) query = query.eq("status", status);
  if (severity) query = query.eq("severity", severity);

  const { data, error } = await query;
  if (error) {
    return jsonProblem(400, {
      error: error.message,
      code: "exceptions_list_failed",
      diagnostic_id: "exceptions_list_failed",
      route: ROUTE,
    });
  }
  return NextResponse.json({ exceptions: data ?? [] });
}
