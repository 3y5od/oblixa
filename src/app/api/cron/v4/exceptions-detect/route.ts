import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { ensureCronAuthorized } from "@/lib/v4/cron";
import { RATE_LIMITS, rateLimitCheck } from "@/lib/rate-limit";
import { pingCronHealthcheck } from "@/lib/observability/cron-healthcheck";
import { upsertDetectedExceptions, type DetectedExceptionInput } from "@/lib/v4/exceptions";
import { recordAutomationEvent } from "@/lib/v4/automation-audit";
import { getContractsMissingCriticalFields } from "@/lib/missing-critical-fields";

const MAX_ROWS_PER_UPSERT = 450;

async function collectExtendedExceptions(admin: Awaited<ReturnType<typeof createAdminClient>>) {
  const nowIso = new Date().toISOString();
  const today = nowIso.slice(0, 10);
  const out: DetectedExceptionInput[] = [];

  const { data: breachedApprovals } = await admin
    .from("contract_approvals")
    .select("id, organization_id, contract_id, approval_type")
    .eq("status", "pending")
    .not("due_at", "is", null)
    .lt("due_at", nowIso)
    .limit(200);
  for (const row of breachedApprovals ?? []) {
    out.push({
      organizationId: row.organization_id as string,
      contractId: row.contract_id as string,
      linkedEntityType: "approval",
      linkedEntityId: row.id as string,
      exceptionType: "approval_sla_breach",
      title: `Approval past due: ${row.approval_type}`,
      severity: "high",
      details: "Pending approval is past its due_at (SLA clock).",
    });
  }

  const { data: orgs } = await admin.from("organizations").select("id").limit(30);
  for (const org of orgs ?? []) {
    const orgId = org.id as string;
    const missing = await getContractsMissingCriticalFields(admin, orgId);
    for (const c of missing.slice(0, 12)) {
      out.push({
        organizationId: orgId,
        contractId: c.id,
        linkedEntityType: "contract",
        linkedEntityId: c.id,
        exceptionType: "missing_critical_field",
        title: `Missing critical dates: ${c.title}`,
        severity: "medium",
        details: "No approved end_date, renewal_date, or notice_window on record.",
      });
    }
  }

  const { data: settingsRows } = await admin
    .from("organization_workflow_settings")
    .select("organization_id, stale_contract_days");
  const staleDaysByOrg = new Map<string, number>();
  for (const s of settingsRows ?? []) {
    staleDaysByOrg.set(
      s.organization_id as string,
      Math.max(30, Number((s as { stale_contract_days?: number }).stale_contract_days ?? 120))
    );
  }
  const { data: pendingReview } = await admin
    .from("contracts")
    .select("id, organization_id, title, updated_at")
    .eq("status", "pending_review")
    .limit(250);
  const nowMs = Date.now();
  for (const row of pendingReview ?? []) {
    const orgId = row.organization_id as string;
    const days = staleDaysByOrg.get(orgId) ?? 120;
    const cutoff = nowMs - days * 24 * 60 * 60 * 1000;
    const updated = new Date(row.updated_at as string).getTime();
    if (updated >= cutoff) continue;
    out.push({
      organizationId: orgId,
      contractId: row.id as string,
      linkedEntityType: "contract",
      linkedEntityId: row.id as string,
      exceptionType: "stale_contract_review_cadence",
      title: `Stale review queue: ${row.title}`,
      severity: "low",
      details: `Contract pending_review with no updates for longer than ${days} days.`,
    });
  }

  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 60);
  const horizonStr = horizon.toISOString().slice(0, 10);
  const { data: renewalScenarios } = await admin
    .from("contract_renewal_scenarios")
    .select("id, organization_id, contract_id, workspace_status, target_decision_date, blocker")
    .not("contract_id", "is", null)
    .in("workspace_status", ["blocked", "in_progress", "decision_pending", "not_started"])
    .limit(200);
  for (const row of renewalScenarios ?? []) {
    const tdd = row.target_decision_date ? String(row.target_decision_date).slice(0, 10) : null;
    const atRisk = (tdd && tdd <= horizonStr) || row.workspace_status === "blocked";
    if (!atRisk) continue;
    out.push({
      organizationId: row.organization_id as string,
      contractId: row.contract_id as string,
      linkedEntityType: "renewal_scenario",
      linkedEntityId: row.id as string,
      exceptionType: "renewal_decision_at_risk",
      title: `Renewal workspace at risk (${row.workspace_status ?? "unknown"})`,
      severity: row.workspace_status === "blocked" ? "high" : "medium",
      details: row.blocker ? String(row.blocker) : tdd ? `Target decision ${tdd}` : null,
    });
  }

  const { data: intErr } = await admin
    .from("integration_connections")
    .select("id, organization_id, provider, last_error")
    .eq("status", "error")
    .limit(80);
  for (const row of intErr ?? []) {
    out.push({
      organizationId: row.organization_id as string,
      contractId: null,
      linkedEntityType: "integration_connection",
      linkedEntityId: row.id as string,
      exceptionType: "failed_integration_sync",
      title: `Integration error: ${row.provider}`,
      severity: "medium",
      details: row.last_error ? String(row.last_error).slice(0, 500) : null,
    });
  }

  const failedSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: failedDeliveries } = await admin
    .from("notification_deliveries")
    .select("id, organization_id, notification_type, channel, attempt_count, last_error")
    .eq("status", "failed")
    .gte("attempt_count", 3)
    .gte("created_at", failedSince)
    .limit(100);
  for (const row of failedDeliveries ?? []) {
    out.push({
      organizationId: row.organization_id as string,
      contractId: null,
      linkedEntityType: "notification_delivery",
      linkedEntityId: row.id as string,
      exceptionType: "repeated_delivery_failure",
      title: `Notification delivery failed: ${row.notification_type} (${row.channel})`,
      severity: "medium",
      details: row.last_error ? String(row.last_error).slice(0, 400) : null,
    });
  }

  const { data: overdueRenewalCp } = await admin
    .from("contract_renewal_checkpoints")
    .select("id, organization_id, contract_id, label, due_date")
    .eq("status", "pending")
    .lt("due_date", today)
    .limit(120);
  for (const row of overdueRenewalCp ?? []) {
    out.push({
      organizationId: row.organization_id as string,
      contractId: row.contract_id as string,
      linkedEntityType: "renewal_checkpoint",
      linkedEntityId: row.id as string,
      exceptionType: "renewal_checkpoint_overdue",
      title: `Overdue renewal checkpoint: ${row.label}`,
      severity: "high",
      details: `Due ${row.due_date}`,
    });
  }

  return out;
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const unauthorized = ensureCronAuthorized(request);
  if (unauthorized) return unauthorized;

  const rate = await rateLimitCheck("cron:v4:exceptions-detect", RATE_LIMITS.v4ExceptionsDetectCron);
  if (!rate.ok) {
    return NextResponse.json({ error: "Too many requests", retryAfterMs: rate.retryAfterMs }, { status: 429 });
  }

  const admin = await createAdminClient();
  const [{ data: overdueTasks }, { data: overdueObligations }, { data: missingOwnerContracts }] =
    await Promise.all([
      admin
        .from("contract_tasks")
        .select("id, organization_id, contract_id, title")
        .in("status", ["open", "in_progress", "blocked"])
        .lt("due_date", new Date().toISOString().slice(0, 10))
        .limit(300),
      admin
        .from("contract_obligations")
        .select("id, organization_id, contract_id, title")
        .in("status", ["open", "in_progress"])
        .lt("due_date", new Date().toISOString().slice(0, 10))
        .limit(300),
      admin.from("contracts").select("id, organization_id, title").is("owner_id", null).limit(300),
    ]);

  const baseInserts: DetectedExceptionInput[] = [
    ...(overdueTasks ?? []).map((row) => ({
      organizationId: row.organization_id as string,
      contractId: row.contract_id as string,
      linkedEntityType: "task",
      linkedEntityId: row.id as string,
      exceptionType: "overdue_task",
      title: `Overdue task: ${row.title}`,
      severity: "high" as const,
    })),
    ...(overdueObligations ?? []).map((row) => ({
      organizationId: row.organization_id as string,
      contractId: row.contract_id as string,
      linkedEntityType: "obligation",
      linkedEntityId: row.id as string,
      exceptionType: "overdue_obligation",
      title: `Overdue obligation: ${row.title}`,
      severity: "high" as const,
    })),
    ...(missingOwnerContracts ?? []).map((row) => ({
      organizationId: row.organization_id as string,
      contractId: row.id as string,
      linkedEntityType: "contract",
      linkedEntityId: row.id as string,
      exceptionType: "missing_owner",
      title: `Missing owner: ${row.title}`,
      severity: "medium" as const,
    })),
  ];

  const extended = await collectExtendedExceptions(admin);
  const inserts = [...baseInserts, ...extended];

  let touched = 0;
  for (let i = 0; i < inserts.length; i += MAX_ROWS_PER_UPSERT) {
    const chunk = inserts.slice(i, i + MAX_ROWS_PER_UPSERT);
    const r = await upsertDetectedExceptions({
      admin,
      detector: "cron:v4:exceptions-detect",
      rows: chunk,
    });
    touched += r.touched;
  }

  const orgIds = new Set(inserts.map((row) => row.organizationId));
  for (const orgId of orgIds) {
    await recordAutomationEvent({
      admin,
      organizationId: orgId,
      action: "exceptions_detect",
      details: { detector: "cron", touched, rows: inserts.length },
    });
  }

  const payload = {
    detected: touched,
    rowsScanned: inserts.length,
    ok: true,
    durationMs: Date.now() - startedAt,
  };
  pingCronHealthcheck("cron/v4/exceptions-detect", payload);
  return NextResponse.json(payload);
}
