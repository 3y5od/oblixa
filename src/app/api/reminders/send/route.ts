import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { sendReminderEmail } from "@/lib/email";
import { getRequestOrigin } from "@/lib/app-url";
import { authorizeCronRequest } from "@/lib/security/cron-auth";
import {
  getSupabasePublicEnv,
  getSupabaseServiceRoleKey,
} from "@/lib/env/server";
import { captureServerMessage } from "@/lib/observability/sentry";
import { pingCronHealthcheck } from "@/lib/observability/cron-healthcheck";
import { isNotificationAllowed } from "@/lib/notification-policy";
import { createAdminClient } from "@/lib/supabase/server";
import { deliverWithRetries, markNotificationSuppressed } from "@/lib/notification-delivery";

function authorizeCron(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return false;
  }
  return authorizeCronRequest(request, cronSecret);
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "Server misconfigured: CRON_SECRET is not set" },
      { status: 500 }
    );
  }

  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let supabaseUrl: string;
  let serviceRoleKey: string;
  try {
    ({ url: supabaseUrl } = getSupabasePublicEnv());
    serviceRoleKey = getSupabaseServiceRoleKey();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Supabase env misconfigured";
    console.error("[reminders/cron] configuration error:", message);
    return NextResponse.json(
      { error: "Server misconfigured for reminder delivery" },
      { status: 500 }
    );
  }
  const supabase = createServerClient(supabaseUrl, serviceRoleKey, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
  const admin = await createAdminClient();

  const today = new Date().toISOString().split("T")[0];

  const { data: reminders, error } = await supabase
    .from("reminders")
    .select(
      "id, field_id, recipient_id, reminder_type, reminder_date, contracts!inner(id, title, organization_id), extracted_fields:field_id(field_name, field_value, source_snippet)"
    )
    .lte("reminder_date", today)
    .is("sent_at", null);

  if (error) {
    console.error("[reminders/cron] query error:", error.message);
    captureServerMessage(error.message, {
      level: "error",
      extra: { route: "reminders/send", code: error.code },
    });
    return NextResponse.json(
      { error: "Could not load reminders. Try again later." },
      { status: 500 }
    );
  }

  const list = reminders ?? [];
  const candidates = list.length;

  if (candidates === 0) {
    pingCronHealthcheck("reminders/send", {
      ok: true,
      sent: 0,
      candidates: 0,
      skipped_no_email: 0,
    });
    return NextResponse.json({
      sent: 0,
      candidates: 0,
      skipped_no_email: 0,
      message: "No due reminders",
    });
  }

  let sent = 0;
  let skippedNoEmail = 0;
  const errors: string[] = [];

  const recipientIds = [
    ...new Set(
      list.map((r) => r.recipient_id).filter((id): id is string => !!id)
    ),
  ];

  const emailMap = new Map<string, string>();
  if (recipientIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", recipientIds);
    for (const p of profiles ?? []) {
      if (p.email) emailMap.set(p.id, p.email);
    }
  }

  for (const reminder of list) {
    const contractRaw = reminder.contracts as unknown;
    const contract = (
      Array.isArray(contractRaw) ? contractRaw[0] : contractRaw
    ) as { id: string; title: string };
    const fieldRaw = reminder.extracted_fields as unknown;
    const field = (
      Array.isArray(fieldRaw) ? fieldRaw[0] : fieldRaw
    ) as {
      field_name: string;
      field_value: string;
      source_snippet: string | null;
    } | null;

    if (!contract?.id || !field?.field_value) {
      continue;
    }

    const targetDate = new Date(field.field_value);
    if (Number.isNaN(targetDate.getTime())) {
      errors.push(`${reminder.id}: invalid date in field_value`);
      continue;
    }

    const recipientEmail = reminder.recipient_id
      ? (emailMap.get(reminder.recipient_id) ?? null)
      : null;

    if (!recipientEmail) {
      skippedNoEmail++;
      continue;
    }

    const daysUntil = Math.max(
      0,
      Math.ceil(
        (targetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
    );

    const appUrl = getRequestOrigin(request);
    const hash =
      reminder.field_id != null ? `#field-${reminder.field_id}` : "";
    const contractOrg = (contractRaw as { organization_id?: string } | undefined)?.organization_id;
    if (contractOrg) {
      const { data: priorDelivery } = await admin
        .from("notification_deliveries")
        .select("id")
        .eq("organization_id", contractOrg)
        .eq("notification_type", "reminder_due")
        .eq("status", "delivered")
        .contains("metadata", { reminder_id: reminder.id })
        .limit(1)
        .maybeSingle();
      if (priorDelivery) {
        await supabase
          .from("reminders")
          .update({ sent_at: new Date().toISOString() })
          .eq("id", reminder.id);
        continue;
      }
    }
    if (contractOrg) {
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
        continue;
      }
    }
    const result = contractOrg
      ? await deliverWithRetries(admin, {
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
        })
      : { delivered: false, error: "missing organization id" };
    if (!result.delivered) {
      errors.push(`${reminder.id}: ${result.error ?? "delivery failed"}`);
      continue;
    }

    const { error: markSentErr } = await supabase
      .from("reminders")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", reminder.id);

    if (markSentErr) {
      console.error(
        `[reminders/cron] sent email but failed to mark sent_at for ${reminder.id}:`,
        markSentErr.message
      );
      captureServerMessage(markSentErr.message, {
        level: "error",
        extra: { route: "reminders/send", reminderId: reminder.id },
      });
      errors.push(`${reminder.id}: email sent but DB mark failed — ${markSentErr.message}`);
      continue;
    }

    if (contractOrg) {
      await supabase.from("outbound_events").insert({
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
    }

    sent++;
  }

  console.info(
    `[reminders/cron] date=${today} candidates=${candidates} sent=${sent} skipped_no_email=${skippedNoEmail} errors=${errors.length}`
  );

  pingCronHealthcheck("reminders/send", {
    ok: errors.length === 0,
    sent,
    candidates,
    skipped_no_email: skippedNoEmail,
    error_count: errors.length,
  });

  return NextResponse.json({
    sent,
    candidates,
    skipped_no_email: skippedNoEmail,
    errors: errors.length ? errors : undefined,
  });
}
