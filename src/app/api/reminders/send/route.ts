import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { sendReminderEmail } from "@/lib/email";

function authorizeCron(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return false;
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${cronSecret}`) {
    return true;
  }
  const headerSecret = request.headers.get("x-cron-secret");
  if (headerSecret === cronSecret) {
    return true;
  }
  return false;
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const list = reminders ?? [];
  const candidates = list.length;

  if (candidates === 0) {
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

    const recipientEmail = reminder.recipient_id
      ? (emailMap.get(reminder.recipient_id) ?? null)
      : null;

    if (!recipientEmail) {
      skippedNoEmail++;
      continue;
    }

    const targetDate = new Date(field.field_value);
    const daysUntil = Math.max(
      0,
      Math.ceil(
        (targetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
    );

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
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

    await supabase
      .from("reminders")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", reminder.id);

    sent++;
  }

  console.info(
    `[reminders/cron] date=${today} candidates=${candidates} sent=${sent} skipped_no_email=${skippedNoEmail} errors=${errors.length}`
  );

  return NextResponse.json({
    sent,
    candidates,
    skipped_no_email: skippedNoEmail,
    errors: errors.length ? errors : undefined,
  });
}
