import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { withCronRoute } from "@/lib/cron/route-runner";
import { getCanonicalServerBaseUrl } from "@/lib/app-url";
import { sendSavedViewSummaryEmail } from "@/lib/email";
import { captureServerMessage } from "@/lib/observability/sentry";
import { getContractIdsForDeadlinePreset, type DeadlinePreset } from "@/lib/contract-filters";
import { RATE_LIMITS } from "@/lib/rate-limit";
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
import {
  executeBatch,
  safeErrorMessage,
  type BatchItemError,
} from "@/lib/route-runtime-contract";
import { forEachSupabaseRangePage } from "@/lib/supabase/range-pagination";
import { publicTokenHash, publicTokenPrefix } from "@/lib/security/public-token-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;
type SavedViewRow = {
  id: string;
  name: string;
  view_type: string;
  query_json: Record<string, unknown> | null;
};
type ReportSubscriptionRow = {
  id: string;
  saved_view_id: string | null;
  user_id: string;
  organization_id: string;
  frequency: string;
  next_run_at: string;
  recipient_emails: string[] | null;
  saved_views: SavedViewRow | SavedViewRow[] | null;
};
type SampleRow = { label: string; href: string; meta: string };
type SummaryData = {
  count: number;
  exceptionCount: number;
  trendWeeklyActive: number;
  sampleRows: SampleRow[];
  workspacePath: string;
};

const RECIPIENT_SEND_CONCURRENCY = 4;
const DUE_SUBSCRIPTION_PAGE_SIZE = 100;
const MAX_DUE_SUBSCRIPTION_OFFSET_EXCLUSIVE = 5_000;
const RECIPIENT_UPSERT_CHUNK_SIZE = 100;
const REFRESH_MODEL_KEYS = [
  "work_items",
  "report_run_visibility",
  "notification_deliveries",
  "contract_activity_events",
  "audit_events",
  "command_search_index",
] as const;

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

function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function chunkArray<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size) as T[]);
  }
  return chunks;
}

function reportError(
  scope: string,
  phase: BatchItemError["phase"],
  diagnosticId: string,
  message: string
): BatchItemError {
  return { scope, phase, diagnostic_id: diagnosticId, message };
}

function nextRunForFrequency(frequency: string): string {
  if (frequency === "monthly") {
    const next = new Date();
    next.setUTCDate(1);
    next.setUTCHours(9, 30, 0, 0);
    next.setUTCMonth(next.getUTCMonth() + 1);
    return next.toISOString();
  }
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
}

async function refreshV10ReportDeliveryReadModels(admin: AdminClient, organizationId: string, reason: string) {
  await refreshV10ReadModelsForOrganization(admin, organizationId, {
    refreshScope: "one_model",
    reason,
    modelKeys: REFRESH_MODEL_KEYS,
  });
}

export const GET = withCronRoute({
  route: "/api/reports/send-summaries",
  rateLimitKey: "cron:reports:send-summaries",
  rateLimit: RATE_LIMITS.reportsSummariesCron,
  dependencyPreflight: () => {
    const appUrl = getCanonicalServerBaseUrl();
    if (!appUrl) {
      return {
        error: "Canonical app URL is not configured",
        code: "dependency_blocked",
        diagnostic_id: "report_summaries_canonical_app_url_missing",
        details: {
          dependency: "canonical_app_url",
          required_env: ["NEXT_PUBLIC_APP_URL", "APP_BASE_URL", "VERCEL_PROJECT_PRODUCTION_URL"],
          degraded_policy: "503 dependency_blocked",
        },
      };
    }
    if (!String(process.env.RESEND_API_KEY ?? "").trim()) {
      return {
        error: "Report email provider is not configured",
        code: "dependency_blocked",
        diagnostic_id: "report_summaries_resend_missing",
        details: {
          dependency: "email_provider",
          required_env: ["RESEND_API_KEY"],
          optional_env: ["EMAIL_FROM"],
          degraded_policy: "503 dependency_blocked",
        },
      };
    }
    return null;
  },
  handler: async ({ admin }) => {
    const appUrl = getCanonicalServerBaseUrl()!;
    const normalizedAppUrl = appUrl.replace(/\/+$/, "");
    const nowIso = new Date().toISOString();
    let candidates = 0;
    let sent = 0;
    const errors: BatchItemError[] = [];
    const refreshOrganizations = new Set<string>();

    const pushTelemetryError = async (
      scope: string,
      diagnosticId: string,
      input: Parameters<typeof emitProductTelemetryEvent>[1]
    ) => {
      const telemetryWritten = await emitProductTelemetryEvent(admin, input);
      if (!telemetryWritten) {
        errors.push(reportError(scope, "persist", diagnosticId, "product telemetry write failed"));
      }
    };

    const pushAuditError = async (
      scope: string,
      diagnosticId: string,
      input: Parameters<typeof recordV10AuditEvent>[1]
    ) => {
      const auditId = await recordV10AuditEvent(admin, input);
      if (!auditId) {
        errors.push(reportError(scope, "persist", diagnosticId, "V10 audit event could not be recorded"));
      }
      return auditId;
    };

    const updateReportRun = async (
      reportRunId: string,
      scope: string,
      diagnosticId: string,
      patch: Record<string, unknown>
    ) => {
      const { error } = await admin.from("report_runs").update(patch).eq("id", reportRunId);
      if (error) {
        errors.push(reportError(scope, "persist", diagnosticId, error.message));
      }
    };

    const updateRecipientStatus = async (
      reportRunId: string,
      recipient: string,
      scope: string,
      diagnosticId: string,
      patch: Record<string, unknown>
    ) => {
      const { error } = await admin
        .from("report_run_recipients")
        .update(patch)
        .eq("report_run_id", reportRunId)
        .eq("recipient_email", recipient);
      if (error) {
        errors.push(reportError(scope, "persist", diagnosticId, error.message));
      }
    };

    const buildSummary = async (
      subscription: ReportSubscriptionRow,
      savedView: SavedViewRow
    ): Promise<SummaryData | null> => {
      const parsed = parseViewQuery(savedView.query_json ?? {});
      let count = 0;
      let exceptionCount = 0;
      let trendWeeklyActive = 0;
      let sampleRows: SampleRow[] = [];
      let workspacePath = "/contracts";
      const scope = subscription.id;

      if (savedView.view_type === "contracts") {
        let deadlineIds: string[] | null = null;
        if (parsed.deadline) {
          deadlineIds = await getContractIdsForDeadlinePreset(admin, subscription.organization_id, parsed.deadline);
        }

        let q = admin
          .from("contracts")
          .select("id, title, counterparty, status", { count: "exact" })
          .eq("organization_id", subscription.organization_id)
          .order("created_at", { ascending: false })
          .limit(5);
        if (parsed.status) q = q.eq("status", parsed.status);
        if (parsed.owner) q = q.eq("owner_id", parsed.owner);
        if (parsed.region) q = q.eq("region", parsed.region);
        if (deadlineIds !== null) q = q.in("id", deadlineIds.length === 0 ? ["00000000-0000-0000-0000-000000000000"] : deadlineIds);
        if (parsed.search) {
          q = q.or(`title.ilike.%${parsed.search}%,counterparty.ilike.%${parsed.search}%,contract_type.ilike.%${parsed.search}%`);
        }

        const { data: records, count: total, error: viewError } = await q;
        if (viewError) {
          errors.push(reportError(scope, "source_query", "report_summary_contract_view_query_failed", viewError.message));
          return null;
        }

        const [atRiskResult, activeResult] = await Promise.all([
          admin
            .from("contracts")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", subscription.organization_id)
            .eq("health_status", "at_risk"),
          admin
            .from("contract_intake_history")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", subscription.organization_id)
            .eq("to_status", "active")
            .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
        ]);
        if (atRiskResult.error) {
          errors.push(reportError(scope, "source_query", "report_summary_contract_exception_query_failed", atRiskResult.error.message));
          return null;
        }
        if (activeResult.error) {
          errors.push(reportError(scope, "source_query", "report_summary_contract_trend_query_failed", activeResult.error.message));
          return null;
        }

        count = total ?? 0;
        exceptionCount = atRiskResult.count ?? 0;
        trendWeeklyActive = activeResult.count ?? 0;
        sampleRows = (records ?? []).map((record) => ({
          label: record.title,
          href: `/contracts/${record.id}`,
          meta: `${record.counterparty ?? "No counterparty"} · ${record.status}`,
        }));
        workspacePath = "/contracts";
      } else if (savedView.view_type === "tasks") {
        let q = admin
          .from("contract_tasks")
          .select("id, title, status, priority, contracts!inner(id, title, organization_id)", { count: "exact" })
          .eq("organization_id", subscription.organization_id)
          .order("created_at", { ascending: false })
          .limit(5);
        if (parsed.status) q = q.eq("status", parsed.status);

        const { data: records, count: total, error: viewError } = await q;
        if (viewError) {
          errors.push(reportError(scope, "source_query", "report_summary_task_view_query_failed", viewError.message));
          return null;
        }

        const blockedResult = await admin
          .from("contract_tasks")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", subscription.organization_id)
          .eq("status", "blocked");
        if (blockedResult.error) {
          errors.push(reportError(scope, "source_query", "report_summary_task_exception_query_failed", blockedResult.error.message));
          return null;
        }

        count = total ?? 0;
        exceptionCount = blockedResult.count ?? 0;
        sampleRows = (records ?? []).flatMap((task) => {
          const contract = unwrapRelation(task.contracts) as { id?: string; title?: string } | null;
          if (!contract?.id) return [];
          return [{ label: task.title, href: `/contracts/${contract.id}`, meta: `${contract.title} · ${task.status} · ${task.priority}` }];
        });
        workspacePath = "/contracts/tasks";
      } else if (savedView.view_type === "obligations") {
        let q = admin
          .from("contract_obligations")
          .select("id, title, status, due_date, contracts!inner(id, title, organization_id)", { count: "exact" })
          .eq("organization_id", subscription.organization_id)
          .order("created_at", { ascending: false })
          .limit(5);
        if (parsed.status) q = q.eq("status", parsed.status);

        const { data: records, count: total, error: viewError } = await q;
        if (viewError) {
          errors.push(reportError(scope, "source_query", "report_summary_obligation_view_query_failed", viewError.message));
          return null;
        }

        const overdueResult = await admin
          .from("contract_obligations")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", subscription.organization_id)
          .in("status", ["open", "in_progress"])
          .lt("due_date", new Date().toISOString().slice(0, 10));
        if (overdueResult.error) {
          errors.push(reportError(scope, "source_query", "report_summary_obligation_exception_query_failed", overdueResult.error.message));
          return null;
        }

        count = total ?? 0;
        exceptionCount = overdueResult.count ?? 0;
        sampleRows = (records ?? []).flatMap((obligation) => {
          const contract = unwrapRelation(obligation.contracts) as { id?: string; title?: string } | null;
          if (!contract?.id) return [];
          return [
            {
              label: obligation.title,
              href: `/contracts/${contract.id}`,
              meta: `${contract.title} · ${obligation.status}${obligation.due_date ? ` · due ${obligation.due_date}` : ""}`,
            },
          ];
        });
        workspacePath = "/contracts/obligations";
      } else if (savedView.view_type === "renewals") {
        const horizon = parsed.deadline || "renewal_90";
        const ids = (await getContractIdsForDeadlinePreset(admin, subscription.organization_id, horizon)) ?? [];
        const q = admin
          .from("contracts")
          .select("id, title, counterparty, status", { count: "exact" })
          .eq("organization_id", subscription.organization_id)
          .order("created_at", { ascending: false })
          .limit(5)
          .in("id", ids.length === 0 ? ["00000000-0000-0000-0000-000000000000"] : ids);

        const { data: records, count: total, error: viewError } = await q;
        if (viewError) {
          errors.push(reportError(scope, "source_query", "report_summary_renewal_view_query_failed", viewError.message));
          return null;
        }

        const blockerResult = await admin
          .from("contract_renewal_scenarios")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", subscription.organization_id)
          .not("blocker", "is", null);
        if (blockerResult.error) {
          errors.push(reportError(scope, "source_query", "report_summary_renewal_exception_query_failed", blockerResult.error.message));
          return null;
        }

        count = total ?? 0;
        exceptionCount = blockerResult.count ?? 0;
        sampleRows = (records ?? []).map((record) => ({
          label: record.title,
          href: `/contracts/${record.id}`,
          meta: `${record.counterparty ?? "No counterparty"} · ${record.status}`,
        }));
        workspacePath = "/contracts/renewals";
      } else {
        errors.push(reportError(scope, "transform", "report_summary_unknown_view_type", `unsupported view type: ${savedView.view_type}`));
        return null;
      }

      sampleRows = [
        ...sampleRows,
        {
          label: "Exception digest",
          href: "/contracts/exceptions",
          meta: `${exceptionCount} exceptions · ${trendWeeklyActive} activated last 7d`,
        },
      ].slice(0, 6);

      return { count, exceptionCount, trendWeeklyActive, sampleRows, workspacePath };
    };

    const processSubscription = async (subscription: ReportSubscriptionRow, profileByUserId: Map<string, string>) => {
      let reportRunId: string | null = null;
      try {
        const savedView = unwrapRelation(subscription.saved_views);
        if (!savedView?.id) {
          errors.push(reportError(subscription.id, "transform", "report_summary_saved_view_missing", "saved view payload missing"));
          return;
        }
        const selectedSavedView: SavedViewRow = savedView;

        const v6Org = await getV6OrgSettingsJson(admin, subscription.organization_id);
        const workspaceProductMode = v6Org.workspace_mode;
        const summarySubjectName = emailCopyUsesCoreSurface(workspaceProductMode)
          ? degradeOutboundEmailCopyForCore(selectedSavedView.name)
          : selectedSavedView.name;

        const emailAllowed = await isNotificationAllowed(admin, {
          organizationId: subscription.organization_id,
          channel: "email",
          notificationType: "saved_view_summary",
        });
        if (!emailAllowed) {
          await markNotificationSuppressed(admin, {
            organizationId: subscription.organization_id,
            channel: "email",
            notificationType: "saved_view_summary",
            subject: `${subscription.frequency === "monthly" ? "Monthly" : "Weekly"} summary: ${summarySubjectName}`,
            metadata: { subscription_id: subscription.id },
          });
          return;
        }

        const reportRunResult = await admin
          .from("report_runs")
          .insert({
            organization_id: subscription.organization_id,
            subscription_id: subscription.id,
            report_mode: "saved_view",
            status: "running",
          })
          .select("id")
          .maybeSingle();
        if (reportRunResult.error || !reportRunResult.data?.id) {
          errors.push(
            reportError(
              subscription.id,
              "persist",
              "report_summary_run_insert_failed",
              reportRunResult.error?.message ?? "report run insert did not return an id"
            )
          );
          return;
        }
        const createdReportRunId = reportRunResult.data.id;
        reportRunId = createdReportRunId;

        await pushAuditError(subscription.id, "report_summary_run_created_audit_failed", {
          organizationId: subscription.organization_id,
          actorUserId: subscription.user_id,
          action: "report_run.created",
          targetType: "report_run",
          targetId: createdReportRunId,
          outcome: "success",
          safeMetadata: { report_mode: "saved_view", subscription_id: subscription.id },
        });

        const ownerEmail = profileByUserId.get(subscription.user_id) ?? null;
        const extraRecipients = (subscription.recipient_emails ?? []).filter(Boolean);
        const recipients = [...new Set([ownerEmail, ...extraRecipients].filter(Boolean))] as string[];
        if (recipients.length === 0) {
          refreshOrganizations.add(subscription.organization_id);
          await updateReportRun(createdReportRunId, subscription.id, "report_summary_run_no_recipient_update_failed", {
            status: "failed",
            finished_at: new Date().toISOString(),
            error_summary: "No recipients configured",
          });
          await pushTelemetryError(subscription.id, "report_summary_no_recipient_telemetry_failed", {
            organizationId: subscription.organization_id,
            userId: subscription.user_id,
            action: "product.v10.report_run_completed",
            details: { status: "failed", report_mode: "saved_view", failure_category: "no_recipients" },
          });
          return;
        }

        const recipientTokens = new Map(recipients.map((recipient) => [recipient, randomUUID()]));
        for (const recipientChunk of chunkArray(recipients, RECIPIENT_UPSERT_CHUNK_SIZE)) {
          const { error } = await admin.from("report_run_recipients").upsert(
            recipientChunk.map((recipient) => {
              const engagementToken = recipientTokens.get(recipient);
              return {
                organization_id: subscription.organization_id,
                report_run_id: createdReportRunId,
                recipient_email: recipient,
                engagement_token: null,
                engagement_token_hash: engagementToken ? publicTokenHash(engagementToken) : null,
                engagement_token_prefix: engagementToken ? publicTokenPrefix(engagementToken) : null,
                delivery_status: "pending",
              };
            }),
            { onConflict: "report_run_id,recipient_email", ignoreDuplicates: false }
          );
          if (error) {
            errors.push(reportError(subscription.id, "persist", "report_summary_recipient_registration_failed", error.message));
            refreshOrganizations.add(subscription.organization_id);
            await updateReportRun(createdReportRunId, subscription.id, "report_summary_run_registration_failure_update_failed", {
              status: "failed",
              finished_at: new Date().toISOString(),
              error_summary: "Recipient registration failed",
            });
            return;
          }
        }

        const summaryData = await buildSummary(subscription, selectedSavedView);
        if (!summaryData) {
          refreshOrganizations.add(subscription.organization_id);
          await updateReportRun(createdReportRunId, subscription.id, "report_summary_run_summary_failure_update_failed", {
            status: "failed",
            finished_at: new Date().toISOString(),
            error_summary: "Saved view query failed",
          });
          await pushTelemetryError(subscription.id, "report_summary_summary_query_telemetry_failed", {
            organizationId: subscription.organization_id,
            userId: subscription.user_id,
            action: "product.v10.report_run_completed",
            details: { status: "failed", report_mode: "saved_view", failure_category: "view_query_failed" },
          });
          return;
        }
        const finalizedSummary: SummaryData = summaryData;

        let deliveredRecipients = 0;
        const recipientErrors: BatchItemError[] = [];
        let recipientIndex = 0;
        async function sendRecipientWorker() {
          while (recipientIndex < recipients.length) {
            const recipient = recipients[recipientIndex++];
            const token = recipientTokens.get(recipient);
            const trackedRows = finalizedSummary.sampleRows.map((sample) => ({
              ...sample,
              href: token
                ? `/api/reports/track/click/${token}?target=${encodeURIComponent(`${normalizedAppUrl}${sample.href}`)}`
                : sample.href,
            }));
            const trackedWorkspacePath = token
              ? `/api/reports/track/click/${token}?target=${encodeURIComponent(`${normalizedAppUrl}${finalizedSummary.workspacePath}`)}`
              : finalizedSummary.workspacePath;

            try {
              const delivery = await deliverWithRetries(admin, {
                organizationId: subscription.organization_id,
                channel: "email",
                notificationType: "saved_view_summary",
                recipient,
                subject: `${subscription.frequency === "monthly" ? "Monthly" : "Weekly"} summary: ${summarySubjectName}`,
                metadata: { subscription_id: subscription.id, report_run_id: createdReportRunId },
                maxAttempts: 3,
                retryPayload: {
                  kind: "saved_view_summary",
                  to: recipient,
                  viewName: selectedSavedView.name,
                  appUrl,
                  itemCount: finalizedSummary.count,
                  workspacePath: trackedWorkspacePath,
                  sampleRows: trackedRows,
                  openPixelUrl: token ? `${normalizedAppUrl}/api/reports/track/open/${token}` : null,
                  workspaceProductMode,
                },
                send: () =>
                  sendSavedViewSummaryEmail({
                    to: recipient,
                    viewName: selectedSavedView.name,
                    appUrl,
                    itemCount: finalizedSummary.count,
                    workspacePath: trackedWorkspacePath,
                    sampleRows: trackedRows,
                    openPixelUrl: token ? `${normalizedAppUrl}/api/reports/track/open/${token}` : null,
                    workspaceProductMode,
                  }),
              });

              if (!delivery.delivered) {
                recipientErrors.push(
                  reportError(
                    `${subscription.id}:${recipient}`,
                    "notify",
                    "report_summary_recipient_delivery_failed",
                    delivery.error ?? "delivery failed"
                  )
                );
                await updateRecipientStatus(
                  createdReportRunId,
                  recipient,
                  `${subscription.id}:${recipient}`,
                  "report_summary_recipient_failure_update_failed",
                  {
                    delivery_status: "failed",
                    delivery_error: String(delivery.error ?? "delivery failed").slice(0, 500),
                  }
                );
                continue;
              }

              deliveredRecipients += 1;
              await updateRecipientStatus(
                createdReportRunId,
                recipient,
                `${subscription.id}:${recipient}`,
                "report_summary_recipient_success_update_failed",
                {
                  delivery_status: "delivered",
                  delivered_at: new Date().toISOString(),
                  delivery_error: null,
                }
              );
            } catch (error) {
              recipientErrors.push(
                reportError(
                  `${subscription.id}:${recipient}`,
                  "notify",
                  "report_summary_recipient_unhandled_failure",
                  safeErrorMessage(error) ?? "recipient delivery failed"
                )
              );
              await updateRecipientStatus(
                createdReportRunId,
                recipient,
                `${subscription.id}:${recipient}`,
                "report_summary_recipient_unhandled_status_update_failed",
                { delivery_status: "failed", delivery_error: "recipient delivery failed" }
              );
            }
          }
        }

        await Promise.all(
          Array.from({ length: Math.min(RECIPIENT_SEND_CONCURRENCY, recipients.length) }, () => sendRecipientWorker())
        );
        errors.push(...recipientErrors);
        refreshOrganizations.add(subscription.organization_id);

        if (deliveredRecipients === 0) {
          await updateReportRun(createdReportRunId, subscription.id, "report_summary_run_delivery_failure_update_failed", {
            status: "failed",
            finished_at: new Date().toISOString(),
            error_summary: "No deliveries succeeded",
            metrics_json: {
              item_count: finalizedSummary.count,
              exception_count: finalizedSummary.exceptionCount,
              weekly_active_transitions: finalizedSummary.trendWeeklyActive,
            },
          });
          await pushTelemetryError(subscription.id, "report_summary_delivery_failure_telemetry_failed", {
            organizationId: subscription.organization_id,
            userId: subscription.user_id,
            action: "product.v10.report_run_completed",
            details: {
              status: "failed",
              report_mode: "saved_view",
              failure_category: "delivery_failed",
              recipient_count: recipients.length,
            },
          });
          return;
        }

        const { error: subscriptionUpdateError } = await admin
          .from("report_subscriptions")
          .update({ last_sent_at: nowIso, next_run_at: nextRunForFrequency(subscription.frequency) })
          .eq("id", subscription.id);
        if (subscriptionUpdateError) {
          errors.push(
            reportError(subscription.id, "persist", "report_summary_subscription_update_failed", subscriptionUpdateError.message)
          );
        }

        await updateReportRun(createdReportRunId, subscription.id, "report_summary_run_success_update_failed", {
          status: "succeeded",
          finished_at: new Date().toISOString(),
          metrics_json: {
            item_count: finalizedSummary.count,
            exception_count: finalizedSummary.exceptionCount,
            weekly_active_transitions: finalizedSummary.trendWeeklyActive,
            sample_count: finalizedSummary.sampleRows.length,
            recipient_count: recipients.length,
            delivered_recipient_count: deliveredRecipients,
          },
        });
        await pushAuditError(subscription.id, "report_summary_run_completed_audit_failed", {
          organizationId: subscription.organization_id,
          actorUserId: subscription.user_id,
          action: "report_run.completed",
          targetType: "report_run",
          targetId: createdReportRunId,
          outcome: "success",
          safeMetadata: { recipient_count: recipients.length, delivered_recipient_count: deliveredRecipients },
        });
        await pushTelemetryError(subscription.id, "report_summary_success_telemetry_failed", {
          organizationId: subscription.organization_id,
          userId: subscription.user_id,
          action: "product.v10.report_run_completed",
          details: {
            status: "succeeded",
            report_mode: "saved_view",
            item_count: finalizedSummary.count,
            recipient_count: recipients.length,
            delivered_recipient_count: deliveredRecipients,
          },
        });
        sent += 1;
      } catch (error) {
        errors.push(
          reportError(
            subscription.id,
            "handler",
            "report_summary_subscription_failed",
            safeErrorMessage(error) ?? "report summary subscription failed"
          )
        );
        if (reportRunId) {
          refreshOrganizations.add(subscription.organization_id);
          await updateReportRun(reportRunId, subscription.id, "report_summary_run_unhandled_failure_update_failed", {
            status: "failed",
            finished_at: new Date().toISOString(),
            error_summary: "Subscription processing failed",
          });
        }
      }
    };

    const pageResult = await forEachSupabaseRangePage<ReportSubscriptionRow>(
      (from, to) =>
        admin
          .from("report_subscriptions")
          .select(
            "id, saved_view_id, user_id, organization_id, frequency, next_run_at, recipient_emails, saved_views!inner(id, name, view_type, query_json)"
          )
          .eq("active", true)
          .in("frequency", ["weekly", "monthly"])
          .lte("next_run_at", nowIso)
          .order("next_run_at", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to),
      async (chunk) => {
        candidates += chunk.length;
        const userIds = [...new Set(chunk.map((row) => row.user_id).filter(Boolean))];
        const profileByUserId = new Map<string, string>();
        if (userIds.length > 0) {
          const profileResult = await admin.from("profiles").select("id, email").in("id", userIds);
          if (profileResult.error) {
            errors.push(
              reportError(
                `profiles:${userIds.length}`,
                "source_query",
                "report_summary_profile_query_failed",
                profileResult.error.message
              )
            );
          } else {
            for (const profile of profileResult.data ?? []) {
              if (profile.email) profileByUserId.set(profile.id, profile.email);
            }
          }
        }

        await executeBatch(chunk, async (subscription) => {
          await processSubscription(subscription, profileByUserId);
        });
      },
      { pageSize: DUE_SUBSCRIPTION_PAGE_SIZE, maxOffsetExclusive: MAX_DUE_SUBSCRIPTION_OFFSET_EXCLUSIVE }
    );

    if (pageResult.error) {
      captureServerMessage(pageResult.error.message, {
        level: "error",
        extra: { route: "reports/send-summaries", phase: "query_subscriptions" },
      });
      return {
        status: 500,
        ok: false,
        errorsCount: 1,
        phase: "source_query",
        body: {
          error: "Could not load subscriptions",
          code: "report_subscription_query_failed",
          diagnostic_id: "report_subscription_query_failed",
        },
      };
    }

    for (const organizationId of refreshOrganizations) {
      try {
        await refreshV10ReportDeliveryReadModels(admin, organizationId, "report_delivery_batch");
      } catch (error) {
        errors.push(
          reportError(
            organizationId,
            "refresh",
            "report_summary_refresh_failed",
            safeErrorMessage(error) ?? "report summary refresh failed"
          )
        );
      }
    }

    if (errors.length > 0) {
      captureServerMessage("report summary cron errors", {
        level: "warning",
        extra: { route: "reports/send-summaries", errorCount: errors.length },
      });
    }

    if (candidates === 0) {
      return {
        body: {
          sent: 0,
          candidates: 0,
          truncated: false,
          next_offset: null,
          message: "No due summaries",
        },
      };
    }

    return {
      partial: errors.length > 0 || pageResult.stoppedByOffsetCap,
      errorsCount: errors.length,
      phase: errors[0]?.phase,
      body: {
        sent,
        candidates,
        truncated: pageResult.stoppedByOffsetCap,
        next_offset: pageResult.nextOffset,
        refresh_organizations: refreshOrganizations.size,
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
