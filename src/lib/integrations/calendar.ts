import { createAdminClient } from "@/lib/supabase/server";

function formatIcsDate(dateLike: string): string {
  const date = new Date(dateLike);
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}${month}${day}`;
}

function buildEvent(uid: string, date: string, summary: string, description: string): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const safeSummary = summary.replace(/\n/g, " ").replace(/,/g, "\\,");
  const safeDescription = description.replace(/\n/g, "\\n").replace(/,/g, "\\,");
  return [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${formatIcsDate(date)}`,
    `SUMMARY:${safeSummary}`,
    `DESCRIPTION:${safeDescription}`,
    "END:VEVENT",
  ].join("\r\n");
}

export async function buildOrganizationCalendarIcs(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  orgId: string
) {
  const [remindersRes, obligationsRes, renewalsRes] = await Promise.all([
    admin
      .from("reminders")
      .select("id, reminder_date, reminder_type, contracts!inner(id, title, organization_id)")
      .eq("contracts.organization_id", orgId),
    admin
      .from("contract_obligations")
      .select("id, title, due_date, contracts!inner(id, title, organization_id)")
      .eq("organization_id", orgId)
      .in("status", ["open", "in_progress"])
      .not("due_date", "is", null),
    admin
      .from("contract_renewal_checkpoints")
      .select("id, label, due_date, contracts!inner(id, title, organization_id)")
      .eq("organization_id", orgId)
      .eq("status", "pending"),
  ]);

  const events: string[] = [];

  for (const row of remindersRes.data ?? []) {
    const contract = (Array.isArray(row.contracts) ? row.contracts[0] : row.contracts) as
      | { id: string; title: string }
      | undefined;
    if (!contract) continue;
    events.push(
      buildEvent(
        `reminder-${row.id}@contractops`,
        row.reminder_date,
        `${row.reminder_type.replace(/_/g, " ")} — ${contract.title}`,
        `Reminder for contract ${contract.title}`
      )
    );
  }
  for (const row of obligationsRes.data ?? []) {
    const contract = (Array.isArray(row.contracts) ? row.contracts[0] : row.contracts) as
      | { id: string; title: string }
      | undefined;
    if (!contract || !row.due_date) continue;
    events.push(
      buildEvent(
        `obligation-${row.id}@contractops`,
        row.due_date,
        `Obligation due — ${row.title}`,
        `Contract: ${contract.title}`
      )
    );
  }
  for (const row of renewalsRes.data ?? []) {
    const contract = (Array.isArray(row.contracts) ? row.contracts[0] : row.contracts) as
      | { id: string; title: string }
      | undefined;
    if (!contract) continue;
    events.push(
      buildEvent(
        `renewal-${row.id}@contractops`,
        row.due_date,
        `Renewal checkpoint — ${row.label}`,
        `Contract: ${contract.title}`
      )
    );
  }

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ContractOps//Contract Calendar//EN",
    "CALSCALE:GREGORIAN",
    ...events,
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
