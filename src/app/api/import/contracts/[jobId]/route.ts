import { NextResponse } from "next/server";
import {
  RATE_LIMITS,
  getClientIpFromRequest,
  rateLimitCheck,
} from "@/lib/rate-limit";
import { createAdminClient, createClient, getDeterministicMembership } from "@/lib/supabase/server";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { importJobCanRetry, getImportJobDetail, getImportJobHeadline, getImportJobTone } from "@/lib/import-job-visibility";
import { loadRetryableImportRows, runContractCsvImport } from "@/lib/import-jobs";
import { emitProductTelemetryEvent } from "@/lib/product-telemetry";

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
    apiPath: "/api/import/contracts/[jobId]",
  });
  if (modeGate) return modeGate;

  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`import-contracts-job:${user.id}:${ip}`, RATE_LIMITS.importContractsJob);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.max(1, Math.ceil(rl.retryAfterMs / 1000))) },
      }
    );
  }

  const [{ data: job }, { data: rows }] = await Promise.all([
    admin
      .from("contract_import_jobs")
      .select(
        "id, status, source, total_rows, valid_rows, inserted_rows, error_rows, failure_reason, retry_of_job_id, superseded_by_job_id, created_at, updated_at, completed_at"
      )
      .eq("id", jobId)
      .eq("organization_id", membership.organization_id)
      .maybeSingle(),
    admin
      .from("contract_import_job_rows")
      .select("id, row_index, title, owner_email, status, error_message, contract_id")
      .eq("job_id", jobId)
      .eq("organization_id", membership.organization_id)
      .order("row_index", { ascending: true })
      .limit(300),
  ]);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const visible = {
    headline: getImportJobHeadline(job),
    detail: getImportJobDetail(job),
    tone: getImportJobTone(job),
    canRetry: importJobCanRetry(job),
  };

  return NextResponse.json({
    job,
    visible,
    rows: rows ?? [],
  });
}

export async function POST(
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
    apiPath: "/api/import/contracts/[jobId]",
  });
  if (modeGate) return modeGate;

  const retryInfo = await loadRetryableImportRows(admin, membership.organization_id, jobId);
  if (retryInfo.status == null) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  if (retryInfo.supersededByJobId) {
    return NextResponse.json(
      { error: "A newer retry already replaced this import attempt." },
      { status: 409 }
    );
  }
  if (retryInfo.rows.length === 0) {
    return NextResponse.json(
      { error: "No retryable rows remain for this import job." },
      { status: 400 }
    );
  }

  await emitProductTelemetryEvent(admin, {
    organizationId: membership.organization_id,
    userId: user.id,
    action: "product.v9.import_retry_started",
    details: { priorJobId: jobId, rowCount: retryInfo.rows.length },
  });

  const result = await runContractCsvImport({
    admin,
    membership,
    userId: user.id,
    rows: retryInfo.rows,
    source: "retry",
    retryOfJobId: jobId,
  });

  if (!result.jobId) {
    return NextResponse.json(
      { error: result.error ?? "Could not create retry job" },
      { status: 400 }
    );
  }

  if (!result.success) {
    return NextResponse.json(
      { error: result.error ?? "Retry failed", jobId: result.jobId },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    retriedJobId: jobId,
    jobId: result.jobId,
    created: result.created,
    errors: result.errors,
    durationMs: result.durationMs,
  });
}
