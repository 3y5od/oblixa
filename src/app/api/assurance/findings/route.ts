import { NextResponse } from "next/server";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { listFindings } from "@/lib/v6/assurance";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";

const SEVERITIES = new Set(["low", "medium", "high", "critical"]);
const STATUSES = new Set(["open", "in_review", "resolved", "dismissed"]);

export async function GET(request: Request) {
  const disabled = requireV6ApiFeature("v6AssuranceCore");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context();
  if (!ctx) return errorResponse!;

  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_get_assurance_findings_total", 1).catch(
    () => undefined
  );

  const url = new URL(request.url);
  const sev = url.searchParams.get("severity") ?? "";
  const st = url.searchParams.get("status") ?? "";
  const ft = url.searchParams.get("findingType") ?? "";
  const filters = {
    ...(SEVERITIES.has(sev) ? { severity: sev } : {}),
    ...(STATUSES.has(st) ? { status: st } : {}),
    ...(ft.trim() ? { finding_type: ft.trim() } : {}),
  };
  const { data, error } = await listFindings(ctx.admin, ctx.orgId, filters);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ findings: data ?? [] });
}
