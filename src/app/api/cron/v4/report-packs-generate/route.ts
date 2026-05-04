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
import { getAppBaseUrlFromEnv } from "@/lib/app-url";
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

export type ReportPackGenerationResult = {
  generated: boolean;
  subscriptionEmailsSent: number;
  reportRunId: string | null;
  reportPackRunId: string | null;
  failureOutcome?: "dependency_blocked" | "server_error";
  failureDiagnosticId?: string | null;
  failureMessage?: string | null;
};

export async function runSingleReportPackGeneration(input: {
  admin: Awaited<ReturnType<typeof createAdminClient>>;
  pack: {
    id: string;
    organization_id: string;
    report_type: string | null;
    name: string | null;
    delivery_json?: unknown;
  };
  appUrl: string;
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
        failureOutcome: "dependency_blocked",
        failureDiagnosticId: diagnosticId,
        failureMessage: message,
      };
    }
    await input.admin
      .from("report_runs")
      .update({
        status: "failed",
        finished_at: nowIso,
        error_summary: message,
      })
      .eq("id", input.existingReportRunId);
    await recordV10AuditEvent(input.admin, {
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
    await refreshV10ReadModelsForOrganization(input.admin, orgId, {
      refreshScope: "one_model",
      reason: diagnosticId,
      modelKeys: ["work_items", "report_run_visibility", "job_run_visibility", "contract_activity_events", "audit_events", "command_search_index"],
    });
    return {
      generated: false,
      subscriptionEmailsSent: 0,
      reportRunId: input.existingReportRunId ?? null,
      reportPackRunId: null,
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

  const { data: prevRun } = await input.admin
    .from("report_pack_runs")
    .select("metrics_json")
    .eq("organization_id", orgId)
    .eq("report_pack_id", packId)
    .eq("status", "succeeded")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

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
  const reportRunMetrics = { report_pack_id: packId, report_type: reportType, report_family: reportFamily };

  let reportRunId = input.existingReportRunId ?? null;
  if (reportRunId) {
    await input.admin
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
  } else {
    const { data: reportRun } = await input.admin
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
    reportRunId = reportRun?.id ?? null;
  }
  if (reportRunId) {
    await recordV10AuditEvent(input.admin, {
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
      await input.admin
        .from("report_runs")
        .update({
          status: "failed",
          finished_at: nowIso,
          error_summary: runErr.message ?? "Report pack run could not be recorded.",
          metrics_json: { ...reportRunMetrics, failure_category: "report_pack_run_recording_failed" },
        })
        .eq("id", reportRunId);
      await recordV10AuditEvent(input.admin, {
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
      await refreshV10ReadModelsForOrganization(input.admin, orgId, {
        refreshScope: "one_model",
        reason: "report_pack_generation_failed",
        modelKeys: ["work_items", "report_run_visibility", "job_run_visibility", "contract_activity_events", "audit_events", "command_search_index"],
      });
    }
    return {
      generated: false,
      subscriptionEmailsSent: 0,
      reportRunId,
      reportPackRunId: null,
      failureOutcome: "server_error",
      failureDiagnosticId: "v10_report_pack_run_insert_failed",
      failureMessage: runErr.message ?? "Report pack run could not be recorded.",
    };
  }

  if (reportRunId) {
    const artifactUrl = `/api/report-packs/${packId}/runs?format=csv&runId=${runRow?.id}`;
    await input.admin
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
    await recordV10AuditEvent(input.admin, {
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

  await recordAutomationEvent({
    admin: input.admin,
    organizationId: orgId,
    action: "report_pack_generate",
    entityType: "report_pack",
    entityId: packId,
    details: { generated_at: nowIso, report_type: input.pack.report_type, run_id: runRow?.id },
  });
  await refreshV10ReadModelsForOrganization(input.admin, orgId, {
    refreshScope: "one_model",
    reason: "report_pack_generation_cron",
    modelKeys: ["work_items", "report_run_visibility", "job_run_visibility", "contract_activity_events", "audit_events", "command_search_index"],
  });

  const delivery = (input.pack.delivery_json as Record<string, unknown> | null) ?? {};
  const emitWebhooks = Boolean(delivery.emit_webhooks);
  if (emitWebhooks) {
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
  }

  let subscriptionEmailsSent = 0;
  const { data: subs } = await input.admin
    .from("report_pack_subscriptions")
    .select("id, schedule_cron, recipient_emails, audience_label")
    .eq("organization_id", orgId)
    .eq("report_pack_id", packId)
    .eq("active", true);

  for (const sub of subs ?? []) {
    if (!input.existingReportRunId && !cronMatchesUtc(sub.schedule_cron as string | null, now)) continue;
    const emails = (sub.recipient_emails as string[]) ?? [];
    if (emails.length === 0) continue;
    const notificationType = notificationTypeForReportPack(String(input.pack.report_type ?? ""));
    const allowed = await isNotificationAllowed(input.admin, {
      organizationId: orgId,
      channel: "email",
      notificationType,
    });
    if (!allowed) continue;
    const sendRes = await sendReportPackDigestEmail({
      to: emails,
      packName: String(input.pack.name),
      reportType: String(input.pack.report_type),
      appUrl: input.appUrl,
      metricsSummary: summaryRows,
      workspaceProductMode,
    });
    if (!sendRes.error) {
      subscriptionEmailsSent += 1;
      await input.admin.from("report_pack_subscriptions").update({ last_sent_at: nowIso }).eq("id", sub.id as string);
    }
  }

  return {
    generated: true,
    subscriptionEmailsSent,
    reportRunId,
    reportPackRunId: runRow?.id ?? null,
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
    const { data: packs } = await admin
      .from("report_packs")
      .select("id, organization_id, report_type, name, schedule, delivery_json")
      .eq("active", true)
      .limit(200);

    let generated = 0;
    let emailsSent = 0;
    const appUrl = getAppBaseUrlFromEnv();

    for (const pack of packs ?? []) {
      if (!cronMatchesUtc(pack.schedule as string | null, now)) continue;
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
      if (result.generated) generated += 1;
      emailsSent += result.subscriptionEmailsSent;
    }

    return {
      body: {
        generated,
        subscriptionEmailsSent: emailsSent,
      },
    };
  },
});
