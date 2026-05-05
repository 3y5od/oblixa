import { createAdminClient } from "@/lib/supabase/server";
import { enqueueOutboundEvent } from "@/lib/integrations/events";
import { sendSlackWorkflowNotification } from "@/lib/integrations/slack";
import { safeErrorMessage, type BatchItemError } from "@/lib/route-runtime-contract";

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;
type TaskAutomationOutcome = { created: boolean; errors: BatchItemError[] };

export type TaskAutomationRuleRunResult = {
  generated: number;
  evaluatedRules: number;
  errors: BatchItemError[];
};

function taskRuleError(
  scope: string,
  phase: BatchItemError["phase"],
  diagnosticId: string,
  message: string
): BatchItemError {
  return { scope, phase, diagnostic_id: diagnosticId, message };
}

/**
 * Cron / internal batch runner for task automation rules.
 * Lives outside `actions/*` so App Router route handlers never import `"use server"` modules
 * (Next can treat those exports as server actions and break `GET` route handlers).
 */
export async function runTaskAutomationRulesForOrg(
  admin: AdminClient,
  orgId: string
): Promise<TaskAutomationRuleRunResult> {
  const todayIso = new Date().toISOString().slice(0, 10);
  const errors: BatchItemError[] = [];

  const recordOutcome = (outcome: TaskAutomationOutcome) => {
    errors.push(...outcome.errors);
    return outcome.created;
  };

  async function createTaskFromRule(
    contractId: string,
    rule: { id: string; name: string },
    config: Record<string, unknown>,
    reason: string
  ): Promise<TaskAutomationOutcome> {
    const scope = `${orgId}:${rule.id}:${contractId}`;
    const fail = (
      phase: BatchItemError["phase"],
      diagnosticId: string,
      message: string,
      created = false
    ): TaskAutomationOutcome => ({ created, errors: [taskRuleError(scope, phase, diagnosticId, message)] });

    const actionType = String(config.actionType ?? "create_task").trim();
    if (actionType === "trigger_report") {
      const reportMode = String(config.reportMode ?? "exceptions").trim();
      const resolvedReportMode = reportMode === "saved_view" || reportMode === "management" ? reportMode : "exceptions";
      const reportRunMetrics = {
        contract_id: contractId,
        reason,
        rule_id: rule.id,
        source: "automation_rule",
        trigger: rule.name,
      };
      const { error } = await admin.from("report_runs").insert({
        organization_id: orgId,
        subscription_id: null,
        report_mode: resolvedReportMode,
        status: "queued",
        triggered_by: null,
        metrics_json: reportRunMetrics,
      });
      if (error?.code === "23505") return { created: false, errors: [] };
      if (error) return fail("persist", "task_rule_report_queue_insert_failed", error.message);

      try {
        await enqueueOutboundEvent({
          organizationId: orgId,
          eventType: "report.queued_by_rule",
          entityType: "task_automation_rule",
          entityId: rule.id,
          payload: { contract_id: contractId, reason, trigger: rule.name },
        });
      } catch (error) {
        return fail(
          "notify",
          "task_rule_report_queue_event_failed",
          safeErrorMessage(error) ?? "task_rule_report_queue_event_failed",
          true
        );
      }
      return { created: true, errors: [] };
    }

    if (actionType === "notify_only") {
      const notifyErrors: BatchItemError[] = [];
      let delivered = false;

      try {
        await enqueueOutboundEvent({
          organizationId: orgId,
          eventType: "automation.notification",
          entityType: "task_automation_rule",
          entityId: rule.id,
          payload: { contract_id: contractId, reason, trigger: rule.name },
        });
        delivered = true;
      } catch (error) {
        notifyErrors.push(
          taskRuleError(
            scope,
            "notify",
            "task_rule_notify_event_failed",
            safeErrorMessage(error) ?? "task_rule_notify_event_failed"
          )
        );
      }

      try {
        await sendSlackWorkflowNotification(admin, {
          organizationId: orgId,
          title: `Rule alert: ${rule.name}`,
          body: `Contract ${contractId.slice(0, 8)} matched condition: ${reason}`,
          metadata: { contract_id: contractId, rule_id: rule.id },
        });
        delivered = true;
      } catch (error) {
        notifyErrors.push(
          taskRuleError(
            scope,
            "notify",
            "task_rule_notify_slack_failed",
            safeErrorMessage(error) ?? "task_rule_notify_slack_failed"
          )
        );
      }

      return { created: delivered, errors: notifyErrors };
    }

    const title = String(config.taskTitle ?? "Follow-up required");
    const existing = await admin
      .from("contract_tasks")
      .select("id")
      .eq("contract_id", contractId)
      .eq("created_via", "rule")
      .eq("title", title)
      .in("status", ["open", "in_progress", "blocked"])
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (existing.error) return fail("source_query", "task_rule_existing_task_query_failed", existing.error.message);
    if (existing.data) return { created: false, errors: [] };

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
        details: String(config.taskDetails ?? "").trim() || `Rule '${rule.name}' triggered: ${reason}.`,
        status: "open",
        priority: "medium",
        due_date: dueDate,
        created_via: "rule",
        team_key: String(config.teamKey ?? "ops"),
      })
      .select("id")
      .single();
    if (error?.code === "23505") return { created: false, errors: [] };
    if (error || !inserted) return fail("persist", "task_rule_insert_failed", error?.message ?? "task_rule_insert_failed");

    const outcomeErrors: BatchItemError[] = [];
    const { error: auditError } = await admin.from("audit_events").insert({
      organization_id: orgId,
      contract_id: contractId,
      user_id: null,
      action: "task.created_by_rule",
      details: { rule_id: rule.id, task_id: inserted.id, reason },
    });
    if (auditError) {
      outcomeErrors.push(taskRuleError(scope, "persist", "task_rule_audit_insert_failed", auditError.message));
    }

    const { error: taskEventError } = await admin.from("contract_task_events").insert({
      organization_id: orgId,
      contract_id: contractId,
      task_id: inserted.id,
      actor_id: null,
      event_type: "created",
      details: { created_via: "rule", rule_id: rule.id, reason },
    });
    if (taskEventError) {
      outcomeErrors.push(
        taskRuleError(scope, "persist", "task_rule_task_event_insert_failed", taskEventError.message)
      );
    }

    try {
      await enqueueOutboundEvent({
        organizationId: orgId,
        eventType: "task.created_by_rule",
        entityType: "contract_task",
        entityId: inserted.id,
        payload: { contract_id: contractId, rule_id: rule.id, reason, trigger: rule.name },
      });
    } catch (error) {
      outcomeErrors.push(
        taskRuleError(
          scope,
          "notify",
          "task_rule_created_event_failed",
          safeErrorMessage(error) ?? "task_rule_created_event_failed"
        )
      );
    }

    const webhookEventType = String(config.webhookEventType ?? "").trim();
    if (webhookEventType) {
      try {
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
      } catch (error) {
        outcomeErrors.push(
          taskRuleError(
            scope,
            "notify",
            "task_rule_webhook_event_failed",
            safeErrorMessage(error) ?? "task_rule_webhook_event_failed"
          )
        );
      }
    }

    try {
      await sendSlackWorkflowNotification(admin, {
        organizationId: orgId,
        title: `Rule triggered: ${rule.name}`,
        body: `Created task "${title}" for contract ${contractId.slice(0, 8)} (${reason}).`,
        metadata: { contract_id: contractId, task_id: inserted.id, rule_id: rule.id },
      });
    } catch (error) {
      outcomeErrors.push(
        taskRuleError(
          scope,
          "notify",
          "task_rule_created_slack_failed",
          safeErrorMessage(error) ?? "task_rule_created_slack_failed"
        )
      );
    }

    return { created: true, errors: outcomeErrors };
  }

  const rulesResult = await admin
    .from("task_automation_rules")
    .select("id, name, trigger_type, config_json")
    .eq("organization_id", orgId)
    .eq("active", true);
  if (rulesResult.error) {
    return {
      generated: 0,
      evaluatedRules: 0,
      errors: [taskRuleError(orgId, "source_query", "task_rule_query_failed", rulesResult.error.message)],
    };
  }

  const rules = rulesResult.data ?? [];
  if (rules.length === 0) return { generated: 0, evaluatedRules: 0, errors };

  let generated = 0;
  let evaluatedRules = 0;

  for (const rule of rules) {
    evaluatedRules += 1;
    const config = (rule.config_json ?? {}) as Record<string, unknown>;

    if (rule.trigger_type === "field_missing") {
      const requiredField = String(config.requiredField ?? "").trim();
      if (!requiredField) continue;

      const contractsResult = await admin
        .from("contracts")
        .select("id")
        .eq("organization_id", orgId)
        .in("status", ["pending_review", "active"])
        .limit(300);
      if (contractsResult.error) {
        errors.push(
          taskRuleError(
            `${orgId}:${rule.id}`,
            "source_query",
            "task_rule_field_missing_contract_query_failed",
            contractsResult.error.message
          )
        );
        continue;
      }

      for (const contract of contractsResult.data ?? []) {
        const fieldResult = await admin
          .from("extracted_fields")
          .select("id")
          .eq("contract_id", contract.id)
          .eq("field_name", requiredField)
          .eq("status", "approved")
          .maybeSingle();
        if (fieldResult.error) {
          errors.push(
            taskRuleError(
              `${orgId}:${rule.id}:${contract.id}`,
              "source_query",
              "task_rule_field_missing_field_query_failed",
              fieldResult.error.message
            )
          );
          continue;
        }
        if (fieldResult.data) continue;
        if (recordOutcome(await createTaskFromRule(contract.id, rule, config, `missing approved field '${requiredField}'`))) {
          generated += 1;
        }
      }
      continue;
    }

    if (rule.trigger_type === "field_changed") {
      const fieldName = String(config.fieldName ?? "").trim();
      const lookbackDays = Math.max(1, Number(config.lookbackDays ?? 3));
      if (!fieldName) continue;

      const sinceIso = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
      const eventsResult = await admin
        .from("audit_events")
        .select("contract_id")
        .eq("organization_id", orgId)
        .eq("action", "field.edited")
        .gte("created_at", sinceIso)
        .contains("details", { field_name: fieldName })
        .not("contract_id", "is", null)
        .limit(500);
      if (eventsResult.error) {
        errors.push(
          taskRuleError(
            `${orgId}:${rule.id}`,
            "source_query",
            "task_rule_field_changed_event_query_failed",
            eventsResult.error.message
          )
        );
        continue;
      }

      const contractIds = [...new Set((eventsResult.data ?? []).map((evt) => evt.contract_id).filter(Boolean))];
      for (const contractId of contractIds) {
        if (
          recordOutcome(
            await createTaskFromRule(
              contractId as string,
              rule,
              config,
              `field '${fieldName}' changed in last ${lookbackDays} day(s)`
            )
          )
        ) {
          generated += 1;
        }
      }
      continue;
    }

    if (rule.trigger_type === "date_window" || rule.trigger_type === "renewal_window") {
      const fieldName =
        rule.trigger_type === "renewal_window"
          ? "renewal_date"
          : String(config.fieldName ?? "end_date").trim();
      const windowDays = Math.max(
        0,
        Number(config.windowDays ?? (rule.trigger_type === "renewal_window" ? 90 : 30))
      );
      const windowEndIso = new Date(Date.now() + windowDays * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      const fieldsResult = await admin
        .from("extracted_fields")
        .select("contract_id, field_value")
        .eq("field_name", fieldName)
        .eq("status", "approved")
        .not("field_value", "is", null)
        .limit(1000);
      if (fieldsResult.error) {
        errors.push(
          taskRuleError(
            `${orgId}:${rule.id}`,
            "source_query",
            "task_rule_date_window_field_query_failed",
            fieldsResult.error.message
          )
        );
        continue;
      }

      for (const row of fieldsResult.data ?? []) {
        const dateValue = String(row.field_value ?? "").slice(0, 10);
        if (!dateValue || dateValue < todayIso || dateValue > windowEndIso) continue;

        const contractResult = await admin
          .from("contracts")
          .select("id")
          .eq("id", row.contract_id)
          .eq("organization_id", orgId)
          .maybeSingle();
        if (contractResult.error) {
          errors.push(
            taskRuleError(
              `${orgId}:${rule.id}:${String(row.contract_id ?? "unknown")}`,
              "source_query",
              "task_rule_date_window_contract_query_failed",
              contractResult.error.message
            )
          );
          continue;
        }
        if (!contractResult.data) continue;

        if (
          recordOutcome(
            await createTaskFromRule(
              contractResult.data.id,
              rule,
              config,
              `${fieldName} is inside ${windowDays} day window`
            )
          )
        ) {
          generated += 1;
        }
      }
      continue;
    }

    if (rule.trigger_type === "ownership_change") {
      const lookbackDays = Math.max(1, Number(config.lookbackDays ?? 2));
      const sinceIso = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
      const eventsResult = await admin
        .from("audit_events")
        .select("contract_id")
        .eq("organization_id", orgId)
        .eq("action", "contract.owner_changed")
        .gte("created_at", sinceIso)
        .not("contract_id", "is", null)
        .limit(500);
      if (eventsResult.error) {
        errors.push(
          taskRuleError(
            `${orgId}:${rule.id}`,
            "source_query",
            "task_rule_ownership_change_event_query_failed",
            eventsResult.error.message
          )
        );
        continue;
      }

      const contractIds = [...new Set((eventsResult.data ?? []).map((event) => event.contract_id).filter(Boolean))];
      for (const contractId of contractIds) {
        if (recordOutcome(await createTaskFromRule(contractId as string, rule, config, "contract owner changed recently"))) {
          generated += 1;
        }
      }
      continue;
    }

    if (rule.trigger_type === "approval_stall") {
      const stallHours = Math.max(1, Number(config.stallHours ?? 24));
      const cutoffIso = new Date(Date.now() - stallHours * 60 * 60 * 1000).toISOString();
      const approvalsResult = await admin
        .from("contract_approvals")
        .select("contract_id, due_at, created_at")
        .eq("organization_id", orgId)
        .eq("status", "pending")
        .limit(500);
      if (approvalsResult.error) {
        errors.push(
          taskRuleError(
            `${orgId}:${rule.id}`,
            "source_query",
            "task_rule_approval_stall_query_failed",
            approvalsResult.error.message
          )
        );
        continue;
      }

      const stalledContractIds = [
        ...new Set(
          (approvalsResult.data ?? [])
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
        if (
          recordOutcome(
            await createTaskFromRule(contractId as string, rule, config, `approval stalled beyond ${stallHours}h`)
          )
        ) {
          generated += 1;
        }
      }
      continue;
    }

    if (rule.trigger_type === "risk_threshold") {
      const contractsResult = await admin
        .from("contracts")
        .select("id, health_status")
        .eq("organization_id", orgId)
        .eq("health_status", "at_risk")
        .limit(500);
      if (contractsResult.error) {
        errors.push(
          taskRuleError(
            `${orgId}:${rule.id}`,
            "source_query",
            "task_rule_risk_threshold_contract_query_failed",
            contractsResult.error.message
          )
        );
        continue;
      }

      for (const contract of contractsResult.data ?? []) {
        if (recordOutcome(await createTaskFromRule(contract.id, rule, config, "contract health status is at_risk"))) {
          generated += 1;
        }
      }
      continue;
    }

    if (rule.trigger_type === "data_quality_gap") {
      const threshold = Math.max(0, Math.min(100, Number(config.minCompleteness ?? 80)));
      const snapshotsResult = await admin
        .from("contract_data_quality_snapshots")
        .select("contract_id, completeness_score")
        .eq("organization_id", orgId)
        .lt("completeness_score", threshold)
        .order("generated_at", { ascending: false })
        .limit(1000);
      if (snapshotsResult.error) {
        errors.push(
          taskRuleError(
            `${orgId}:${rule.id}`,
            "source_query",
            "task_rule_data_quality_query_failed",
            snapshotsResult.error.message
          )
        );
        continue;
      }

      const contractIds = [...new Set((snapshotsResult.data ?? []).map((row) => row.contract_id).filter(Boolean))];
      for (const contractId of contractIds) {
        if (
          recordOutcome(
            await createTaskFromRule(contractId as string, rule, config, `data quality score below ${threshold}`)
          )
        ) {
          generated += 1;
        }
      }
    }
  }

  return { generated, evaluatedRules, errors };
}