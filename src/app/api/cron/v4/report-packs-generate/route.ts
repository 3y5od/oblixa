import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { ensureCronAuthorized } from "@/lib/v4/cron";
import { RATE_LIMITS, rateLimitCheck } from "@/lib/rate-limit";
import { pingCronHealthcheck } from "@/lib/observability/cron-healthcheck";
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

export async function GET(request: Request) {
  const startedAt = Date.now();
  const unauthorized = ensureCronAuthorized(request);
  if (unauthorized) return unauthorized;
  const rate = await rateLimitCheck("cron:v4:report-packs-generate", RATE_LIMITS.v4ReportPacksCron);
  if (!rate.ok) {
    return NextResponse.json({ error: "Too many requests", retryAfterMs: rate.retryAfterMs }, { status: 429 });
  }

  const admin = await createAdminClient();
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

    const orgId = pack.organization_id as string;
    const packId = pack.id as string;
    const v6Org = await getV6OrgSettingsJson(admin, orgId);
    const workspaceProductMode = parseWorkspaceMode(v6Org);
    const reportType = String(pack.report_type ?? "");
    const minModeForReport = minWorkspaceModeForReportType(reportType);
    if (!workspaceModeAtLeast(workspaceProductMode, minModeForReport)) {
      continue;
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
        continue;
      }
    }

    const { data: prevRun } = await admin
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
      admin,
      organizationId: orgId,
      reportType,
      workspaceProductMode,
    });
    const metricsJson = {
      ...baseMetrics,
      ...(Object.keys(prior).length > 0 ? { prior } : {}),
    };

    const delivery = (pack.delivery_json as Record<string, unknown> | null) ?? {};
    const emitWebhooks = Boolean(delivery.emit_webhooks);

    const nowIso = now.toISOString();
    const { data: runRow, error: runErr } = await admin
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

    if (runErr) continue;
    generated += 1;

    await recordAutomationEvent({
      admin,
      organizationId: orgId,
      action: "report_pack_generate",
      entityType: "report_pack",
      entityId: packId,
      details: { generated_at: nowIso, report_type: pack.report_type, run_id: runRow?.id },
    });

    if (emitWebhooks) {
      await enqueueOutboundEvent({
        organizationId: orgId,
        eventType: "report_pack.generated",
        entityType: "report_pack",
        entityId: packId,
        payload: {
          report_pack_id: packId,
          report_pack_name: pack.name,
          report_type: pack.report_type,
          run_id: runRow?.id,
          metrics: metricsJson,
        },
      });
    }

    const { data: subs } = await admin
      .from("report_pack_subscriptions")
      .select("id, schedule_cron, recipient_emails, audience_label")
      .eq("organization_id", orgId)
      .eq("report_pack_id", packId)
      .eq("active", true);

    const summaryRows = metricsToSummaryRows(metricsJson);
    for (const sub of subs ?? []) {
      if (!cronMatchesUtc(sub.schedule_cron as string | null, now)) continue;
      const emails = (sub.recipient_emails as string[]) ?? [];
      if (emails.length === 0) continue;
      const notificationType = notificationTypeForReportPack(String(pack.report_type ?? ""));
      const allowed = await isNotificationAllowed(admin, {
        organizationId: orgId,
        channel: "email",
        notificationType,
      });
      if (!allowed) continue;
      const sendRes = await sendReportPackDigestEmail({
        to: emails,
        packName: String(pack.name),
        reportType: String(pack.report_type),
        appUrl,
        metricsSummary: summaryRows,
        workspaceProductMode,
      });
      if (!sendRes.error) {
        emailsSent += 1;
        await admin
          .from("report_pack_subscriptions")
          .update({ last_sent_at: nowIso })
          .eq("id", sub.id as string);
      }
    }
  }

  const payload = { generated, subscriptionEmailsSent: emailsSent, ok: true, durationMs: Date.now() - startedAt };
  pingCronHealthcheck("cron/v4/report-packs-generate", payload);
  return NextResponse.json(payload);
}
