import { NextResponse } from "next/server";
import { jsonForbidden, jsonNotFound, jsonProblem, jsonRateLimited, jsonUnauthorized } from "@/lib/http/problem";
import {
  RATE_LIMITS,
  getClientIpFromRequest,
  rateLimitCheck,
} from "@/lib/rate-limit";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getOrgMemberRole } from "@/lib/permissions";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { isUuid } from "@/lib/security/validation";

const ROUTE = "/api/templates/preview";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const contractId = url.searchParams.get("contractId")?.trim() ?? "";
  if (!isUuid(contractId)) {
    return jsonProblem(400, {
      error: "Invalid contractId",
      code: "invalid_contract_id",
      diagnostic_id: "templates_preview_contract_id_invalid",
      route: ROUTE,
    });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonUnauthorized(ROUTE);

  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`templates-preview:${user.id}:${ip}`, RATE_LIMITS.templatesPreview);
  if (!rl.ok) {
    return jsonRateLimited(rl.retryAfterMs, ROUTE);
  }

  const admin = await createAdminClient();

  const { data: memberships, error: membershipError } = await admin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id);
  if (membershipError) {
    return jsonProblem(500, {
      error: "Could not verify organization access",
      code: "organization_access_check_failed",
      diagnostic_id: "templates_preview_org_access_check_failed",
      route: ROUTE,
    });
  }
  const orgIds = [...new Set((memberships ?? []).map((m) => String(m.organization_id)).filter(Boolean))];
  if (orgIds.length === 0) {
    return jsonForbidden(ROUTE);
  }

  const { data: contract, error: contractError } = await admin
    .from("contracts")
    .select("id, organization_id, contract_type")
    .eq("id", contractId)
    .in("organization_id", orgIds)
    .maybeSingle();
  if (contractError) {
    return jsonProblem(500, {
      error: "Failed to load contract",
      code: "contract_load_failed",
      diagnostic_id: "templates_preview_contract_load_failed",
      route: ROUTE,
    });
  }
  if (!contract) return jsonNotFound(ROUTE);

  const role = await getOrgMemberRole(admin, user.id, contract.organization_id);
  if (!role) return jsonForbidden(ROUTE);
  const modeGate = await requireApiWorkspaceEligibility({
    admin,
    orgId: contract.organization_id,
    role,
    apiPath: "/api/templates/preview",
  });
  if (modeGate) return modeGate;

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
        .eq("contract_id", contractId)
        .eq("organization_id", contract.organization_id),
      admin
        .from("reminders")
        .select("reminder_type")
        .eq("contract_id", contractId)
        .eq("organization_id", contract.organization_id),
      admin
        .from("contract_tasks")
        .select("title")
        .eq("contract_id", contractId)
        .eq("organization_id", contract.organization_id)
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
    return jsonProblem(500, {
      error: "Failed to compute template preview",
      code: "template_preview_compute_failed",
      diagnostic_id: "template_preview_compute_failed",
      route: ROUTE,
    });
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
