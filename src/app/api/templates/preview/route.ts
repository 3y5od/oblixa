import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getOrgMemberRole } from "@/lib/permissions";
import { isUuid } from "@/lib/security/validation";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const contractId = url.searchParams.get("contractId")?.trim() ?? "";
  if (!isUuid(contractId)) {
    return NextResponse.json({ error: "Invalid contractId" }, { status: 400 });
  }

  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: contract, error: contractError } = await admin
    .from("contracts")
    .select("id, organization_id, contract_type")
    .eq("id", contractId)
    .maybeSingle();
  if (contractError) {
    return NextResponse.json({ error: "Failed to load contract" }, { status: 500 });
  }
  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });

  const role = await getOrgMemberRole(admin, user.id, contract.organization_id);
  if (!role) return NextResponse.json({ error: "Access denied" }, { status: 403 });

  const [fields, reminders, tasks, existingFields, existingReminders, existingTasks] =
    await Promise.all([
      admin
        .from("field_templates")
        .select("id, field_name, default_value, required")
        .eq("organization_id", contract.organization_id)
        .eq("active", true)
        .or(`contract_type.eq.${contract.contract_type},contract_type.is.null`),
      admin
        .from("reminder_templates")
        .select("id, field_name, offset_days, reminder_type")
        .eq("organization_id", contract.organization_id)
        .eq("active", true)
        .or(`contract_type.eq.${contract.contract_type},contract_type.is.null`),
      admin
        .from("task_templates")
        .select("id, title, due_offset_days, priority, team_key")
        .eq("organization_id", contract.organization_id)
        .eq("active", true)
        .or(`contract_type.eq.${contract.contract_type},contract_type.is.null`),
      admin
        .from("extracted_fields")
        .select("field_name")
        .eq("contract_id", contractId),
      admin
        .from("reminders")
        .select("reminder_type")
        .eq("contract_id", contractId),
      admin
        .from("contract_tasks")
        .select("title")
        .eq("contract_id", contractId)
        .in("status", ["open", "in_progress", "blocked"]),
    ]);
  if (
    fields.error ||
    reminders.error ||
    tasks.error ||
    existingFields.error ||
    existingReminders.error ||
    existingTasks.error
  ) {
    return NextResponse.json({ error: "Failed to compute template preview" }, { status: 500 });
  }

  const existingFieldSet = new Set((existingFields.data ?? []).map((f) => f.field_name));
  const existingReminderSet = new Set((existingReminders.data ?? []).map((r) => r.reminder_type));
  const existingTaskSet = new Set((existingTasks.data ?? []).map((t) => t.title.toLowerCase()));

  const fieldToAdd = (fields.data ?? []).filter((f) => !existingFieldSet.has(f.field_name));
  const reminderToAdd = (reminders.data ?? []).filter((r) => !existingReminderSet.has(r.reminder_type));
  const taskToAdd = (tasks.data ?? []).filter((t) => !existingTaskSet.has(t.title.toLowerCase()));

  return NextResponse.json({
    contractId,
    counts: {
      fields: fieldToAdd.length,
      reminders: reminderToAdd.length,
      tasks: taskToAdd.length,
    },
    preview: {
      fields: fieldToAdd.slice(0, 20),
      reminders: reminderToAdd.slice(0, 20),
      tasks: taskToAdd.slice(0, 20),
    },
  });
}
