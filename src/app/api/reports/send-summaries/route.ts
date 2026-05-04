import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/server";
import { withCronRoute } from "@/lib/cron/route-runner";
import { getRequestOrigin } from "@/lib/app-url";
import { sendSavedViewSummaryEmail } from "@/lib/email";
import {
  getSupabasePublicEnv,
  getSupabaseServiceRoleKey,
} from "@/lib/env/server";
import { captureServerMessage } from "@/lib/observability/sentry";
import { getContractIdsForDeadlinePreset, type DeadlinePreset } from "@/lib/contract-filters";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { randomUUID } from "node:crypto";
import { isNotificationAllowed } from "@/lib/notification-policy";
import { deliverWithRetries, markNotificationSuppressed } from "@/lib/notification-delivery";
import { getV6OrgSettingsJson } from "@/lib/v6/org-settings";
import {
  degradeOutboundEmailCopyForCore,
  emailCopyUsesCoreSurface,
} from "@/lib/email-workspace-degrade";
import { recordV10AuditEvent } from "@/lib/v10-server-contracts";
import { refreshV10ReadModelsForOrganization } from "@/lib/v10-read-model-refresh";
import { emitProductTelemetryEvent } from "@/lib/product-telemetry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RECIPIENT_SEND_CONCURRENCY = 4;
const MAX_DUE_SUBSCRIPTIONS = 100;
const MAX_RECIPIENTS_PER_SUBSCRIPTION = 20;

async function refreshV10ReportDeliveryReadModels(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  organizationId: string,
  reason: string
) {
  await refreshV10ReadModelsForOrganization(admin, organizationId, {
    refreshScope: "one_model",
    reason,
    modelKeys: ["work_items", "report_run_visibility", "notification_deliveries", "contract_activity_events", "audit_events", "command_search_index"],
  });
}

function parseViewQuery(
  query: Record<string, unknown>
): { status?: string; owner?: string; region?: string; search?: string; deadline?: DeadlinePreset } {
  const status = typeof query.status === "string" && query.status.trim() ? query.status.trim() : undefined;
  const owner = typeof query.owner === "string" && query.owner.trim() ? query.owner.trim() : undefined;
  const region = typeof query.region === "string" && query.region.trim() ? query.region.trim() : undefined;
  const search = typeof query.search === "string" && query.search.trim() ? query.search.trim() : undefined;
  const deadline =
    typeof query.deadline === "string" && query.deadline.trim()
      ? (query.deadline.trim() as DeadlinePreset)
      : undefined;
  return { status, owner, region, search, deadline };
}

export const GET = withCronRoute({
  route: "/api/reports/send-summaries",
  rateLimitKey: "cron:reports:send-summaries",
  rateLimit: RATE_LIMITS.reportsSummariesCron,
  handler: async ({ request, admin }) => {
  let supabaseUrl: string;
  let serviceRoleKey: string;
  try {
    ({ url: supabaseUrl } = getSupabasePublicEnv());
    serviceRoleKey = getSupabaseServiceRoleKey();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Supabase env misconfigured";
    console.error("[reports/cron] configuration error:", message);
    return {
      status: 503,
      ok: false,
      errorsCount: 1,
      body: {
        error: "Server misconfigured",
        code: "supabase_env_invalid",
        diagnostic_id: "report_summaries_supabase_env_invalid",
      },
    };
  }

  const supabase = createServerClient(supabaseUrl, serviceRoleKey, {
    cookies: { getAll: () => [], setAll: () => {} },
  });

  const nowIso = new Date().toISOString();
  const { data: rows, error } = await supabase
    .from("report_subscriptions")
    .select(
      "id, saved_view_id, user_id, organization_id, frequency, next_run_at, recipient_emails, saved_views!inner(id, name, view_type, query_json)"
    )
    .eq("active", true)
    .in("frequency", ["weekly", "monthly"])
    .lte("next_run_at", nowIso)
    .order("next_run_at", { ascending: true })
    .limit(MAX_DUE_SUBSCRIPTIONS);

  if (error) {
    console.error("[reports/cron] subscriptions query:", error.message);
    captureServerMessage(error.message, {
      level: "error",
      extra: { route: "reports/send-summaries", phase: "query_subscriptions" },
    });
    return {
      status: 500,
      ok: false,
      errorsCount: 1,
      body: {
        error: "Could not load subscriptions",
        code: "report_subscription_query_failed",
        diagnostic_id: "report_subscription_query_failed",
      },
    };
  }

  const list = rows ?? [];
  if (list.length === 0) {
    return {
      body: {
      sent: 0,
      candidates: 0,
      message: "No due summaries",
      },
    };
  }

  const userIds = [...new Set(list.map((r) => r.user_id).filter(Boolean))];
  const { data: profiles } =
    userIds.length === 0
      ? { data: [] as Array<{ id: string; email: string | null }> }
      : await supabase
          .from("profiles")
          .select("id, email")
          .in("id", userIds);
  const profileByUserId = new Map((profiles ?? []).map((p) => [p.id, p.email]));

  const appUrl = getRequestOrigin(request);
  let sent = 0;
  const errors: string[] = [];

  for (const row of list) {
    const v6Org = await getV6OrgSettingsJson(admin, row.organization_id);
    const workspaceProductMode = v6Org.workspace_mode;

    const emailAllowed = await isNotificationAllowed(admin, {
      organizationId: row.organization_id,
      channel: "email",
      notificationType: "saved_view_summary",
    });
    if (!emailAllowed) {
      const rawName = (row.saved_views as { name?: string } | null)?.name ?? "Saved view";
      const subjectName = emailCopyUsesCoreSurface(workspaceProductMode)
        ? degradeOutboundEmailCopyForCore(rawName)
        : rawName;
      await markNotificationSuppressed(admin, {
        organizationId: row.organization_id,
        channel: "email",
        notificationType: "saved_view_summary",
        subject: `${row.frequency === "monthly" ? "Monthly" : "Weekly"} summary: ${subjectName}`,
        metadata: { subscription_id: row.id },
      });
      continue;
    }
    const { data: reportRun } = await supabase
      .from("report_runs")
      .insert({
        organization_id: row.organization_id,
        subscription_id: row.id,
        report_mode: "saved_view",
        status: "running",
      })
      .select("id")
      .maybeSingle();
    if (reportRun?.id) {
      await recordV10AuditEvent(admin, {
        organizationId: row.organization_id,
        actorUserId: row.user_id,
        action: "report_run.created",
        targetType: "report_run",
        targetId: reportRun.id,
        outcome: "success",
        safeMetadata: { report_mode: "saved_view", subscription_id: row.id },
      });
    }

    const savedView = row.saved_views as unknown as {
      id: string;
      name: string;
      view_type: string;
      query_json: Record<string, unknown>;
    };
    const ownerEmail = profileByUserId.get(row.user_id) ?? null;
    const extraRecipients = ((row.recipient_emails ?? []) as string[]).filter(Boolean);
    const recipients = [
      ...new Set([ownerEmail, ...extraRecipients].filter(Boolean)),
    ].slice(0, MAX_RECIPIENTS_PER_SUBSCRIPTION) as string[];
    if (recipients.length === 0) {
      if (reportRun?.id) {
        await supabase
          .from("report_runs")
          .update({
            status: "failed",
            finished_at: new Date().toISOString(),
            error_summary: "No recipients configured",
          })
          .eq("id", reportRun.id);
        await emitProductTelemetryEvent(admin, {
          organizationId: row.organization_id,
          userId: row.user_id,
          action: "product.v10.report_run_completed",
          details: {
            status: "failed",
            report_mode: "saved_view",
            failure_category: "no_recipients",
          },
        });
        await refreshV10ReportDeliveryReadModels(admin, row.organization_id, "report_delivery_no_recipients");
      }
      continue;
    }
    const recipientTokens = new Map(recipients.map((recipient) => [recipient, randomUUID()]));
    if (reportRun?.id) {
      await supabase.from("report_run_recipients").upsert(
        recipients.map((recipient) => ({
          organization_id: row.organization_id,
          report_run_id: reportRun.id,
          recipient_email: recipient,
          engagement_token: recipientTokens.get(recipient),
          delivery_status: "pending",
        })),
        { onConflict: "report_run_id,recipient_email", ignoreDuplicates: false }
      );
    }

    const parsed = parseViewQuery(savedView.query_json ?? {});
    let count = 0;
    let exceptionCount = 0;
    let trendWeeklyActive = 0;
    let sampleRows: Array<{ label: string; href: string; meta: string }> = [];
    let workspacePath = "/contracts";

    if (savedView.view_type === "contracts") {
      let deadlineIds: string[] | null = null;
      if (parsed.deadline) {
        deadlineIds = await getContractIdsForDeadlinePreset(
          supabase as unknown as Awaited<ReturnType<typeof createAdminClient>>,
          row.organization_id,
          parsed.deadline
        );
      }

      let q = supabase
        .from("contracts")
        .select("id, title, counterparty, status", { count: "exact" })
        .eq("organization_id", row.organization_id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (parsed.status) q = q.eq("status", parsed.status);
      if (parsed.owner) q = q.eq("owner_id", parsed.owner);
      if (parsed.region) q = q.eq("region", parsed.region);
      if (deadlineIds !== null) {
        if (deadlineIds.length === 0) {
          q = q.in("id", ["00000000-0000-0000-0000-000000000000"]);
        } else {
          q = q.in("id", deadlineIds);
        }
      }
      if (parsed.search) {
        q = q.or(
          `title.ilike.%${parsed.search}%,counterparty.ilike.%${parsed.search}%,contract_type.ilike.%${parsed.search}%`
        );
      }

      const { data: records, count: total, error: viewErr } = await q;
      if (viewErr) {
        errors.push(`${row.id}: ${viewErr.message}`);
        continue;
      }
      count = total ?? 0;
      sampleRows = (records ?? []).map((c) => ({
        label: c.title,
        href: `/contracts/${c.id}`,
        meta: `${c.counterparty ?? "No counterparty"} · ${c.status}`,
      }));
      workspacePath = "/contracts";
      const [{ count: atRiskCount }, { count: activeTransitions }] = await Promise.all([
        supabase
          .from("contracts")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", row.organization_id)
          .eq("health_status", "at_risk"),
        supabase
          .from("contract_intake_history")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", row.organization_id)
          .eq("to_status", "active")
          .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      ]);
      exceptionCount = atRiskCount ?? 0;
      trendWeeklyActive = activeTransitions ?? 0;
    } else if (savedView.view_type === "tasks") {
      let q = supabase
        .from("contract_tasks")
        .select("id, title, status, priority, contracts!inner(id, title, organization_id)", { count: "exact" })
        .eq("organization_id", row.organization_id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (parsed.status) q = q.eq("status", parsed.status);
      const { data: records, count: total, error: viewErr } = await q;
      if (viewErr) {
        errors.push(`${row.id}: ${viewErr.message}`);
        continue;
      }
      count = total ?? 0;
      sampleRows = (records ?? []).flatMap((t) => {
        const contract = (Array.isArray(t.contracts) ? t.contracts[0] : t.contracts) as
          | { id?: string; title?: string }
          | undefined;
        if (!contract?.id) return [];
        return [{ label: t.title, href: `/contracts/${contract.id}`, meta: `${contract.title} · ${t.status} · ${t.priority}` }];
      });
      workspacePath = "/contracts/tasks";
      const { count: blockedCount } = await supabase
        .from("contract_tasks")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", row.organization_id)
        .eq("status", "blocked");
      exceptionCount = blockedCount ?? 0;
    } else if (savedView.view_type === "obligations") {
      let q = supabase
        .from("contract_obligations")
        .select("id, title, status, due_date, contracts!inner(id, title, organization_id)", { count: "exact" })
        .eq("organization_id", row.organization_id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (parsed.status) q = q.eq("status", parsed.status);
      const { data: records, count: total, error: viewErr } = await q;
      if (viewErr) {
        errors.push(`${row.id}: ${viewErr.message}`);
        continue;
      }
      count = total ?? 0;
      sampleRows = (records ?? []).flatMap((o) => {
        const contract = (Array.isArray(o.contracts) ? o.contracts[0] : o.contracts) as
          | { id?: string; title?: string }
          | undefined;
        if (!contract?.id) return [];
        return [
          {
            label: o.title,
            href: `/contracts/${contract.id}`,
            meta: `${contract.title} · ${o.status}${o.due_date ? ` · due ${o.due_date}` : ""}`,
          },
        ];
      });
      workspacePath = "/contracts/obligations";
      const { count: overdueCount } = await supabase
        .from("contract_obligations")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", row.organization_id)
        .in("status", ["open", "in_progress"])
        .lt("due_date", new Date().toISOString().slice(0, 10));
      exceptionCount = overdueCount ?? 0;
    } else if (savedView.view_type === "renewals") {
      const horizon = parsed.deadline || "renewal_90";
      const ids =
        (await getContractIdsForDeadlinePreset(
        supabase as unknown as Awaited<ReturnType<typeof createAdminClient>>,
        row.organization_id,
        horizon
      )) ?? [];
      let q = supabase
        .from("contracts")
        .select("id, title, counterparty, status", { count: "exact" })
        .eq("organization_id", row.organization_id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (ids.length === 0) {
        q = q.in("id", ["00000000-0000-0000-0000-000000000000"]);
      } else {
        q = q.in("id", ids);
      }
      const { data: records, count: total, error: viewErr } = await q;
      if (viewErr) {
        errors.push(`${row.id}: ${viewErr.message}`);
        continue;
      }
      count = total ?? 0;
      sampleRows = (records ?? []).map((c) => ({
        label: c.title,
        href: `/contracts/${c.id}`,
        meta: `${c.counterparty ?? "No counterparty"} · ${c.status}`,
      }));
      workspacePath = "/contracts/renewals";
      const { count: blockedScenarioCount } = await supabase
        .from("contract_renewal_scenarios")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", row.organization_id)
        .not("blocker", "is", null);
      exceptionCount = blockedScenarioCount ?? 0;
    } else {
      continue;
    }
    sampleRows = [
      ...sampleRows,
      {
        label: "Exception digest",
        href: "/contracts/exceptions",
        meta: `${exceptionCount} exceptions · ${trendWeeklyActive} activated last 7d`,
      },
    ].slice(0, 6);
    let deliveredRecipients = 0;
    let recipientIdx = 0;
    async function sendRecipientWorker(): Promise<void> {
      while (recipientIdx < recipients.length) {
        const recipient = recipients[recipientIdx++];
      const token = recipientTokens.get(recipient);
      const trackedRows = sampleRows.map((sample) => ({
        ...sample,
        href: token
          ? `/api/reports/track/click/${token}?target=${encodeURIComponent(`${appUrl.replace(/\/+$/, "")}${sample.href}`)}`
          : sample.href,
      }));
      const trackedWorkspacePath = token
        ? `/api/reports/track/click/${token}?target=${encodeURIComponent(`${appUrl.replace(/\/+$/, "")}${workspacePath}`)}`
        : workspacePath;
      const summarySubjectName = emailCopyUsesCoreSurface(workspaceProductMode)
        ? degradeOutboundEmailCopyForCore(savedView.name)
        : savedView.name;
      const delivery = await deliverWithRetries(admin, {
        organizationId: row.organization_id,
        channel: "email",
        notificationType: "saved_view_summary",
        recipient,
        subject: `${row.frequency === "monthly" ? "Monthly" : "Weekly"} summary: ${summarySubjectName}`,
        metadata: { subscription_id: row.id, report_run_id: reportRun?.id ?? null },
        maxAttempts: 3,
        retryPayload: {
          kind: "saved_view_summary",
          to: recipient,
          viewName: savedView.name,
          appUrl,
          itemCount: count,
          workspacePath: trackedWorkspacePath,
          sampleRows: trackedRows,
          openPixelUrl: token ? `${appUrl.replace(/\/+$/, "")}/api/reports/track/open/${token}` : null,
          workspaceProductMode,
        },
        send: () =>
          sendSavedViewSummaryEmail({
            to: recipient,
            viewName: savedView.name,
            appUrl,
            itemCount: count,
            workspacePath: trackedWorkspacePath,
            sampleRows: trackedRows,
            openPixelUrl: token ? `${appUrl.replace(/\/+$/, "")}/api/reports/track/open/${token}` : null,
            workspaceProductMode,
          }),
      });

      if (!delivery.delivered) {
        errors.push(`${row.id}:${recipient}: ${delivery.error ?? "delivery failed"}`);
        if (reportRun?.id) {
          await supabase
            .from("report_run_recipients")
            .update({
              delivery_status: "failed",
              delivery_error: String(delivery.error ?? "delivery failed").slice(0, 500),
            })
            .eq("report_run_id", reportRun.id)
            .eq("recipient_email", recipient);
        }
      } else {
        deliveredRecipients++;
        if (reportRun?.id) {
          await supabase
            .from("report_run_recipients")
            .update({
              delivery_status: "delivered",
              delivered_at: new Date().toISOString(),
              delivery_error: null,
            })
            .eq("report_run_id", reportRun.id)
            .eq("recipient_email", recipient);
        }
      }
      }
    }
    await Promise.all(
      Array.from(
        { length: Math.min(RECIPIENT_SEND_CONCURRENCY, recipients.length) },
        () => sendRecipientWorker()
      )
    );
    if (deliveredRecipients === 0) {
      if (reportRun?.id) {
        await supabase
          .from("report_runs")
          .update({
            status: "failed",
            finished_at: new Date().toISOString(),
            error_summary: "No deliveries succeeded",
            metrics_json: {
              item_count: count,
              exception_count: exceptionCount,
              weekly_active_transitions: trendWeeklyActive,
            },
          })
          .eq("id", reportRun.id);
        await emitProductTelemetryEvent(admin, {
          organizationId: row.organization_id,
          userId: row.user_id,
          action: "product.v10.report_run_completed",
          details: {
            status: "failed",
            report_mode: "saved_view",
            failure_category: "delivery_failed",
            recipient_count: recipients.length,
          },
        });
        await refreshV10ReportDeliveryReadModels(admin, row.organization_id, "report_delivery_failed");
      }
      continue;
    }

    const nextRun = (() => {
      if (row.frequency === "monthly") {
        const d = new Date();
        d.setUTCDate(1);
        d.setUTCHours(9, 30, 0, 0);
        d.setUTCMonth(d.getUTCMonth() + 1);
        return d.toISOString();
      }
      const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      return d.toISOString();
    })();
    await supabase
      .from("report_subscriptions")
      .update({ last_sent_at: nowIso, next_run_at: nextRun })
      .eq("id", row.id);
    if (reportRun?.id) {
      await supabase
        .from("report_runs")
        .update({
          status: "succeeded",
          finished_at: new Date().toISOString(),
          metrics_json: {
            item_count: count,
            exception_count: exceptionCount,
            weekly_active_transitions: trendWeeklyActive,
            sample_count: sampleRows.length,
            recipient_count: recipients.length,
            delivered_recipient_count: deliveredRecipients,
          },
        })
        .eq("id", reportRun.id);
      await recordV10AuditEvent(admin, {
        organizationId: row.organization_id,
        actorUserId: row.user_id,
        action: "report_run.completed",
        targetType: "report_run",
        targetId: reportRun.id,
        outcome: "success",
        safeMetadata: { recipient_count: recipients.length, delivered_recipient_count: deliveredRecipients },
      });
      await emitProductTelemetryEvent(admin, {
        organizationId: row.organization_id,
        userId: row.user_id,
        action: "product.v10.report_run_completed",
        details: {
          status: "succeeded",
          report_mode: "saved_view",
          item_count: count,
          recipient_count: recipients.length,
          delivered_recipient_count: deliveredRecipients,
        },
      });
      await refreshV10ReportDeliveryReadModels(admin, row.organization_id, "report_delivery_completed");
    }
    sent++;
  }

  if (errors.length > 0) {
    captureServerMessage("report summary cron errors", {
      level: "warning",
      extra: { route: "reports/send-summaries", errorCount: errors.length },
    });
  }

    return {
      partial: errors.length > 0,
      errorsCount: errors.length,
      body: {
        sent,
        candidates: list.length,
        ...(errors.length > 0 ? { errors } : {}),
      },
    };
  },
});
