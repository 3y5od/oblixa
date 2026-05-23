import { NextResponse } from "next/server";
import { jsonProblem } from "@/lib/http/problem";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { listFindings } from "@/lib/v6/assurance";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { parseFixedEnumParam, validateBoundedString } from "@/lib/security/validation";

const SEVERITIES = ["", "low", "medium", "high", "critical"] as const;
const STATUSES = ["", "open", "in_review", "resolved", "dismissed"] as const;
const ROUTE = "/api/assurance/findings";

export async function GET(request: Request) {
  const disabled = requireV6ApiFeature("v6AssuranceCore");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context();
  if (!ctx) return errorResponse!;
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/assurance/findings",
  });
  if (modeGate) return modeGate;

  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_get_assurance_findings_total", 1).catch(
    () => undefined
  );

  const url = new URL(request.url);
  const sev = parseFixedEnumParam(url.searchParams.get("severity"), SEVERITIES, "");
  const st = parseFixedEnumParam(url.searchParams.get("status"), STATUSES, "");
  const rawFindingType = validateBoundedString(url.searchParams.get("findingType") ?? "", { maxLength: 80, allowEmpty: true });
  const ft = rawFindingType.ok ? rawFindingType.value : "";
  const filters = {
    ...(sev ? { severity: sev } : {}),
    ...(st ? { status: st } : {}),
    ...(ft ? { finding_type: ft } : {}),
  };
  const { data, error } = await listFindings(ctx.admin, ctx.orgId, filters);
  if (error) {
    return jsonProblem(400, {
      error: error.message,
      code: "assurance_findings_list_failed",
      diagnostic_id: "assurance_findings_list_failed",
      route: ROUTE,
    });
  }
  return NextResponse.json({ findings: data ?? [] });
}
