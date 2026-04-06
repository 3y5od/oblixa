import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { sendReminderEmail } from "@/lib/email";
import { getRequestOrigin } from "@/lib/app-url";
import { authorizeCronRequest } from "@/lib/security/cron-auth";
import * as Sentry from "@sentry/nextjs";

function pingCronMonitor(payload: Record<string, unknown>) {
  const url = process.env.CRON_HEALTHCHECK_URL?.trim();
  if (!url) return;
  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, route: "reminders/send" }),
  }).catch(() => {});
}

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

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );

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
    if (process.env.SENTRY_DSN) {
      Sentry.captureMessage(error.message, {
        level: "error",
        extra: { route: "reminders/send", code: error.code },
      });
    }
    return NextResponse.json(
      { error: "Could not load reminders. Try again later." },
      { status: 500 }
    );
  }

  const list = reminders ?? [];
  const candidates = list.length;

  if (candidates === 0) {
    pingCronMonitor({ ok: true, sent: 0, candidates: 0, skipped_no_email: 0 });
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
    const result = await sendReminderEmail({
      to: recipientEmail,
      contractTitle: contract.title,
      fieldName: field.field_name,
      fieldValue: field.field_value,
      daysUntil,
      contractUrl: `${appUrl}/contracts/${contract.id}${hash}`,
      sourceSnippet: field.source_snippet,
    });

    if (result.error) {
      errors.push(`${reminder.id}: ${result.error.message}`);
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
      if (process.env.SENTRY_DSN) {
        Sentry.captureMessage(markSentErr.message, {
          level: "error",
          extra: { route: "reminders/send", reminderId: reminder.id },
        });
      }
      errors.push(`${reminder.id}: email sent but DB mark failed — ${markSentErr.message}`);
      continue;
    }

    sent++;
  }

  console.info(
    `[reminders/cron] date=${today} candidates=${candidates} sent=${sent} skipped_no_email=${skippedNoEmail} errors=${errors.length}`
  );

  pingCronMonitor({
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
