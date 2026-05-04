import { after, NextResponse } from "next/server";
import {
  RATE_LIMITS,
  getClientIpFromRequest,
  rateLimitCheck,
} from "@/lib/rate-limit";
import { getV6OrgSettingsJson } from "@/lib/v6/org-settings";
import { createAdminClient, createClient, getDeterministicMembership } from "@/lib/supabase/server";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { getExportJobDetail, getExportJobHeadline, getExportJobTone } from "@/lib/export-job-visibility";
import { emitProductTelemetryEvent } from "@/lib/product-telemetry";
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
import { refreshV10ReadModelsForOrganization } from "@/lib/v10-read-model-refresh";
import { getExportCsvExtractedFieldNamesForWorkspaceMode } from "@/lib/export-contract-csv-field-policy";
import { getV10ContractExportRowLimit, resolveV10ReportExportPlan } from "@/lib/v10-report-export";
import { normalizeV10JobStatus, isV10JobRetryable } from "@/lib/v10-job-visibility";
import { statusForV10JobRetryOutcome } from "@/lib/v10-job-retry";
import { applyV10ReadModelVisibility } from "@/lib/v10-visibility";
import { createContractExportJob, executeContractExportCsv } from "../route";

const PRIVATE_NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

type ExportRetryMutationResponse = V10MutationResponse & {
  success?: boolean;
  retriedJobId?: string;
  jobId?: string;
  async?: boolean;
};

function normalizeRetryFilterJson(filterJson: unknown): Record<string, unknown> {
  if (!filterJson || typeof filterJson !== "object" || Array.isArray(filterJson)) return {};
  const rest = { ...(filterJson as Record<string, unknown>) };
  delete rest.contract_ids;
  delete rest.export_plan;
  delete rest.row_limit;
  delete rest.async_handoff;
  return rest;
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
    apiPath: "/api/export/contracts/[jobId]",
    v10MutationResponse: true,
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

  const idempotencyKey = getV10IdempotencyKeyFromRequest(request);
  if (!idempotencyKey || !validateV10IdempotencyKey(idempotencyKey)) {
    return NextResponse.json(
      { error: "A valid x-idempotency-key header is required for this V10 export retry.", diagnostic_id: "v10_export_retry_idempotency_key_invalid" },
      { status: 400, headers: PRIVATE_NO_STORE_HEADERS }
    );
  }

  const { response: retryMutation, replayed } = await executeV10IdempotentMutation<ExportRetryMutationResponse>(
    admin,
    {
      organizationId: membership.organization_id,
      actorUserId: user.id,
      mutationName: "retry_failed_job",
      targetType: "export_job",
      targetId: jobId,
      idempotencyKey,
      expectedVersion: getV10ExpectedVersionFromRequest(request),
      currentVersion: jobId,
      payload: { prior_job_id: jobId },
    },
    async () => {
      const { data: priorJob } = await admin
        .from("contract_export_jobs")
        .select("id, scope, status, selected_contract_count, truncated, error_message, filter_json")
        .eq("id", jobId)
        .eq("organization_id", membership.organization_id)
        .maybeSingle();

      if (!priorJob) {
        return buildV10MutationResponse({
          outcome: "not_found",
          message: "Job not found",
          changedObjectType: "export_job",
          changedObjectId: jobId,
          diagnosticId: "v10_export_retry_job_not_found",
        });
      }

      const exportStatus = normalizeV10JobStatus(String(priorJob.status ?? ""), {
        failed: priorJob.truncated === true ? 1 : 0,
        retryable: priorJob.truncated === true ? 1 : 0,
      });
      if (!isV10JobRetryable(exportStatus, exportStatus === "succeeded" ? 0 : 1)) {
        return buildV10MutationResponse({
          outcome: "job_not_retryable",
          message: "Only truncated or partial exports with a visible retry path can be retried.",
          changedObjectType: "export_job",
          changedObjectId: jobId,
          nextDestinationHref: `/api/export/contracts/${jobId}`,
          diagnosticId: "v10_export_retry_status_not_retryable",
        });
      }

      const filterJson = (priorJob.filter_json as Record<string, unknown> | null) ?? {};
      const selectedIds = Array.isArray(filterJson.contract_ids) ? filterJson.contract_ids.map(String) : [];
      const filterJsonExtension = normalizeRetryFilterJson(filterJson);
      const v6Settings = await getV6OrgSettingsJson(admin, membership.organization_id);
      const csvFieldNames = getExportCsvExtractedFieldNamesForWorkspaceMode(v6Settings.workspace_mode);
      const exportPlan = resolveV10ReportExportPlan(v6Settings);
      const exportRowLimit = getV10ContractExportRowLimit(exportPlan);
      const exportScope = selectedIds.length > 0 ? "selected" : String(priorJob.scope ?? "workspace") === "selected" ? "selected" : "workspace";

      const created = await createContractExportJob({
        admin,
        orgId: membership.organization_id,
        userId: user.id,
        exportScope,
        selectedIds,
        filterJsonExtension,
        exportPlan,
        exportRowLimit,
        initialStatus: "queued",
      });
      if (!created.jobId) {
        return buildV10MutationResponse({
          outcome: "server_error",
          message: "The export retry job could not be created.",
          changedObjectType: "export_job",
          changedObjectId: null,
          diagnosticId: "v10_export_retry_job_create_failed",
        });
      }

      const queuedJobId = created.jobId;
      const retryAuditEventId = await recordV10AuditEvent(admin, {
        organizationId: membership.organization_id,
        actorUserId: user.id,
        action: "export_job.retry_requested",
        targetType: "export_job",
        targetId: queuedJobId,
        outcome: "success",
        safeMetadata: { prior_job_id: jobId, export_scope: exportScope, selected_row_count: selectedIds.length },
      });
      await emitProductTelemetryEvent(admin, {
        organizationId: membership.organization_id,
        userId: user.id,
        action: "product.v10.failed_job_retry_succeeded",
        details: {
          job_class: "export_job",
          retry_status: "queued",
          prior_job_id: jobId,
          export_job_id: queuedJobId,
        },
      });
      await refreshV10ReadModelsForOrganization(admin, membership.organization_id, {
        refreshScope: "one_model",
        reason: "contract_export_retry_queued",
        modelKeys: ["job_run_visibility", "work_items", "contract_activity_events", "audit_events", "command_search_index"],
      });

      after(async () => {
        const backgroundAdmin = await createAdminClient();
        try {
          await executeContractExportCsv({
            admin: backgroundAdmin,
            userId: user.id,
            orgId: membership.organization_id,
            selectedIds,
            exportScope,
            filterJsonExtension,
            existingExportJobId: queuedJobId,
            csvFieldNames,
            exportPlan,
            exportRowLimit,
          });
        } catch (error) {
          console.error("[export-retry] async handoff failed:", error);
          await backgroundAdmin
            .from("contract_export_jobs")
            .update({
              status: "failed",
              selected_contract_count: Number(priorJob.selected_contract_count ?? selectedIds.length),
              exported_rows: 0,
              error_message: "Export retry failed unexpectedly.",
              completed_at: new Date().toISOString(),
            })
            .eq("id", queuedJobId);
          await recordV10AuditEvent(backgroundAdmin, {
            organizationId: membership.organization_id,
            actorUserId: user.id,
            action: "export_job.completed",
            targetType: "export_job",
            targetId: queuedJobId,
            outcome: "server_error",
            diagnosticId: "v10_export_retry_async_failed",
            safeMetadata: { prior_job_id: jobId, export_scope: exportScope },
          });
          await refreshV10ReadModelsForOrganization(backgroundAdmin, membership.organization_id, {
            refreshScope: "one_model",
            reason: "contract_export_retry_async_failed",
            modelKeys: ["job_run_visibility", "work_items", "contract_activity_events", "audit_events", "command_search_index"],
          });
        }
      });

      return {
        ...buildV10MutationResponse({
          outcome: retryAuditEventId ? "success" : "audit_write_failed",
          message: "Export retry queued.",
          changedObjectType: "export_job",
          changedObjectId: queuedJobId,
          newVersion: queuedJobId,
          nextDestinationHref: `/api/export/contracts/${queuedJobId}`,
          auditEventId: retryAuditEventId ?? created.auditEventId,
          diagnosticId: retryAuditEventId ? null : "v10_export_retry_audit_missing",
        }),
        success: true,
        retriedJobId: jobId,
        jobId: queuedJobId,
        async: true,
      };
    }
  );

  if (retryMutation.outcome !== "success") {
    return NextResponse.json(
      { error: retryMutation.user_visible_message, replayed, v10: retryMutation },
      {
        ...buildV10MutationResponseInit(retryMutation, { replayed, headers: PRIVATE_NO_STORE_HEADERS }),
        status: statusForV10JobRetryOutcome(retryMutation.outcome),
      }
    );
  }

  return NextResponse.json(
    {
      success: retryMutation.success ?? true,
      retriedJobId: retryMutation.retriedJobId ?? jobId,
      jobId: retryMutation.jobId ?? retryMutation.changed_object_id,
      async: retryMutation.async ?? true,
      replayed,
      v10: retryMutation,
    },
    buildV10MutationResponseInit(retryMutation, { replayed, headers: PRIVATE_NO_STORE_HEADERS })
  );
}
