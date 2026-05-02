import { NextResponse } from "next/server";
import {
  RATE_LIMITS,
  getClientIpFromRequest,
  rateLimitCheck,
} from "@/lib/rate-limit";
import { createAdminClient, createClient, getDeterministicMembership } from "@/lib/supabase/server";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { getExportJobDetail, getExportJobHeadline, getExportJobTone } from "@/lib/export-job-visibility";
import { applyV10ReadModelVisibility } from "@/lib/v10-visibility";

const PRIVATE_NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

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
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401, headers: PRIVATE_NO_STORE_HEADERS });

  const membership = await getDeterministicMembership(admin, user.id);
  if (!membership) return NextResponse.json({ error: "No organization" }, { status: 400, headers: PRIVATE_NO_STORE_HEADERS });
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
        headers: { ...PRIVATE_NO_STORE_HEADERS, "Retry-After": String(Math.max(1, Math.ceil(rl.retryAfterMs / 1000))) },
      }
    );
  }

  const [{ data: job }, { data: v10Visibility }] = await Promise.all([
    admin
      .from("contract_export_jobs")
      .select(
        "id, scope, status, export_format, selected_contract_count, exported_rows, truncated, error_message, filter_json, started_at, completed_at, created_at, updated_at"
      )
      .eq("id", jobId)
      .eq("organization_id", membership.organization_id)
      .maybeSingle(),
    applyV10ReadModelVisibility(
      admin
        .from("v10_job_run_visibility")
        .select("job_id, job_class, status, failure_category, diagnostic_id, user_visible_detail, retry_action, completed_count, failed_count, retryable_count, started_at, completed_at, updated_at"),
      { organizationId: membership.organization_id, role: membership.role, includeWorkspaceMode: false }
    )
      .eq("job_id", jobId)
      .maybeSingle(),
  ]);

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404, headers: PRIVATE_NO_STORE_HEADERS });

  return NextResponse.json(
    {
      job,
      visible: {
        headline: getExportJobHeadline(job),
        detail: getExportJobDetail(job),
        tone: getExportJobTone(job),
        diagnosticId: v10Visibility?.diagnostic_id ?? null,
        retryAction: v10Visibility?.retry_action ?? null,
      },
      v10_job_visibility: v10Visibility ?? null,
    },
    { headers: PRIVATE_NO_STORE_HEADERS }
  );
}
