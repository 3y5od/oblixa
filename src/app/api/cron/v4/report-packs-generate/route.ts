import { createAdminClient } from "@/lib/supabase/server";
import { withCronRoute } from "@/lib/cron/route-runner";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { recordAutomationEvent } from "@/lib/v4/automation-audit";
import { cronMatchesUtc } from "@/lib/v4/cron-schedule";
import {
  computeReportPackMetrics,
  extractPriorKpis,
} from "@/lib/v4/report-pack-metrics";
import { sendReportPackDigestEmail } from "@/lib/email";
import { getCanonicalServerBaseUrl } from "@/lib/app-url";
import { enqueueOutboundEvent } from "@/lib/integrations/events";
import { getV6OrgSettingsJson } from "@/lib/v6/org-settings";
import { recordV10AuditEvent } from "@/lib/v10-server-contracts";
import { getV10ReportFamilyForRun } from "@/lib/v10-report-export";
import { parseWorkspaceMode } from "@/lib/product-surface/context";
import { isNotificationAllowed } from "@/lib/notification-policy";
import { buildProductSurfaceContext } from "@/lib/product-surface/context";
import { evaluateFeatureEligibility } from "@/lib/product-surface/eligibility";
import { getFeatureFlags } from "@/lib/feature-flags";
import {
  REPORT_TYPE_MAP,
  minWorkspaceModeForReportType,
  workspaceModeAtLeast,
} from "@/lib/product-surface/feature-registry";
import { refreshV10ReadModelsForOrganization } from "@/lib/v10-read-model-refresh";
import {
  executeBatch,
  safeErrorMessage,
  type BatchItemError,
} from "@/lib/route-runtime-contract";

function metricsToSummaryRows(metrics: Record<string, unknown>): Array<{ label: string; value: string }> {
  const skip = new Set(["generated_at", "report_type", "dashboard_rpc_ok", "prior"]);
  const rows: Array<{ label: string; value: string }> = [];
  for (const [k, v] of Object.entries(metrics)) {
    if (skip.has(k)) continue;
    if (v !== null && typeof v === "object") continue;
    rows.push({
      label: k.replace(/_/g, " "),
      value: typeof v === "number" ? String(v) : String(v ?? ""),
    });
  }
  return rows.slice(0, 24);
}

function notificationTypeForReportPack(reportType: string): string {
  const normalized = reportType.trim().toLowerCase();
  if (normalized.includes("campaign")) return "campaign_digest";
  return "saved_view_summary";
}

function cronScheduleSlot(date: Date): string {
  return new Date(Math.floor(date.getTime() / 60_000) * 60_000).toISOString();
}

export type ReportPackGenerationResult = {
  generated: boolean;
  duplicateSkipped?: boolean;
  subscriptionEmailsSent: number;
  reportRunId: string | null;
  reportPackRunId: string | null;
  errors: BatchItemError[];
  emailErrors: BatchItemError[];
  failureOutcome?: "dependency_blocked" | "server_error";
  failureDiagnosticId?: string | null;
  failureMessage?: string | null;
};

function reportPackError(
  scope: string,
  phase: BatchItemError["phase"],
  diagnosticId: string,
  message: string
): BatchItemError {
  return { scope, phase, diagnostic_id: diagnosticId, message };
}

export async function runSingleReportPackGeneration(input: {
  admin: Awaited<ReturnType<typeof createAdminClient>>;
  pack: {
    id: string;
    organization_id: string;
    report_type: string | null;
    name: string | null;
    delivery_json?: unknown;
  };
  appUrl: string | null;
  now?: Date;
  existingReportRunId?: string | null;
  actorUserId?: string | null;
  actorType?: "system" | "user";
}): Promise<ReportPackGenerationResult> {
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const orgId = input.pack.organization_id;
  const packId = input.pack.id;
  const reportType = String(input.pack.report_type ?? "");
  const actorType = input.actorType ?? (input.actorUserId ? "user" : "system");
  const errors: BatchItemError[] = [];
  const emailErrors: BatchItemError[] = [];
  const scope = `report_pack:${packId}`;
  const pushError = (
    phase: BatchItemError["phase"],
    diagnosticId: string,
    message: string,
    target = scope
  ) => errors.push(reportPackError(target, phase, diagnosticId, message));
  const pushEmailError = (
    diagnosticId: string,
    message: string,
    target = scope
  ) => emailErrors.push(reportPackError(target, "notify", diagnosticId, message));
  const recordAudit = async (
    diagnosticId: string,
    auditInput: Parameters<typeof recordV10AuditEvent>[1]
  ) => {
    const auditId = await recordV10AuditEvent(input.admin, auditInput);
    if (!auditId) pushError("persist", diagnosticId, "V10 audit event could not be recorded");
    return auditId;
  };
  const refreshReadModels = async (reason: string) => {
    try {
      await refreshV10ReadModelsForOrganization(input.admin, orgId, {
        refreshScope: "one_model",
        reason,
        modelKeys: [
          "work_items",
          "report_run_visibility",
          "job_run_visibility",
          "contract_activity_events",
          "audit_events",
          "command_search_index",
        ],
      });
    } catch (error) {
      pushError("refresh", "v10_report_pack_refresh_failed", safeErrorMessage(error) ?? "V10 refresh failed");
    }
  };
  const v6Org = await getV6OrgSettingsJson(input.admin, orgId);
  const workspaceProductMode = parseWorkspaceMode(v6Org);
  const minModeForReport = minWorkspaceModeForReportType(reportType);
  const failQueuedRun = async (message: string, diagnosticId: string): Promise<ReportPackGenerationResult> => {
    if (!input.existingReportRunId) {
      return {
        generated: false,
        subscriptionEmailsSent: 0,
        reportRunId: null,
        reportPackRunId: null,
        errors,
        emailErrors,
        failureOutcome: "dependency_blocked",
        failureDiagnosticId: diagnosticId,
        failureMessage: message,
      };
    }
    const { error: updateError } = await input.admin
      .from("report_runs")
      .update({
        status: "failed",
        finished_at: nowIso,
        error_summary: message,
      })
      .eq("id", input.existingReportRunId);
    if (updateError) pushError("persist", "v10_report_pack_fail_queued_run_update_failed", updateError.message);
    await recordAudit(diagnosticId, {
      organizationId: orgId,
      actorUserId: input.actorUserId ?? null,
      actorType,
      action: "report_run.completed",
      targetType: "report_run",
      targetId: input.existingReportRunId,
      outcome: "dependency_blocked",
      diagnosticId,
      safeMetadata: { report_pack_id: packId, report_type: reportType },
    });
    await refreshReadModels(diagnosticId);
    return {
      generated: false,
      subscriptionEmailsSent: 0,
      reportRunId: input.existingReportRunId ?? null,
      reportPackRunId: null,
      errors,
      emailErrors,
      failureOutcome: "dependency_blocked",
      failureDiagnosticId: diagnosticId,
      failureMessage: message,
    };
  };

  if (!workspaceModeAtLeast(workspaceProductMode, minModeForReport)) {
    return failQueuedRun("Report pack is not available in the current workspace mode.", "v10_report_pack_retry_mode_required");
  }

  const normalizedRt = reportType.trim().toLowerCase();
  const reportMapEntry = REPORT_TYPE_MAP.find((row) => row.reportType === normalizedRt);
  if (reportMapEntry) {
    const surfaceCtx = buildProductSurfaceContext({
      orgId,
      role: "viewer",
      v6: v6Org,
      featureFlags: getFeatureFlags(),
    });
    if (!evaluateFeatureEligibility(surfaceCtx, reportMapEntry.featureFamily).allowed) {
      return failQueuedRun("Report pack is hidden by workspace eligibility.", "v10_report_pack_retry_hidden");
    }
  }

  const { data: prevRun, error: prevRunError } = await input.admin
    .from("report_pack_runs")
    .select("metrics_json")
    .eq("organization_id", orgId)
    .eq("report_pack_id", packId)
    .eq("status", "succeeded")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (prevRunError) pushError("source_query", "v10_report_pack_prev_run_query_failed", prevRunError.message);

  const priorSource = (prevRun?.metrics_json as Record<string, unknown> | null) ?? {};
  const prior = extractPriorKpis(priorSource);
  const baseMetrics = await computeReportPackMetrics({
    admin: input.admin,
    organizationId: orgId,
    reportType,
    workspaceProductMode,
  });
  const metricsJson = {
    ...baseMetrics,
    ...(Object.keys(prior).length > 0 ? { prior } : {}),
  };
  const summaryRows = metricsToSummaryRows(metricsJson);
  const reportFamily = getV10ReportFamilyForRun(reportType);
  const reportRunMetrics = {
    report_pack_id: packId,
    report_type: reportType,
    report_family: reportFamily,
    ...(!input.existingReportRunId && actorType === "system"
      ? {
          source: "report_pack_generation_cron",
          schedule_slot: cronScheduleSlot(now),
        }
      : {}),
  };

  let reportRunId = input.existingReportRunId ?? null;
  if (reportRunId) {
    const { error: reportRunUpdateError } = await input.admin
      .from("report_runs")
      .update({
        status: "running",
        started_at: nowIso,
        finished_at: null,
        error_summary: null,
        report_mode: reportFamily,
        triggered_by: input.actorUserId ?? null,
        metrics_json: reportRunMetrics,
      })
      .eq("id", reportRunId);
    if (reportRunUpdateError) pushError("persist", "v10_report_pack_report_run_update_failed", reportRunUpdateError.message);
  } else {
    const { data: reportRun, error: reportRunInsertError } = await input.admin
      .from("report_runs")
      .insert({
        organization_id: orgId,
        subscription_id: null,
        report_mode: reportFamily,
        status: "running",
        started_at: nowIso,
        triggered_by: input.actorUserId ?? null,
        metrics_json: reportRunMetrics,
      })
      .select("id")
      .maybeSingle();
    if (reportRunInsertError?.code === "23505") {
      return {
        generated: false,
        duplicateSkipped: true,
        subscriptionEmailsSent: 0,
        reportRunId: null,
        reportPackRunId: null,
        errors,
        emailErrors,
        failureOutcome: undefined,
        failureDiagnosticId: null,
        failureMessage: null,
      };
    }
    if (reportRunInsertError || !reportRun?.id) {
      pushError(
        "persist",
        "v10_report_pack_report_run_insert_failed",
        reportRunInsertError?.message ?? "report run insert did not return an id"
      );
    }
    reportRunId = reportRun?.id ?? null;
  }
  if (reportRunId) {
    await recordAudit("v10_report_pack_report_run_created_audit_failed", {
      organizationId: orgId,
      actorUserId: input.actorUserId ?? null,
      actorType,
      action: "report_run.created",
      targetType: "report_run",
      targetId: reportRunId,
      outcome: "success",
      safeMetadata: reportRunMetrics,
    });
  }

  const { data: runRow, error: runErr } = await input.admin
    .from("report_pack_runs")
    .insert({
      organization_id: orgId,
      report_pack_id: packId,
      status: "succeeded",
      started_at: nowIso,
      completed_at: nowIso,
      metrics_json: metricsJson,
      output_refs_json: {
        csv_url: `/api/report-packs/${packId}/runs?format=csv`,
        html_url: `/api/report-packs/${packId}/runs?format=html`,
        note: "PDF: use Print / PDF-ready HTML export",
      },
    })
    .select("id")
    .single();

  if (runErr) {
    if (reportRunId) {
      const { error: updateError } = await input.admin
        .from("report_runs")
        .update({
          status: "failed",
          finished_at: nowIso,
          error_summary: runErr.message ?? "Report pack run could not be recorded.",
          metrics_json: { ...reportRunMetrics, failure_category: "report_pack_run_recording_failed" },
        })
        .eq("id", reportRunId);
      if (updateError) pushError("persist", "v10_report_pack_failure_update_failed", updateError.message);
      await recordAudit("v10_report_pack_run_insert_failed", {
        organizationId: orgId,
        actorUserId: input.actorUserId ?? null,
        actorType,
        action: "report_run.completed",
        targetType: "report_run",
        targetId: reportRunId,
        outcome: "server_error",
        diagnosticId: "v10_report_pack_run_insert_failed",
        safeMetadata: { ...reportRunMetrics, error_message: runErr.message ?? "report_pack_run_insert_failed" },
      });
      await refreshReadModels("report_pack_generation_failed");
    }
    return {
      generated: false,
      subscriptionEmailsSent: 0,
      reportRunId,
      reportPackRunId: null,
      errors,
      emailErrors,
      failureOutcome: "server_error",
      failureDiagnosticId: "v10_report_pack_run_insert_failed",
      failureMessage: runErr.message ?? "Report pack run could not be recorded.",
    };
  }

  if (reportRunId) {
    const artifactUrl = `/api/report-packs/${packId}/runs?format=csv&runId=${runRow?.id}`;
    const { error: successUpdateError } = await input.admin
      .from("report_runs")
      .update({
        status: "succeeded",
        finished_at: nowIso,
        error_summary: null,
        metrics_json: {
          ...metricsJson,
          ...reportRunMetrics,
          report_pack_run_id: runRow?.id ?? null,
          selected_row_count: summaryRows.length,
          generated_row_count: summaryRows.length,
          artifact_url: artifactUrl,
          delivery_destination_state: "not_requested",
        },
      })
      .eq("id", reportRunId);
    if (successUpdateError) pushError("persist", "v10_report_pack_success_update_failed", successUpdateError.message);
    await recordAudit("v10_report_pack_report_run_completed_audit_failed", {
      organizationId: orgId,
      actorUserId: input.actorUserId ?? null,
      actorType,
      action: "report_run.completed",
      targetType: "report_run",
      targetId: reportRunId,
      outcome: "success",
      safeMetadata: {
        ...reportRunMetrics,
        report_pack_run_id: runRow?.id ?? null,
        selected_row_count: summaryRows.length,
        generated_row_count: summaryRows.length,
        artifact_url: artifactUrl,
      },
    });
  }

  try {
    await recordAutomationEvent({
      admin: input.admin,
      organizationId: orgId,
      action: "report_pack_generate",
      entityType: "report_pack",
      entityId: packId,
      details: { generated_at: nowIso, report_type: input.pack.report_type, run_id: runRow?.id },
    });
  } catch (error) {
    pushError("persist", "v10_report_pack_automation_audit_failed", safeErrorMessage(error) ?? "automation audit failed");
  }
  await refreshReadModels("report_pack_generation_cron");

  const delivery = (input.pack.delivery_json as Record<string, unknown> | null) ?? {};
  const emitWebhooks = Boolean(delivery.emit_webhooks);
  if (emitWebhooks) {
    try {
      await enqueueOutboundEvent({
        organizationId: orgId,
        eventType: "report_pack.generated",
        entityType: "report_pack",
        entityId: packId,
        payload: {
          report_pack_id: packId,
          report_pack_name: input.pack.name,
          report_type: input.pack.report_type,
          run_id: runRow?.id,
          metrics: metricsJson,
        },
      });
    } catch (error) {
      pushEmailError("v10_report_pack_webhook_emit_failed", safeErrorMessage(error) ?? "report pack webhook emit failed");
    }
  }

  let subscriptionEmailsSent = 0;
  const { data: subs, error: subsError } = await input.admin
    .from("report_pack_subscriptions")
    .select("id, schedule_cron, recipient_emails, audience_label")
    .eq("organization_id", orgId)
    .eq("report_pack_id", packId)
    .eq("active", true);
  if (subsError) {
    pushEmailError("v10_report_pack_subscription_query_failed", subsError.message);
    return {
      generated: true,
      subscriptionEmailsSent,
      reportRunId,
      reportPackRunId: runRow?.id ?? null,
      errors,
      emailErrors,
      failureOutcome: undefined,
      failureDiagnosticId: null,
      failureMessage: null,
    };
  }

  const emailBatch = await executeBatch(subs ?? [], async (sub) => {
    const subScope = `${scope}:subscription:${String(sub.id)}`;
    try {
      if (!input.existingReportRunId && !cronMatchesUtc(sub.schedule_cron as string | null, now)) return "skipped";
      const emails = (sub.recipient_emails as string[]) ?? [];
      if (emails.length === 0) return "skipped";
      const notificationType = notificationTypeForReportPack(String(input.pack.report_type ?? ""));
      const allowed = await isNotificationAllowed(input.admin, {
        organizationId: orgId,
        channel: "email",
        notificationType,
      });
      if (!allowed) return "skipped";
      if (!input.appUrl) {
        return reportPackError(
          subScope,
          "dependency_preflight",
          "v10_report_pack_canonical_app_url_missing",
          "Canonical app URL is not configured"
        );
      }
      const sendRes = await sendReportPackDigestEmail({
        to: emails,
        packName: String(input.pack.name),
        reportType: String(input.pack.report_type),
        appUrl: input.appUrl,
        metricsSummary: summaryRows,
        workspaceProductMode,
      });
      if (sendRes.error) {
        return reportPackError(
          subScope,
          "notify",
          "v10_report_pack_subscription_email_failed",
          sendRes.error.message
        );
      }
      subscriptionEmailsSent += 1;
      const { error: subscriptionUpdateError } = await input.admin
        .from("report_pack_subscriptions")
        .update({ last_sent_at: nowIso })
        .eq("id", sub.id as string);
      if (subscriptionUpdateError) {
        return reportPackError(
          subScope,
          "persist",
          "v10_report_pack_subscription_update_failed",
          subscriptionUpdateError.message
        );
      }
      return;
    } catch (error) {
      return reportPackError(
        subScope,
        "notify",
        "v10_report_pack_subscription_unhandled_failure",
        safeErrorMessage(error) ?? "report pack subscription delivery failed"
      );
    }
  });
  emailErrors.push(...emailBatch.errors);

  return {
    generated: true,
    subscriptionEmailsSent,
    reportRunId,
    reportPackRunId: runRow?.id ?? null,
    errors,
    emailErrors,
    failureOutcome: undefined,
    failureDiagnosticId: null,
    failureMessage: null,
  };
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = withCronRoute({
  route: "/api/cron/v4/report-packs-generate",
  healthcheckRoute: "cron/v4/report-packs-generate",
  rateLimitKey: "cron:v4:report-packs-generate",
  rateLimit: RATE_LIMITS.v4ReportPacksCron,
  handler: async ({ admin }) => {
    const now = new Date();
    const { data: packs, error: packsError } = await admin
      .from("report_packs")
      .select("id, organization_id, report_type, name, schedule, delivery_json")
      .eq("active", true)
      .limit(200);
    if (packsError) {
      return {
        status: 500,
        ok: false,
        errorsCount: 1,
        phase: "source_query",
        body: {
          error: "Could not load report packs",
          code: "v10_report_pack_query_failed",
          diagnostic_id: "v10_report_pack_query_failed",
        },
      };
    }

    let generated = 0;
    let duplicateSkipped = 0;
    let emailsSent = 0;
    const appUrl = getCanonicalServerBaseUrl();
    const errors: BatchItemError[] = [];

    const batch = await executeBatch(packs ?? [], async (pack) => {
      if (!cronMatchesUtc(pack.schedule as string | null, now)) return "skipped";
      try {
        const result = await runSingleReportPackGeneration({
          admin,
          pack: {
            id: String(pack.id),
            organization_id: String(pack.organization_id),
            report_type: (pack.report_type as string | null) ?? null,
            name: (pack.name as string | null) ?? null,
            delivery_json: pack.delivery_json,
          },
          appUrl,
          now,
          actorType: "system",
        });
        if (result.duplicateSkipped) {
          duplicateSkipped += 1;
          return;
        }
        if (result.generated) generated += 1;
        emailsSent += result.subscriptionEmailsSent;
        errors.push(...result.errors, ...result.emailErrors);
        if (!result.generated && result.failureDiagnosticId) {
          errors.push(
            reportPackError(
              `report_pack:${String(pack.id)}`,
              result.failureOutcome === "dependency_blocked" ? "dependency_preflight" : "handler",
              result.failureDiagnosticId,
              result.failureMessage ?? result.failureDiagnosticId
            )
          );
        }
        return;
      } catch (error) {
        return reportPackError(
          `report_pack:${String(pack.id)}`,
          "handler",
          "v10_report_pack_generation_unhandled_failure",
          safeErrorMessage(error) ?? "report pack generation failed"
        );
      }
    });
    errors.push(...batch.errors);

    return {
      partial: errors.length > 0,
      errorsCount: errors.length,
      phase: errors[0]?.phase,
      body: {
        generated,
        duplicateSkipped,
        subscriptionEmailsSent: emailsSent,
        ...(errors.length > 0
          ? {
              errors: errors.map((entry) => `${entry.scope}: ${entry.message}`),
              error_details: errors.slice(0, 10),
            }
          : {}),
      },
    };
  },
});
