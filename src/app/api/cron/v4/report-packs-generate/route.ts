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
      reportType: String(pack.report_type),
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
      const sendRes = await sendReportPackDigestEmail({
        to: emails,
        packName: String(pack.name),
        reportType: String(pack.report_type),
        appUrl,
        metricsSummary: summaryRows,
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
