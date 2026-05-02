import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { ensureCronAuthorized } from "@/lib/v4/cron";
import { RATE_LIMITS, rateLimitCheck } from "@/lib/rate-limit";
import { pingCronHealthcheck } from "@/lib/observability/cron-healthcheck";
import { upsertDetectedExceptions } from "@/lib/v4/exceptions";
import { recordV10AuditEvent } from "@/lib/v10-server-contracts";
import { refreshV10ReadModelsForOrganization } from "@/lib/v10-read-model-refresh";
import { getV10EvidenceFollowUpStage } from "@/lib/v10-evidence-collaboration";
import { emitProductTelemetryEvent } from "@/lib/product-telemetry";

const PRIVATE_NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };
const EVIDENCE_FOLLOWUP_BATCH_LIMIT = 1000;

export async function GET(request: Request) {
  const startedAt = Date.now();
  const unauthorized = ensureCronAuthorized(request);
  if (unauthorized) return unauthorized;
  const rate = await rateLimitCheck("cron:v4:evidence-followup", RATE_LIMITS.v4EvidenceFollowupCron);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterMs: rate.retryAfterMs },
      { status: 429, headers: PRIVATE_NO_STORE_HEADERS }
    );
  }

  const admin = await createAdminClient();
  const today = new Date().toISOString();
  const dueMinus3Horizon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const { data: requirements } = await admin
    .from("evidence_requirements")
    .select("id, organization_id, contract_id, title, due_at, reviewer_id")
    .in("status", ["required", "submitted", "rejected"])
    .lte("due_at", dueMinus3Horizon)
    .limit(EVIDENCE_FOLLOWUP_BATCH_LIMIT);
  const requirementRows = requirements ?? [];
  const requirementIds = requirementRows.map((row) => row.id).filter(Boolean) as string[];
  const followUpRows = requirementRows.map((row) => ({
    row,
    stage: getV10EvidenceFollowUpStage(row.due_at, new Date(today)),
  }));

  const [{ data: existingTaskRows }, { data: existingNotificationRows }] = await Promise.all([
    requirementIds.length === 0
      ? Promise.resolve({ data: [] as Array<{ evidence_requirement_id: string | null }> })
      : admin
          .from("contract_tasks")
          .select("evidence_requirement_id")
          .in("evidence_requirement_id", requirementIds),
    requirementIds.length === 0
      ? Promise.resolve({ data: [] as Array<{ metadata: Record<string, unknown> | null }> })
      : admin
          .from("notification_deliveries")
          .select("metadata")
          .in("notification_type", [
            "evidence_due_minus_3",
            "evidence_due",
            "evidence_overdue",
            "evidence_followup_owner",
            "evidence_followup_escalation",
          ])
          .in("organization_id", [...new Set(requirementRows.map((row) => row.organization_id))]),
  ]);
  const taskRequirementIds = new Set((existingTaskRows ?? []).map((row) => row.evidence_requirement_id).filter(Boolean));
  const notifiedRequirementIds = new Set(
    (existingNotificationRows ?? [])
      .map((row) => {
        const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
        const sourceId = typeof metadata.source_id === "string" ? metadata.source_id : null;
        const stage = typeof metadata.follow_up_stage === "string" ? metadata.follow_up_stage : "legacy";
        return sourceId ? `${sourceId}:${stage}` : null;
      })
      .filter(Boolean)
  );

  const notificationRows = followUpRows
    .flatMap(({ row, stage }) => {
      const stages = [
        {
          due: stage.dueMinus3DaysReminderDue,
          key: "due_minus_3",
          notificationType: "evidence_due_minus_3",
          subject: "Evidence due in 3 days",
          diagnosticId: "v10_evidence_due_minus_3_reminder_due",
        },
        {
          due: stage.dueDateReminderDue,
          key: "due_date",
          notificationType: "evidence_due",
          subject: "Evidence due today",
          diagnosticId: "v10_evidence_due_date_reminder_due",
        },
        {
          due: stage.overdueStateDue,
          key: "overdue_state",
          notificationType: "evidence_overdue",
          subject: "Evidence is overdue",
          diagnosticId: "v10_evidence_overdue",
        },
        {
          due: stage.ownerNotificationDue,
          key: "owner_notification",
          notificationType: "evidence_followup_owner",
          subject: "Evidence follow-up needed",
          diagnosticId: "v10_evidence_owner_notification_due",
        },
        {
          due: stage.escalationWorkItemDue,
          key: "escalation",
          notificationType: "evidence_followup_escalation",
          subject: "Evidence follow-up escalation",
          diagnosticId: "v10_evidence_escalation_due",
        },
      ];
      return stages
        .filter((item) => item.due && !notifiedRequirementIds.has(`${row.id}:${item.key}`))
        .map((item) => ({
          organization_id: row.organization_id,
          channel: "email",
          notification_type: item.notificationType,
          recipient: null,
          subject: item.subject,
          status: "pending",
          next_attempt_at: today,
          metadata: {
            source_type: "evidence_requirement",
            source_id: row.id,
            contract_id: row.contract_id,
            user_id: row.reviewer_id,
            follow_up_stage: item.key,
            diagnostic_id: item.diagnosticId,
          },
        }));
    });
  const escalationTaskRows = followUpRows
    .filter(({ row, stage }) => row.contract_id && stage.escalationWorkItemDue && !taskRequirementIds.has(row.id))
    .map(({ row, stage }) => ({
      organization_id: row.organization_id,
      contract_id: row.contract_id,
      assignee_id: row.reviewer_id,
      title: `Evidence follow-up: ${row.title ?? "request"}`,
      details: `Evidence request is overdue. Diagnostic: ${stage.diagnosticId ?? "v10_evidence_overdue"}.`,
      status: "open",
      priority: "high",
      due_date: today.slice(0, 10),
      evidence_requirement_id: row.id,
      created_via: "rule",
    }));
  if (notificationRows.length > 0) {
    await admin.from("notification_deliveries").insert(notificationRows);
  }
  if (escalationTaskRows.length > 0) {
    await admin.from("contract_tasks").insert(escalationTaskRows);
  }

  const { touched } = await upsertDetectedExceptions({
    admin,
    detector: "cron:v4:evidence-followup",
    rows: followUpRows.filter(({ stage }) => stage.overdueStateDue).map(({ row }) => ({
      organizationId: row.organization_id,
      contractId: row.contract_id,
      linkedEntityType: "evidence_requirement",
      linkedEntityId: row.id,
      exceptionType: "stale_evidence",
      title: "Stale evidence requirement",
      severity: "medium",
      details: "Evidence requirement reached due date without approval.",
    })),
  });
  const orgIds = [...new Set(requirementRows.map((row) => row.organization_id))].filter(
    Boolean
  ) as string[];
  const reviewed = requirementRows.length;
  if (orgIds.length > 0) {
    await admin.from("audit_events").insert(
      orgIds.map((organizationId) => ({
        organization_id: organizationId,
        contract_id: null,
        user_id: null,
        action: "automation.evidence_followup",
        details: { reviewed, exceptionsTouched: touched, notificationsQueued: notificationRows.length, escalationTasksCreated: escalationTaskRows.length },
      }))
    );
    for (const organizationId of orgIds) {
      await recordV10AuditEvent(admin, {
        organizationId,
        actorUserId: null,
        action: "evidence_request.follow_up_scheduled",
        targetType: "evidence_request",
        targetId: "cron:v4:evidence-followup",
        outcome: "success",
        safeMetadata: {
          reviewed,
          exceptions_touched: touched,
          notifications_queued: notificationRows.length,
          escalation_tasks_created: escalationTaskRows.length,
        },
      });
      await emitProductTelemetryEvent(admin, {
        organizationId,
        userId: null,
        action: "product.v10.evidence_follow_up_scheduled",
        details: {
          reviewed,
          notifications_queued: notificationRows.length,
          escalation_tasks_created: escalationTaskRows.length,
          batch_limit: EVIDENCE_FOLLOWUP_BATCH_LIMIT,
          batch_truncated: reviewed === EVIDENCE_FOLLOWUP_BATCH_LIMIT,
        },
      });
      await refreshV10ReadModelsForOrganization(admin, organizationId, {
        refreshScope: "one_model",
        reason: "evidence_followup_cron",
        modelKeys: [
          "work_items",
          "contract_health_snapshots",
          "contract_activity_events",
          "evidence_request_statuses",
          "notification_deliveries",
          "audit_events",
          "command_search_index",
        ],
      });
    }
  }

  const payload = {
    reviewed,
    exceptionsCreated: touched,
    notificationsQueued: notificationRows.length,
    dueMinus3RemindersQueued: notificationRows.filter((row) => row.metadata.follow_up_stage === "due_minus_3").length,
    dueDateRemindersQueued: notificationRows.filter((row) => row.metadata.follow_up_stage === "due_date").length,
    overdueNotificationsQueued: notificationRows.filter((row) => row.metadata.follow_up_stage === "overdue_state").length,
    ownerNotificationsQueued: notificationRows.filter((row) => row.metadata.follow_up_stage === "owner_notification").length,
    escalationTasksCreated: escalationTaskRows.length,
    batchLimit: EVIDENCE_FOLLOWUP_BATCH_LIMIT,
    batchTruncated: reviewed === EVIDENCE_FOLLOWUP_BATCH_LIMIT,
    ok: true,
    durationMs: Date.now() - startedAt,
  };
  pingCronHealthcheck("cron/v4/evidence-followup", payload);
  return NextResponse.json(payload, { headers: PRIVATE_NO_STORE_HEADERS });
}
