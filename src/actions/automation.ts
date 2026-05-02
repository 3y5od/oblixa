"use server";

import { createAdminClient, createClient, getOrEnsureDeterministicMembership } from "@/lib/supabase/server";
import { canEditContracts, getOrgMemberRole } from "@/lib/permissions";
import { mapDataSourceError } from "@/lib/errors/user-facing";
import { isUuid } from "@/lib/security/validation";
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
  if (!input.name.trim()) return { error: "Name is required" };
  if (input.name.length > MAX_RULE_NAME_LEN) return { error: "Rule name is too long" };
  if (JSON.stringify(input.configJson).length > MAX_CONFIG_JSON_SIZE) return { error: "Rule configuration is too large" };

  const membership = await getOrEnsureDeterministicMembership(admin, user);
  if (!membership || !canEditContracts(membership.role as "admin" | "editor" | "viewer")) {
    return { error: "Access denied" };
  }

  const { error } = await admin.from("task_automation_rules").insert({
    organization_id: membership.organization_id,
    name: input.name.trim(),
    trigger_type: input.triggerType,
    config_json: input.configJson ?? {},
    active: true,
    created_by: user.id,
  });
  if (error) return { error: mapDataSourceError(error.message) };
  return { success: true as const };
}

export async function createTaskAutomationRuleForm(formData: FormData) {
  const name = String(formData.get("name") ?? "");
  const triggerType = String(formData.get("triggerType") ?? "");
  const requiredField = String(formData.get("requiredField") ?? "").trim();
  const fieldName = String(formData.get("fieldName") ?? "").trim();
  const windowDays = Number(String(formData.get("windowDays") ?? "").trim() || "0");
  const lookbackDays = Number(String(formData.get("lookbackDays") ?? "").trim() || "2");
  const teamKey = String(formData.get("teamKey") ?? "").trim();
  const dueInDays = Number(String(formData.get("dueInDays") ?? "").trim() || "0");
  const stallHours = Number(String(formData.get("stallHours") ?? "").trim() || "24");
  const minCompleteness = Number(String(formData.get("minCompleteness") ?? "").trim() || "80");
  const taskTitle = String(formData.get("taskTitle") ?? "").trim();
  const taskDetails = String(formData.get("taskDetails") ?? "").trim();
  const webhookEventType = String(formData.get("webhookEventType") ?? "").trim();
  const actionType = String(formData.get("actionType") ?? "create_task").trim();
  const reportMode = String(formData.get("reportMode") ?? "exceptions").trim();
  if (!TRIGGERS.includes(triggerType as TriggerType)) {
    console.error("[automation] createTaskAutomationRuleForm: invalid triggerType", triggerType);
    return;
  }
  const res = await createTaskAutomationRule({
    name,
    triggerType: triggerType as TriggerType,
    configJson: {
      requiredField: requiredField || null,
      fieldName: fieldName || null,
      windowDays: Number.isFinite(windowDays) ? windowDays : 0,
      lookbackDays: Number.isFinite(lookbackDays) ? lookbackDays : 2,
      teamKey: teamKey || null,
      dueInDays: Number.isFinite(dueInDays) ? dueInDays : 0,
      stallHours: Number.isFinite(stallHours) ? stallHours : 24,
      minCompleteness: Number.isFinite(minCompleteness) ? minCompleteness : 80,
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
