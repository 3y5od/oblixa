import { NextResponse } from "next/server";
import { getAppBaseUrlFromEnv } from "@/lib/app-url";
import { jsonProblem, jsonRateLimited, jsonUnauthorized, PRIVATE_NO_STORE_HEADERS } from "@/lib/http/problem";
import { emitProductTelemetryEvent } from "@/lib/product-telemetry";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { RATE_LIMITS, rateLimitCheck } from "@/lib/rate-limit";
import { createAdminClient, createClient, getDeterministicMembership } from "@/lib/supabase/server";
import { statusForV10JobRetryOutcome } from "@/lib/v10-job-retry";
import { isV10JobRetryable, normalizeV10JobStatus } from "@/lib/v10-job-visibility";
import {
  buildV10MutationResponse,
  buildV10MutationResponseInit,
  validateV10IdempotencyKey,
  type V10MutationResponse,
} from "@/lib/v10-mutation-envelope";
import {
  executeV10IdempotentMutation,
  getV10ExpectedVersionFromRequest,
  getV10IdempotencyKeyFromRequest,
  recordV10AuditEvent,
} from "@/lib/v10-server-contracts";
import { runSingleReportPackGeneration } from "@/app/api/cron/v4/report-packs-generate/route";
import { rejectUnexpectedBody } from "@/lib/security/read-json-body-limited";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";

type ReportRetryMutationResponse = V10MutationResponse & {
  success?: boolean;
  retriedJobId?: string;
  reportPackId?: string | null;
  reportPackRunId?: string | null;
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const routeParamRejection = rejectUnsafeRouteParams({ runId }, ["runId"], "/api/report-runs/[runId]/retry");
  if (routeParamRejection) return routeParamRejection;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonUnauthorized("/api/report-runs/[runId]/retry");

  const rl = await rateLimitCheck(
    `report-run-retry:${user.id}`,
    RATE_LIMITS.reportRunRetryMutation
  );
  if (!rl.ok) {
    return jsonRateLimited(rl.retryAfterMs, "/api/report-runs/[runId]/retry");
  }

  const admin = await createAdminClient();

  const membership = await getDeterministicMembership(admin, user.id);
  if (!membership) {
    return jsonProblem(
      400,
      {
        error: "No organization",
        code: "organization_missing",
        diagnostic_id: "report_run_retry_organization_missing",
        route: "/api/report-runs/[runId]/retry",
      },
      { headers: PRIVATE_NO_STORE_HEADERS }
    );
  }
  const modeGate = await requireApiWorkspaceEligibility({
    admin,
    orgId: membership.organization_id,
    role: membership.role,
    apiPath: "/api/report-runs/[runId]/retry",
    v10MutationResponse: true,
  });
  if (modeGate) return modeGate;

  const unexpectedBody = await rejectUnexpectedBody(request);
  if (unexpectedBody) return unexpectedBody;

  const idempotencyKey = getV10IdempotencyKeyFromRequest(request);
  if (!idempotencyKey || !validateV10IdempotencyKey(idempotencyKey)) {
    return jsonProblem(
      400,
      {
        error: "A valid x-idempotency-key header is required for this V10 report retry.",
        code: "idempotency_key_invalid",
        diagnostic_id: "v10_report_retry_idempotency_key_invalid",
        route: "/api/report-runs/[runId]/retry",
      },
      { headers: PRIVATE_NO_STORE_HEADERS }
    );
  }

  const { response: retryMutation, replayed } = await executeV10IdempotentMutation<ReportRetryMutationResponse>(
    admin,
    {
      organizationId: membership.organization_id,
      actorUserId: user.id,
      mutationName: "retry_failed_job",
      targetType: "report_run",
      targetId: runId,
      idempotencyKey,
      expectedVersion: getV10ExpectedVersionFromRequest(request),
      currentVersion: runId,
      payload: { prior_job_id: runId },
    },
    async () => {
      const { data: priorRun } = await admin
        .from("report_runs")
        .select("id, status, report_mode, error_summary, metrics_json")
        .eq("id", runId)
        .eq("organization_id", membership.organization_id)
        .maybeSingle();

      if (!priorRun) {
        return buildV10MutationResponse({
          outcome: "not_found",
          message: "Report run not found.",
          changedObjectType: "report_run",
          changedObjectId: runId,
          diagnosticId: "v10_report_retry_not_found",
        });
      }

      const metrics = asObject(priorRun.metrics_json);
      const reportPackId = asString(metrics.report_pack_id);
      if (!reportPackId) {
        return buildV10MutationResponse({
          outcome: "job_not_retryable",
          message: "Only report-pack backed report runs can be retried directly.",
          changedObjectType: "report_run",
          changedObjectId: runId,
          nextDestinationHref: "/reports",
          diagnosticId: "v10_report_retry_missing_report_pack",
        });
      }

      const reportFailureCount = asString(priorRun.error_summary) ? 1 : 0;
      const retryableCount = reportFailureCount > 0 ? 1 : 0;
      const normalizedStatus = normalizeV10JobStatus(String(priorRun.status ?? ""), {
        failed: reportFailureCount,
        retryable: retryableCount,
      });
      if (!isV10JobRetryable(normalizedStatus, retryableCount)) {
        return buildV10MutationResponse({
          outcome: "job_not_retryable",
          message: "Only failed retryable or partial report runs can be retried.",
          changedObjectType: "report_run",
          changedObjectId: runId,
          nextDestinationHref: "/reports",
          diagnosticId: "v10_report_retry_status_not_retryable",
        });
      }

      const { data: reportPack } = await admin
        .from("report_packs")
        .select("id, organization_id, report_type, name, delivery_json")
        .eq("id", reportPackId)
        .eq("organization_id", membership.organization_id)
        .maybeSingle();

      if (!reportPack) {
        return buildV10MutationResponse({
          outcome: "job_not_retryable",
          message: "The report pack backing this run is no longer available.",
          changedObjectType: "report_run",
          changedObjectId: runId,
          nextDestinationHref: "/reports",
          diagnosticId: "v10_report_retry_report_pack_missing",
        });
      }

      const result = await runSingleReportPackGeneration({
        admin,
        pack: {
          id: String(reportPack.id),
          organization_id: String(reportPack.organization_id),
          report_type: asString(reportPack.report_type),
          name: asString(reportPack.name),
          delivery_json: reportPack.delivery_json,
        },
        appUrl: getAppBaseUrlFromEnv(),
        now: new Date(),
        existingReportRunId: runId,
        actorUserId: user.id,
        actorType: "user",
      });

      const retryAuditEventId = await recordV10AuditEvent(admin, {
        organizationId: membership.organization_id,
        actorUserId: user.id,
        action: "report_run.retry_requested",
        targetType: "report_run",
        targetId: runId,
        outcome: result.generated ? "success" : result.failureOutcome ?? "server_error",
        diagnosticId: result.failureDiagnosticId ?? null,
        safeMetadata: {
          report_pack_id: reportPackId,
          report_type: asString(reportPack.report_type) ?? asString(priorRun.report_mode) ?? "report",
          report_pack_run_id: result.reportPackRunId,
        },
      });

      if (!result.generated) {
        return buildV10MutationResponse({
          outcome: result.failureOutcome ?? "server_error",
          message: result.failureMessage ?? "Report retry could not be completed.",
          changedObjectType: "report_run",
          changedObjectId: runId,
          nextDestinationHref: "/reports",
          auditEventId: retryAuditEventId,
          diagnosticId: result.failureDiagnosticId ?? null,
        });
      }

      await emitProductTelemetryEvent(admin, {
        organizationId: membership.organization_id,
        userId: user.id,
        action: "product.v10.failed_job_retry_succeeded",
        details: {
          job_class: "report_run",
          retry_status: "completed",
          prior_job_id: runId,
          report_pack_id: reportPackId,
          report_pack_run_id: result.reportPackRunId,
        },
      });

      return {
        ...buildV10MutationResponse({
          outcome: retryAuditEventId ? "success" : "audit_write_failed",
          message: "Report retry completed.",
          changedObjectType: "report_run",
          changedObjectId: runId,
          newVersion: runId,
          nextDestinationHref: "/reports",
          auditEventId: retryAuditEventId,
          diagnosticId: retryAuditEventId ? null : "v10_report_retry_audit_missing",
        }),
        success: true,
        retriedJobId: runId,
        reportPackId,
        reportPackRunId: result.reportPackRunId,
      };
    }
  );

  if (retryMutation.outcome !== "success") {
    return NextResponse.json(
      { message: retryMutation.user_visible_message, replayed, v10: retryMutation },
      {
        ...buildV10MutationResponseInit(retryMutation, { replayed, headers: PRIVATE_NO_STORE_HEADERS }),
        status: statusForV10JobRetryOutcome(retryMutation.outcome),
      }
    );
  }

  return NextResponse.json(
    {
      success: retryMutation.success ?? true,
      retriedJobId: retryMutation.retriedJobId ?? runId,
      reportPackId: retryMutation.reportPackId ?? null,
      reportPackRunId: retryMutation.reportPackRunId ?? null,
      replayed,
      v10: retryMutation,
    },
    buildV10MutationResponseInit(retryMutation, { replayed, headers: PRIVATE_NO_STORE_HEADERS })
  );
}