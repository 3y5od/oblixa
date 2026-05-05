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
import {
  buildV10MutationResponse,
  buildV10MutationResponseInit,
  validateV10IdempotencyKey,
  type V10MutationResponse,
} from "@/lib/v10-mutation-envelope";
import { executeV10IdempotentMutation, getV10ExpectedVersionFromRequest, getV10IdempotencyKeyFromRequest, recordV10AuditEvent } from "@/lib/v10-server-contracts";
import { refreshV10ReadModelsForOrganization } from "@/lib/v10-read-model-refresh";
import { applyV10ReadModelVisibility } from "@/lib/v10-visibility";
import { isV10JobRetryable, normalizeV10JobStatus } from "@/lib/v10-job-visibility";

const PRIVATE_NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };
const IMPORT_JOB_ROWS_LIMIT = 300;

type ImportRetryMutationResponse = V10MutationResponse & {
  success?: boolean;
  retriedJobId?: string;
  jobId?: string;
  created?: number;
  errors?: number;
  durationMs?: number;
};

function statusForV10ImportRetryOutcome(outcome: V10MutationResponse["outcome"]): number {
  switch (outcome) {
    case "not_found":
      return 404;
    case "conflict":
    case "job_not_retryable":
      return 409;
    case "validation_failed":
      return 400;
    case "audit_write_failed":
    case "server_error":
      return 500;
    default:
      return 400;
  }
}

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
    apiPath: "/api/import/contracts/[jobId]",
    v10MutationResponse: false,
  });
  if (modeGate) return modeGate;

  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`import-contracts-job:${user.id}:${ip}`, RATE_LIMITS.importContractsJob);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { ...PRIVATE_NO_STORE_HEADERS, "Retry-After": String(Math.max(1, Math.ceil(rl.retryAfterMs / 1000))) },
      }
    );
  }

  const [{ data: job, error: jobError }, { data: rows, error: rowsError }, { data: v10Visibility }] = await Promise.all([
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
      .limit(IMPORT_JOB_ROWS_LIMIT),
    applyV10ReadModelVisibility(
      admin
        .from("v10_job_run_visibility")
        .select("job_id, job_class, status, failure_category, diagnostic_id, user_visible_detail, retry_action, completed_count, failed_count, retryable_count, started_at, completed_at, updated_at"),
      { organizationId: membership.organization_id, role: membership.role, includeWorkspaceMode: false }
    )
      .eq("job_id", jobId)
      .maybeSingle(),
  ]);
  if (jobError) {
    return NextResponse.json(
      { error: "Could not load import job", diagnostic_id: "v10_import_job_load_failed" },
      { status: 500, headers: PRIVATE_NO_STORE_HEADERS }
    );
  }
  if (rowsError) {
    return NextResponse.json(
      { error: "Could not load import job rows", diagnostic_id: "v10_import_job_rows_load_failed" },
      { status: 500, headers: PRIVATE_NO_STORE_HEADERS }
    );
  }
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404, headers: PRIVATE_NO_STORE_HEADERS });

  const visibleRows = rows ?? [];
  const totalRows = typeof job.total_rows === "number" ? job.total_rows : visibleRows.length;
  const rowsTruncated = typeof job.total_rows === "number"
    ? job.total_rows > visibleRows.length
    : visibleRows.length >= IMPORT_JOB_ROWS_LIMIT;

  const visible = {
    headline: getImportJobHeadline(job),
    detail: getImportJobDetail(job),
    tone: getImportJobTone(job),
    canRetry: importJobCanRetry(job),
    diagnosticId: v10Visibility?.diagnostic_id ?? null,
    retryAction: v10Visibility?.retry_action ?? null,
  };

  return NextResponse.json(
    {
      job,
      visible,
      v10_job_visibility: v10Visibility ?? null,
      rows: visibleRows,
      rows_total: totalRows,
      rows_returned: visibleRows.length,
      rows_limit: IMPORT_JOB_ROWS_LIMIT,
      rows_truncated: rowsTruncated,
      rows_complete: !rowsTruncated,
      rows_next_offset: rowsTruncated ? visibleRows.length : null,
    },
    { headers: PRIVATE_NO_STORE_HEADERS }
  );
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
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401, headers: PRIVATE_NO_STORE_HEADERS });

  const membership = await getDeterministicMembership(admin, user.id);
  if (!membership) return NextResponse.json({ error: "No organization" }, { status: 400, headers: PRIVATE_NO_STORE_HEADERS });
  const modeGate = await requireApiWorkspaceEligibility({
    admin,
    orgId: membership.organization_id,
    role: membership.role,
    apiPath: "/api/import/contracts/[jobId]",
    v10MutationResponse: true,
  });
  if (modeGate) return modeGate;

  const idempotencyKey = getV10IdempotencyKeyFromRequest(request);
  if (!idempotencyKey || !validateV10IdempotencyKey(idempotencyKey)) {
    return NextResponse.json(
      { error: "A valid x-idempotency-key header is required for this V10 import retry.", diagnostic_id: "v10_import_retry_idempotency_key_invalid" },
      { status: 400, headers: PRIVATE_NO_STORE_HEADERS }
    );
  }

  const { response: retryMutation, replayed } = await executeV10IdempotentMutation<ImportRetryMutationResponse>(
    admin,
    {
      organizationId: membership.organization_id,
      actorUserId: user.id,
      mutationName: "retry_failed_job",
      targetType: "import_job",
      targetId: jobId,
      idempotencyKey,
      expectedVersion: getV10ExpectedVersionFromRequest(request),
      currentVersion: jobId,
      payload: { prior_job_id: jobId },
    },
    async () => {
      const retryInfo = await loadRetryableImportRows(admin, membership.organization_id, jobId);
      const normalizedStatus = normalizeV10JobStatus(String(retryInfo.status ?? ""), {
        failed: retryInfo.rows.length,
        retryable: retryInfo.rows.length,
      });
      if (retryInfo.status == null) {
        return buildV10MutationResponse({
          outcome: "not_found",
          message: "Job not found",
          changedObjectType: "import_job",
          changedObjectId: jobId,
          diagnosticId: "v10_import_retry_job_not_found",
        });
      }
      if (retryInfo.supersededByJobId) {
        return buildV10MutationResponse({
          outcome: "conflict",
          message: "A newer retry already replaced this import attempt.",
          changedObjectType: "import_job",
          changedObjectId: jobId,
          nextDestinationHref: `/api/import/contracts/${retryInfo.supersededByJobId}`,
          diagnosticId: "v10_import_retry_superseded",
        });
      }
      if (!isV10JobRetryable(normalizedStatus, retryInfo.rows.length)) {
        return buildV10MutationResponse({
          outcome: "job_not_retryable",
          message: "Only failed_retryable or partial import jobs with retryable rows can be retried.",
          changedObjectType: "import_job",
          changedObjectId: jobId,
          nextDestinationHref: `/api/import/contracts/${jobId}`,
          diagnosticId: "v10_import_retry_status_not_retryable",
        });
      }
      if (retryInfo.rows.length === 0) {
        return buildV10MutationResponse({
          outcome: "job_not_retryable",
          message: "No retryable rows remain for this import job.",
          changedObjectType: "import_job",
          changedObjectId: jobId,
          diagnosticId: "v10_import_retry_no_retryable_rows",
        });
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
        return buildV10MutationResponse({
          outcome: "validation_failed",
          message: result.error ?? "Could not create retry job",
          changedObjectType: "import_job",
          changedObjectId: null,
          diagnosticId: "v10_import_retry_job_missing",
        });
      }

      if (!result.success) {
        return buildV10MutationResponse({
          outcome: "server_error",
          message: result.error ?? "Retry failed",
          changedObjectType: "import_job",
          changedObjectId: result.jobId,
          nextDestinationHref: `/api/import/contracts/${result.jobId}`,
          diagnosticId: "v10_import_retry_failed",
        });
      }

      const auditEventId = await recordV10AuditEvent(admin, {
        organizationId: membership.organization_id,
        actorUserId: user.id,
        action: "import_job.retry_created",
        targetType: "import_job",
        targetId: result.jobId,
        outcome: "success",
        safeMetadata: { prior_job_id: jobId, row_count: retryInfo.rows.length },
      });
      await emitProductTelemetryEvent(admin, {
        organizationId: membership.organization_id,
        userId: user.id,
        action: "product.v10.failed_job_retry_succeeded",
        details: {
          job_class: "import_job",
          retry_status: "created",
          row_count: retryInfo.rows.length,
          errors: result.errors,
        },
      });
      await refreshV10ReadModelsForOrganization(admin, membership.organization_id, {
        refreshScope: "one_model",
        reason: "contract_import_retry_mutation",
        modelKeys: ["activation_state", "work_items", "job_run_visibility", "contract_activity_events", "audit_events", "command_search_index"],
      });

      return {
        ...buildV10MutationResponse({
          outcome: auditEventId ? "success" : "audit_write_failed",
          message: auditEventId ? "Import retry job created." : "Import retry job created, but audit confirmation is missing.",
          changedObjectType: "import_job",
          changedObjectId: result.jobId,
          newVersion: result.created,
          nextDestinationHref: `/api/import/contracts/${result.jobId}`,
          auditEventId,
          diagnosticId: auditEventId ? null : "v10_import_retry_audit_missing",
        }),
        success: true,
        retriedJobId: jobId,
        jobId: result.jobId,
        created: result.created,
        errors: result.errors,
        durationMs: result.durationMs,
      };
    }
  );

  if (retryMutation.outcome !== "success") {
    return NextResponse.json(
      { error: retryMutation.user_visible_message, replayed, v10: retryMutation },
      {
        ...buildV10MutationResponseInit(retryMutation, { replayed, headers: PRIVATE_NO_STORE_HEADERS }),
        status: statusForV10ImportRetryOutcome(retryMutation.outcome),
      }
    );
  }

  return NextResponse.json(
    {
      success: retryMutation.success ?? true,
      retriedJobId: retryMutation.retriedJobId ?? jobId,
      jobId: retryMutation.jobId ?? retryMutation.changed_object_id,
      created: retryMutation.created ?? (typeof retryMutation.new_version === "number" ? retryMutation.new_version : null),
      errors: retryMutation.errors ?? 0,
      durationMs: retryMutation.durationMs ?? null,
      replayed,
      v10: retryMutation,
    },
    buildV10MutationResponseInit(retryMutation, { replayed, headers: PRIVATE_NO_STORE_HEADERS })
  );
}
