"use server";

import { createAdminClient, createClient, getOrEnsureDeterministicMembership } from "@/lib/supabase/server";
import { canEditContracts, getOrgMemberRole } from "@/lib/permissions";
import { mapDataSourceError } from "@/lib/errors/user-facing";
import { isUuid, parsePositiveIntParam, validateBoundedString } from "@/lib/security/validation";
import { runTaskAutomationRulesForOrg as runTaskAutomationRulesForOrgEngine } from "@/lib/tasks/run-task-automation-rules-for-org";

/** Outbound Slack/email from this module should pass `isNotificationAllowed` (workspace mode tiers in `notification-product-tier.ts`). */

type TriggerType =
  | "field_missing"
  | "field_changed"
  | "date_window"
  | "ownership_change"
  | "renewal_window"
  | "approval_stall"
  | "risk_threshold"
  | "data_quality_gap";

const MAX_RULE_NAME_LEN = 240;
const MAX_CONFIG_JSON_SIZE = 10000;
const MAX_AUTOMATION_FIELD_LEN = 160;
const MAX_AUTOMATION_TASK_TITLE_LEN = 240;
const MAX_AUTOMATION_TASK_DETAILS_LEN = 2000;
const MAX_AUTOMATION_DAY_WINDOW = 3650;
const MAX_AUTOMATION_STALL_HOURS = 8760;

const TRIGGERS: TriggerType[] = [
  "field_missing",
  "field_changed",
  "date_window",
  "ownership_change",
  "renewal_window",
  "approval_stall",
  "risk_threshold",
  "data_quality_gap",
];

export async function createTaskAutomationRule(input: {
  name: string;
  triggerType: TriggerType;
  configJson: Record<string, unknown>;
}) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!TRIGGERS.includes(input.triggerType)) return { error: "Invalid trigger type" };
  const nameValidation = validateBoundedString(input.name, { maxLength: MAX_RULE_NAME_LEN });
  if (!nameValidation.ok) {
    if (nameValidation.error === "string_too_long") return { error: "Rule name is too long" };
    if (nameValidation.error === "unsafe_characters") return { error: "Rule name contains unsupported characters" };
    return { error: "Name is required" };
  }
  if (JSON.stringify(input.configJson).length > MAX_CONFIG_JSON_SIZE) return { error: "Rule configuration is too large" };

  const membership = await getOrEnsureDeterministicMembership(admin, user);
  if (!membership || !canEditContracts(membership.role as "admin" | "editor" | "viewer")) {
    return { error: "Access denied" };
  }

  const { error } = await admin.from("task_automation_rules").insert({
    organization_id: membership.organization_id,
    name: nameValidation.value,
    trigger_type: input.triggerType,
    config_json: input.configJson ?? {},
    active: true,
    created_by: user.id,
  });
  if (error) return { error: mapDataSourceError(error.message) };
  return { success: true as const };
}

export async function createTaskAutomationRuleForm(formData: FormData) {
  const nameValidation = validateBoundedString(formData.get("name") ?? "", { maxLength: MAX_RULE_NAME_LEN });
  const triggerType = String(formData.get("triggerType") ?? "");
  const requiredFieldValidation = validateBoundedString(formData.get("requiredField") ?? "", {
    maxLength: MAX_AUTOMATION_FIELD_LEN,
    allowEmpty: true,
  });
  const fieldNameValidation = validateBoundedString(formData.get("fieldName") ?? "", {
    maxLength: MAX_AUTOMATION_FIELD_LEN,
    allowEmpty: true,
  });
  const teamKeyValidation = validateBoundedString(formData.get("teamKey") ?? "", {
    maxLength: MAX_AUTOMATION_FIELD_LEN,
    allowEmpty: true,
  });
  const taskTitleValidation = validateBoundedString(formData.get("taskTitle") ?? "", {
    maxLength: MAX_AUTOMATION_TASK_TITLE_LEN,
    allowEmpty: true,
  });
  const taskDetailsValidation = validateBoundedString(formData.get("taskDetails") ?? "", {
    maxLength: MAX_AUTOMATION_TASK_DETAILS_LEN,
    allowEmpty: true,
    allowTextWhitespaceControls: true,
  });
  const webhookEventTypeValidation = validateBoundedString(formData.get("webhookEventType") ?? "", {
    maxLength: MAX_AUTOMATION_FIELD_LEN,
    allowEmpty: true,
  });
  const actionTypeValidation = validateBoundedString(formData.get("actionType") ?? "create_task", {
    maxLength: MAX_AUTOMATION_FIELD_LEN,
  });
  const reportModeValidation = validateBoundedString(formData.get("reportMode") ?? "exceptions", {
    maxLength: MAX_AUTOMATION_FIELD_LEN,
  });
  if (
    !nameValidation.ok ||
    !requiredFieldValidation.ok ||
    !fieldNameValidation.ok ||
    !teamKeyValidation.ok ||
    !taskTitleValidation.ok ||
    !taskDetailsValidation.ok ||
    !webhookEventTypeValidation.ok ||
    !actionTypeValidation.ok ||
    !reportModeValidation.ok
  ) {
    return;
  }
  const windowDays = parsePositiveIntParam(String(formData.get("windowDays") ?? "").trim(), {
    defaultValue: 0,
    min: 0,
    max: MAX_AUTOMATION_DAY_WINDOW,
  });
  const lookbackDays = parsePositiveIntParam(String(formData.get("lookbackDays") ?? "").trim(), {
    defaultValue: 2,
    min: 0,
    max: MAX_AUTOMATION_DAY_WINDOW,
  });
  const dueInDays = parsePositiveIntParam(String(formData.get("dueInDays") ?? "").trim(), {
    defaultValue: 0,
    min: 0,
    max: MAX_AUTOMATION_DAY_WINDOW,
  });
  const stallHours = parsePositiveIntParam(String(formData.get("stallHours") ?? "").trim(), {
    defaultValue: 24,
    min: 0,
    max: MAX_AUTOMATION_STALL_HOURS,
  });
  const minCompleteness = parsePositiveIntParam(String(formData.get("minCompleteness") ?? "").trim(), {
    defaultValue: 80,
    min: 0,
    max: 100,
  });
  const name = nameValidation.value;
  const requiredField = requiredFieldValidation.value;
  const fieldName = fieldNameValidation.value;
  const teamKey = teamKeyValidation.value;
  const taskTitle = taskTitleValidation.value;
  const taskDetails = taskDetailsValidation.value;
  const webhookEventType = webhookEventTypeValidation.value;
  const actionType = actionTypeValidation.value;
  const reportMode = reportModeValidation.value;
  if (!TRIGGERS.includes(triggerType as TriggerType)) {
    console.error("[automation] createTaskAutomationRuleForm: invalid triggerType");
    return;
  }
  const res = await createTaskAutomationRule({
    name,
    triggerType: triggerType as TriggerType,
    configJson: {
      requiredField: requiredField || null,
      fieldName: fieldName || null,
      windowDays,
      lookbackDays,
      teamKey: teamKey || null,
      dueInDays,
      stallHours,
      minCompleteness,
      taskTitle: taskTitle || "Follow-up required",
      taskDetails: taskDetails || "",
      webhookEventType: webhookEventType || null,
      actionType:
        actionType === "trigger_report" || actionType === "notify_only"
          ? actionType
          : "create_task",
      reportMode:
        reportMode === "saved_view" || reportMode === "management" ? reportMode : "exceptions",
    },
  });
  if (res && "error" in res && res.error) {
    console.error("[automation] createTaskAutomationRuleForm", res.error);
  }
}

export async function toggleTaskAutomationRule(ruleId: string, active: boolean) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(ruleId)) return { error: "Invalid rule" };

  const { data: rule } = await admin
    .from("task_automation_rules")
    .select("id, organization_id")
    .eq("id", ruleId)
    .maybeSingle();
  if (!rule) return { error: "Rule not found" };

  const role = await getOrgMemberRole(admin, user.id, rule.organization_id);
  if (!canEditContracts(role)) return { error: "Access denied" };

  const { error } = await admin
    .from("task_automation_rules")
    .update({ active })
    .eq("id", ruleId);
  if (error) return { error: mapDataSourceError(error.message) };
  return { success: true as const };
}

export async function toggleTaskAutomationRuleForm(ruleId: string, active: boolean) {
  const res = await toggleTaskAutomationRule(ruleId, active);
  if (res && "error" in res && res.error) {
    console.error("[automation] toggleTaskAutomationRuleForm", res.error);
  }
}

export async function runTaskAutomationRulesForOrg(admin: Awaited<ReturnType<typeof createAdminClient>>, orgId: string) {
  return runTaskAutomationRulesForOrgEngine(admin, orgId);
}
