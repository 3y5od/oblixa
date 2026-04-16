import { NextResponse } from "next/server";
import {
  RATE_LIMITS,
  getClientIpFromRequest,
  rateLimitCheck,
} from "@/lib/rate-limit";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getOrgMemberRole } from "@/lib/permissions";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
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

  const { data: memberships, error: membershipError } = await admin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id);
  if (membershipError) {
    return NextResponse.json({ error: "Could not verify organization access" }, { status: 500 });
  }
  const orgIds = [...new Set((memberships ?? []).map((m) => String(m.organization_id)).filter(Boolean))];
  if (orgIds.length === 0) {
    return NextResponse.json({ error: "No organization membership" }, { status: 403 });
  }

  const { data: contract, error: contractError } = await admin
    .from("contracts")
    .select("id, organization_id, contract_type")
    .eq("id", contractId)
    .in("organization_id", orgIds)
    .maybeSingle();
  if (contractError) {
    return NextResponse.json({ error: "Failed to load contract" }, { status: 500 });
  }
  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });

  const role = await getOrgMemberRole(admin, user.id, contract.organization_id);
  if (!role) return NextResponse.json({ error: "Access denied" }, { status: 403 });
  const modeGate = await requireApiWorkspaceEligibility({
    admin,
    orgId: contract.organization_id,
    role,
    apiPath: "/api/templates/preview",
  });
  if (modeGate) return modeGate;

  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`templates-preview:${user.id}:${ip}`, RATE_LIMITS.templatesPreview);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.max(1, Math.ceil(rl.retryAfterMs / 1000))) },
      }
    );
  }

  const safeType = String(contract.contract_type ?? "").replace(/[^a-zA-Z0-9_\- ]/g, "");
  const typeFilter = `contract_type.eq.${safeType},contract_type.is.null`;

  const [fields, reminders, tasks, existingFields, existingReminders, existingTasks] =
    await Promise.all([
      admin
        .from("field_templates")
        .select("id, field_name, default_value, required")
        .eq("organization_id", contract.organization_id)
        .eq("active", true)
        .or(typeFilter),
      admin
        .from("reminder_templates")
        .select("id, field_name, offset_days, reminder_type")
        .eq("organization_id", contract.organization_id)
        .eq("active", true)
        .or(typeFilter),
      admin
        .from("task_templates")
        .select("id, title, due_offset_days, priority, team_key")
        .eq("organization_id", contract.organization_id)
        .eq("active", true)
        .or(typeFilter),
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
