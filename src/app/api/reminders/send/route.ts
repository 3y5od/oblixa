import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { sendReminderEmail } from "@/lib/email";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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
      "*, contracts!inner(id, title, organization_id), extracted_fields:field_id(field_name, field_value)"
    )
    .lte("reminder_date", today)
    .is("sent_at", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!reminders?.length) {
    return NextResponse.json({ sent: 0 });
  }

  let sent = 0;
  const errors: string[] = [];

  const recipientIds = [
    ...new Set(
      reminders
        .map((r) => r.recipient_id)
        .filter((id): id is string => !!id)
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

  for (const reminder of reminders) {
    const contract = reminder.contracts as { id: string; title: string };
    const field = reminder.extracted_fields as {
      field_name: string;
      field_value: string;
    } | null;

    if (!field?.field_value) continue;

    const recipientEmail = reminder.recipient_id
      ? emailMap.get(reminder.recipient_id) ?? null
      : null;

    if (!recipientEmail) continue;

    const targetDate = new Date(field.field_value);
    const daysUntil = Math.max(
      0,
      Math.ceil(
        (targetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
    );

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const result = await sendReminderEmail({
      to: recipientEmail,
      contractTitle: contract.title,
      fieldName: field.field_name,
      fieldValue: field.field_value,
      daysUntil,
      contractUrl: `${appUrl}/contracts/${contract.id}`,
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

  return NextResponse.json({ sent, errors: errors.length ? errors : undefined });
}
