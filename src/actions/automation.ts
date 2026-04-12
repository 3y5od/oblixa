"use server";

import { createAdminClient, createClient, getDeterministicMembership } from "@/lib/supabase/server";
import { canEditContracts, getOrgMemberRole } from "@/lib/permissions";
import { mapDataSourceError } from "@/lib/errors/user-facing";
import { isUuid } from "@/lib/security/validation";
import { enqueueOutboundEvent } from "@/lib/integrations/events";
import { sendSlackWorkflowNotification } from "@/lib/integrations/slack";

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

  const membership = await getDeterministicMembership(admin, user.id);
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
  const todayIso = new Date().toISOString().slice(0, 10);

  async function createTaskFromRule(
    contractId: string,
    rule: { id: string; name: string },
    config: Record<string, unknown>,
    reason: string
  ): Promise<boolean> {
    const actionType = String(config.actionType ?? "create_task").trim();
    if (actionType === "trigger_report") {
      const reportMode = String(config.reportMode ?? "exceptions").trim();
      await admin.from("report_runs").insert({
        organization_id: orgId,
        subscription_id: null,
        report_mode:
          reportMode === "saved_view" || reportMode === "management" ? reportMode : "exceptions",
        status: "queued",
        triggered_by: null,
        metrics_json: { reason, trigger: rule.name, source: "automation_rule" },
      });
      await enqueueOutboundEvent({
        organizationId: orgId,
        eventType: "report.queued_by_rule",
        entityType: "task_automation_rule",
        entityId: rule.id,
        payload: { contract_id: contractId, reason, trigger: rule.name },
      });
      return true;
    }
    if (actionType === "notify_only") {
      await enqueueOutboundEvent({
        organizationId: orgId,
        eventType: "automation.notification",
        entityType: "task_automation_rule",
        entityId: rule.id,
        payload: { contract_id: contractId, reason, trigger: rule.name },
      });
      await sendSlackWorkflowNotification(admin, {
        organizationId: orgId,
        title: `Rule alert: ${rule.name}`,
        body: `Contract ${contractId.slice(0, 8)} matched condition: ${reason}`,
        metadata: { contract_id: contractId, rule_id: rule.id },
      });
      return true;
    }
    const title = String(config.taskTitle ?? "Follow-up required");
    const existing = await admin
      .from("contract_tasks")
      .select("id")
      .eq("contract_id", contractId)
      .eq("created_via", "rule")
      .eq("title", title)
      .in("status", ["open", "in_progress", "blocked"])
      .limit(1)
      .maybeSingle();
    if (existing.data) return false;

    const dueInDays = Math.max(0, Number(config.dueInDays ?? 0));
    const dueDate = new Date(Date.now() + dueInDays * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const { data: inserted, error } = await admin
      .from("contract_tasks")
      .insert({
        contract_id: contractId,
        organization_id: orgId,
        created_by: null,
        assignee_id: null,
        title,
        details:
          String(config.taskDetails ?? "").trim() ||
          `Rule '${rule.name}' triggered: ${reason}.`,
        status: "open",
        priority: "medium",
        due_date: dueDate,
        created_via: "rule",
        team_key: String(config.teamKey ?? "ops"),
      })
      .select("id")
      .single();
    if (error || !inserted) return false;

    await admin.from("audit_events").insert({
      organization_id: orgId,
      contract_id: contractId,
      user_id: null,
      action: "task.created_by_rule",
      details: { rule_id: rule.id, task_id: inserted.id, reason },
    });
    await admin.from("contract_task_events").insert({
      organization_id: orgId,
      contract_id: contractId,
      task_id: inserted.id,
      actor_id: null,
      event_type: "created",
      details: { created_via: "rule", rule_id: rule.id, reason },
    });
    await enqueueOutboundEvent({
      organizationId: orgId,
      eventType: "task.created_by_rule",
      entityType: "contract_task",
      entityId: inserted.id,
      payload: { contract_id: contractId, rule_id: rule.id, reason, trigger: rule.name },
    });
    const webhookEventType = String(config.webhookEventType ?? "").trim();
    if (webhookEventType) {
      await enqueueOutboundEvent({
        organizationId: orgId,
        eventType: webhookEventType,
        entityType: "task_automation_rule",
        entityId: rule.id,
        payload: {
          contract_id: contractId,
          task_id: inserted.id,
          reason,
          trigger: rule.name,
        },
      });
    }
    await sendSlackWorkflowNotification(admin, {
      organizationId: orgId,
      title: `Rule triggered: ${rule.name}`,
      body: `Created task "${title}" for contract ${contractId.slice(0, 8)} (${reason}).`,
      metadata: {
        contract_id: contractId,
        task_id: inserted.id,
        rule_id: rule.id,
      },
    });
    return true;
  }

  const { data: rules } = await admin
    .from("task_automation_rules")
    .select("id, name, trigger_type, config_json")
    .eq("organization_id", orgId)
    .eq("active", true);
  if (!rules || rules.length === 0) return { generated: 0, evaluatedRules: 0 };

  let generated = 0;
  let evaluatedRules = 0;
  for (const rule of rules) {
    evaluatedRules++;
    const config = (rule.config_json ?? {}) as Record<string, unknown>;
    if (rule.trigger_type === "field_missing") {
      const requiredField = String(config.requiredField ?? "").trim();
      if (!requiredField) continue;

      const { data: contracts } = await admin
        .from("contracts")
        .select("id")
        .eq("organization_id", orgId)
        .in("status", ["pending_review", "active"])
        .limit(300);
      for (const contract of contracts ?? []) {
        const { data: field } = await admin
          .from("extracted_fields")
          .select("id")
          .eq("contract_id", contract.id)
          .eq("field_name", requiredField)
          .eq("status", "approved")
          .maybeSingle();
        if (field) continue;
        const created = await createTaskFromRule(
          contract.id,
          rule,
          config,
          `missing approved field '${requiredField}'`
        );
        if (created) generated++;
      }
    } else if (rule.trigger_type === "field_changed") {
      const fieldName = String(config.fieldName ?? "").trim();
      const lookbackDays = Math.max(1, Number(config.lookbackDays ?? 3));
      if (!fieldName) continue;
      const sinceIso = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
      const { data: events } = await admin
        .from("audit_events")
        .select("contract_id")
        .eq("organization_id", orgId)
        .eq("action", "field.edited")
        .gte("created_at", sinceIso)
        .contains("details", { field_name: fieldName })
        .not("contract_id", "is", null)
        .limit(500);
      const contractIds = [...new Set((events ?? []).map((evt) => evt.contract_id).filter(Boolean))];
      for (const contractId of contractIds) {
        const created = await createTaskFromRule(
          contractId as string,
          rule,
          config,
          `field '${fieldName}' changed in last ${lookbackDays} day(s)`
        );
        if (created) generated++;
      }
    } else if (rule.trigger_type === "date_window" || rule.trigger_type === "renewal_window") {
      const fieldName =
        rule.trigger_type === "renewal_window"
          ? "renewal_date"
          : String(config.fieldName ?? "end_date").trim();
      const windowDays = Math.max(
        0,
        Number(config.windowDays ?? (rule.trigger_type === "renewal_window" ? 90 : 30))
      );
      const windowEndIso = new Date(
        Date.now() + windowDays * 24 * 60 * 60 * 1000
      ).toISOString().slice(0, 10);
      const { data: fields } = await admin
        .from("extracted_fields")
        .select("contract_id, field_value")
        .eq("field_name", fieldName)
        .eq("status", "approved")
        .not("field_value", "is", null)
        .limit(1000);
      for (const row of fields ?? []) {
        const dateValue = String(row.field_value ?? "").slice(0, 10);
        if (!dateValue) continue;
        if (dateValue < todayIso || dateValue > windowEndIso) continue;
        const { data: contract } = await admin
          .from("contracts")
          .select("id")
          .eq("id", row.contract_id)
          .eq("organization_id", orgId)
          .maybeSingle();
        if (!contract) continue;
        const created = await createTaskFromRule(
          contract.id,
          rule,
          config,
          `${fieldName} is inside ${windowDays} day window`
        );
        if (created) generated++;
      }
    } else if (rule.trigger_type === "ownership_change") {
      const lookbackDays = Math.max(1, Number(config.lookbackDays ?? 2));
      const sinceIso = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
      const { data: events } = await admin
        .from("audit_events")
        .select("contract_id")
        .eq("organization_id", orgId)
        .eq("action", "contract.owner_changed")
        .gte("created_at", sinceIso)
        .not("contract_id", "is", null)
        .limit(500);
      const contractIds = [...new Set((events ?? []).map((e) => e.contract_id).filter(Boolean))];
      for (const contractId of contractIds) {
        const created = await createTaskFromRule(
          contractId as string,
          rule,
          config,
          "contract owner changed recently"
        );
        if (created) generated++;
      }
    } else if (rule.trigger_type === "approval_stall") {
      const stallHours = Math.max(1, Number(config.stallHours ?? 24));
      const cutoffIso = new Date(Date.now() - stallHours * 60 * 60 * 1000).toISOString();
      const { data: approvals } = await admin
        .from("contract_approvals")
        .select("contract_id, due_at, created_at")
        .eq("organization_id", orgId)
        .eq("status", "pending")
        .limit(500);
      const stalledContractIds = [
        ...new Set(
          (approvals ?? [])
            .filter((approval) => {
              const dueAt = approval.due_at ? new Date(approval.due_at).toISOString() : null;
              const createdAt = approval.created_at ? new Date(approval.created_at).toISOString() : null;
              return Boolean((dueAt && dueAt <= new Date().toISOString()) || (createdAt && createdAt <= cutoffIso));
            })
            .map((approval) => approval.contract_id)
            .filter(Boolean)
        ),
      ];
      for (const contractId of stalledContractIds) {
        const created = await createTaskFromRule(
          contractId as string,
          rule,
          config,
          `approval stalled beyond ${stallHours}h`
        );
        if (created) generated++;
      }
    } else if (rule.trigger_type === "risk_threshold") {
      const { data: contracts } = await admin
        .from("contracts")
        .select("id, health_status")
        .eq("organization_id", orgId)
        .eq("health_status", "at_risk")
        .limit(500);
      for (const contract of contracts ?? []) {
        const created = await createTaskFromRule(
          contract.id,
          rule,
          config,
          "contract health status is at_risk"
        );
        if (created) generated++;
      }
    } else if (rule.trigger_type === "data_quality_gap") {
      const threshold = Math.max(0, Math.min(100, Number(config.minCompleteness ?? 80)));
      const { data: snapshots } = await admin
        .from("contract_data_quality_snapshots")
        .select("contract_id, completeness_score")
        .eq("organization_id", orgId)
        .lt("completeness_score", threshold)
        .order("generated_at", { ascending: false })
        .limit(1000);
      const lowQualityContractIds = [...new Set((snapshots ?? []).map((s) => s.contract_id).filter(Boolean))];
      for (const contractId of lowQualityContractIds) {
        const created = await createTaskFromRule(
          contractId as string,
          rule,
          config,
          `data quality score below ${threshold}`
        );
        if (created) generated++;
      }
    }
  }
  return { generated, evaluatedRules };
}
