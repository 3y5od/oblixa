import type { createAdminClient } from "@/lib/supabase/server";
import { withCronRoute } from "@/lib/cron/route-runner";
import { sendReminderEmail } from "@/lib/email";
import { getCanonicalServerBaseUrl } from "@/lib/app-url";
import { captureServerMessage } from "@/lib/observability/sentry";
import { isNotificationAllowed } from "@/lib/notification-policy";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { deliverWithRetries, markNotificationSuppressed } from "@/lib/notification-delivery";
import {
  executeBatch,
  safeErrorMessage,
  type BatchItemError,
} from "@/lib/route-runtime-contract";
import { forEachSupabaseRangePage } from "@/lib/supabase/range-pagination";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;
type ReminderRow = {
  id: string;
  field_id: string | null;
  recipient_id: string | null;
  reminder_type: string;
  reminder_date: string;
  contracts:
    | { id: string; title: string; organization_id?: string | null }
    | Array<{ id: string; title: string; organization_id?: string | null }>
    | null;
  extracted_fields:
    | { field_name: string; field_value: string; source_snippet: string | null }
    | Array<{ field_name: string; field_value: string; source_snippet: string | null }>
    | null;
};

function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

async function markReminderSent(admin: AdminClient, reminderId: string) {
  return admin
    .from("reminders")
    .update({ sent_at: new Date().toISOString() })
    .eq("id", reminderId)
    .is("sent_at", null);
}

async function lookupExistingReminderDelivery(admin: AdminClient, organizationId: string, reminderId: string) {
  return admin
    .from("notification_deliveries")
    .select("id, status")
    .eq("organization_id", organizationId)
    .eq("notification_type", "reminder_due")
    .contains("metadata", { reminder_id: reminderId })
    .in("status", ["pending", "retrying", "delivered"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
}

export const GET = withCronRoute({
  route: "/api/reminders/send",
  rateLimitKey: "cron:reminders:send",
  rateLimit: RATE_LIMITS.remindersSendCron,
  dependencyPreflight: () => {
    const appUrl = getCanonicalServerBaseUrl();
    if (!appUrl) {
      return {
        error: "Canonical app URL is not configured",
        code: "dependency_blocked",
        diagnostic_id: "reminders_send_canonical_app_url_missing",
        details: {
          dependency: "canonical_app_url",
          required_env: ["NEXT_PUBLIC_APP_URL", "APP_BASE_URL", "VERCEL_PROJECT_PRODUCTION_URL"],
          degraded_policy: "503 dependency_blocked",
        },
      };
    }
    if (!String(process.env.RESEND_API_KEY ?? "").trim()) {
      return {
        error: "Reminder email provider is not configured",
        code: "dependency_blocked",
        diagnostic_id: "reminders_send_resend_missing",
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
  handler: async ({ request, admin }) => {
    void request;
    const today = new Date().toISOString().split("T")[0];
    const appUrl = getCanonicalServerBaseUrl()!;
    let candidates = 0;
    let sent = 0;
    let skippedNoEmail = 0;
    let skippedOther = 0;
    const errors: BatchItemError[] = [];

    const pageResult = await forEachSupabaseRangePage<ReminderRow>(
      (from, to) =>
        admin
          .from("reminders")
          .select(
            "id, field_id, recipient_id, reminder_type, reminder_date, contracts!inner(id, title, organization_id), extracted_fields:field_id(field_name, field_value, source_snippet)"
          )
          .lte("reminder_date", today)
          .is("sent_at", null)
          .order("reminder_date", { ascending: true })
          .range(from, to),
      async (chunk) => {
        candidates += chunk.length;
        const recipientIds = [
          ...new Set(chunk.map((row) => row.recipient_id).filter((id): id is string => Boolean(id))),
        ];
        const emailMap = new Map<string, string>();
        if (recipientIds.length > 0) {
          const { data: profiles, error: profileErr } = await admin
            .from("profiles")
            .select("id, email")
            .in("id", recipientIds);
          if (profileErr) {
            errors.push({
              scope: `profiles:${recipientIds.length}`,
              phase: "source_query",
              diagnostic_id: "reminders_profile_query_failed",
              message: profileErr.message,
            });
            return;
          }
          for (const profile of profiles ?? []) {
            if (profile.email) emailMap.set(profile.id, profile.email);
          }
        }

        const batch = await executeBatch(chunk, async (reminder) => {
          try {
            const contract = unwrapRelation(reminder.contracts);
            const field = unwrapRelation(reminder.extracted_fields);

            if (!contract?.id || !field?.field_value) {
              skippedOther += 1;
              return "skipped";
            }

            const targetDate = new Date(field.field_value);
            if (Number.isNaN(targetDate.getTime())) {
              return {
                scope: reminder.id,
                phase: "transform",
                diagnostic_id: "reminder_invalid_target_date",
                message: "invalid reminder date in approved field",
              };
            }

            const recipientEmail = reminder.recipient_id ? (emailMap.get(reminder.recipient_id) ?? null) : null;
            if (!recipientEmail) {
              skippedNoEmail += 1;
              return "skipped";
            }

            const contractOrg = contract.organization_id ?? null;
            if (!contractOrg) {
              return {
                scope: reminder.id,
                phase: "transform",
                diagnostic_id: "reminder_contract_org_missing",
                message: "reminder contract organization is missing",
              };
            }

            const { data: priorDelivery, error: priorDeliveryErr } = await lookupExistingReminderDelivery(
              admin,
              contractOrg,
              reminder.id
            );
            if (priorDeliveryErr) {
              return {
                scope: reminder.id,
                phase: "source_query",
                diagnostic_id: "reminder_delivery_dedupe_query_failed",
                message: priorDeliveryErr.message,
              };
            }
            if (priorDelivery?.status === "delivered") {
              const { error: markExistingErr } = await markReminderSent(admin, reminder.id);
              if (markExistingErr) {
                return {
                  scope: reminder.id,
                  phase: "persist",
                  diagnostic_id: "reminder_mark_sent_after_duplicate_failed",
                  message: markExistingErr.message,
                };
              }
              skippedOther += 1;
              return "skipped";
            }
            if (priorDelivery?.status === "pending" || priorDelivery?.status === "retrying") {
              skippedOther += 1;
              return "skipped";
            }

            const allowed = await isNotificationAllowed(admin, {
              organizationId: contractOrg,
              channel: "email",
              notificationType: "reminder_due",
            });
            if (!allowed) {
              await markNotificationSuppressed(admin, {
                organizationId: contractOrg,
                channel: "email",
                notificationType: "reminder_due",
                recipient: recipientEmail,
                subject: `Reminder: ${field.field_name}`,
                metadata: { reminder_id: reminder.id, contract_id: contract.id },
              });
              skippedOther += 1;
              return "skipped";
            }

            const hash = reminder.field_id != null ? `#field-${reminder.field_id}` : "";
            const daysUntil = Math.max(
              0,
              Math.ceil((targetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            );
            const result = await deliverWithRetries(admin, {
              organizationId: contractOrg,
              channel: "email",
              notificationType: "reminder_due",
              recipient: recipientEmail,
              subject: `Reminder: ${field.field_name}`,
              metadata: { reminder_id: reminder.id, contract_id: contract.id, field_name: field.field_name },
              maxAttempts: 3,
              retryPayload: {
                kind: "reminder_due",
                to: recipientEmail,
                contractTitle: contract.title,
                fieldName: field.field_name,
                fieldValue: field.field_value,
                daysUntil,
                contractUrl: `${appUrl}/contracts/${contract.id}${hash}`,
                sourceSnippet: null,
              },
              send: () =>
                sendReminderEmail({
                  to: recipientEmail,
                  contractTitle: contract.title,
                  fieldName: field.field_name,
                  fieldValue: field.field_value,
                  daysUntil,
                  contractUrl: `${appUrl}/contracts/${contract.id}${hash}`,
                  sourceSnippet: field.source_snippet,
                }),
            });
            if (result.duplicate) {
              skippedOther += 1;
              return "skipped";
            }
            if (!result.delivered) {
              return {
                scope: reminder.id,
                phase: "notify",
                diagnostic_id: "reminder_delivery_failed",
                message: result.error ?? "delivery failed",
              };
            }

            const { error: markSentErr } = await markReminderSent(admin, reminder.id);
            if (markSentErr) {
              console.error(
                `[reminders/cron] sent email but failed to mark sent_at for ${reminder.id}:`,
                markSentErr.message
              );
              captureServerMessage(markSentErr.message, {
                level: "error",
                extra: { route: "reminders/send", reminderId: reminder.id },
              });
              return {
                scope: reminder.id,
                phase: "persist",
                diagnostic_id: "reminder_mark_sent_failed",
                message: markSentErr.message,
              };
            }

            const { error: outboundErr } = await admin.from("outbound_events").insert({
              organization_id: contractOrg,
              event_type: "reminder.due",
              entity_type: "reminder",
              entity_id: reminder.id,
              payload: {
                contract_id: contract.id,
                contract_title: contract.title,
                field_name: field.field_name,
                reminder_date: reminder.reminder_date,
              },
            });
            if (outboundErr) {
              return {
                scope: reminder.id,
                phase: "persist",
                diagnostic_id: "reminder_outbound_event_insert_failed",
                message: outboundErr.message,
              };
            }

            sent += 1;
            return "processed";
          } catch (error) {
            return {
              scope: reminder.id,
              phase: "handler",
              diagnostic_id: "reminder_row_unhandled",
              message: safeErrorMessage(error) ?? "unexpected reminder row failure",
            };
          }
        });

        errors.push(...batch.errors);
      },
      { pageSize: 200, maxOffsetExclusive: 20_000 }
    );

    if (pageResult.error) {
      console.error("[reminders/cron] query error:", pageResult.error.message);
      captureServerMessage(pageResult.error.message, {
        level: "error",
        extra: { route: "reminders/send", code: pageResult.error.code },
      });
      if (candidates === 0) {
        return {
          status: 500,
          ok: false,
          errorsCount: 1,
          phase: "source_query",
          body: {
            error: "Could not load reminders. Try again later.",
            code: "reminders_query_failed",
            diagnostic_id: "reminders_query_failed",
          },
        };
      }
      errors.push({
        scope: "reminders",
        phase: "source_query",
        diagnostic_id: "reminders_query_failed",
        message: pageResult.error.message,
      });
    }

    if (candidates === 0) {
      return {
        body: {
          sent: 0,
          candidates: 0,
          processed: 0,
          skipped: 0,
          skipped_no_email: 0,
          failed: 0,
          truncated: false,
          remaining: 0,
          message: "No due reminders",
        },
      };
    }

    const truncated = pageResult.stoppedByOffsetCap;
    const skipped = skippedNoEmail + skippedOther;
    const failed = errors.length;

    console.info(
      `[reminders/cron] date=${today} candidates=${candidates} sent=${sent} skipped=${skipped} skipped_no_email=${skippedNoEmail} errors=${failed} truncated=${truncated}`
    );

    return {
      partial: failed > 0 || truncated,
      errorsCount: failed,
      phase: errors[0]?.phase,
      body: {
        sent,
        candidates,
        processed: sent,
        skipped,
        skipped_no_email: skippedNoEmail,
        failed,
        truncated,
        remaining: truncated ? 1 : 0,
        ...(pageResult.nextOffset !== null ? { next_offset: pageResult.nextOffset } : {}),
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
