import { NextResponse } from "next/server";
import {
  RATE_LIMITS,
  getClientIpFromRequest,
  rateLimitCheck,
} from "@/lib/rate-limit";
import { createAdminClient, createClient, getDeterministicMembership } from "@/lib/supabase/server";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { getExportJobDetail, getExportJobHeadline, getExportJobTone } from "@/lib/export-job-visibility";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const membership = await getDeterministicMembership(admin, user.id);
  if (!membership) return NextResponse.json({ error: "No organization" }, { status: 400 });
  const modeGate = await requireApiWorkspaceEligibility({
    admin,
    orgId: membership.organization_id,
    role: membership.role,
    apiPath: "/api/export/contracts/[jobId]",
  });
  if (modeGate) return modeGate;

  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`export-contracts-job:${user.id}:${ip}`, RATE_LIMITS.exportContractsJob);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.max(1, Math.ceil(rl.retryAfterMs / 1000))) },
      }
    );
  }

  const { data: job } = await admin
    .from("contract_export_jobs")
    .select(
      "id, scope, status, export_format, selected_contract_count, exported_rows, truncated, error_message, filter_json, started_at, completed_at, created_at, updated_at"
    )
    .eq("id", jobId)
    .eq("organization_id", membership.organization_id)
    .maybeSingle();

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  return NextResponse.json({
    job,
    visible: {
      headline: getExportJobHeadline(job),
      detail: getExportJobDetail(job),
      tone: getExportJobTone(job),
    },
  });
}
