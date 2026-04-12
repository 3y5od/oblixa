import type { AdminClient } from "@/lib/v6/service";
import { createRow, listRows, updateRowById } from "@/lib/v6/service";
import { nowIso } from "@/lib/v5/api";
import {
  executePlaybookSideEffects,
  type PlaybookExecutionContext,
} from "@/lib/v6/playbook-executors";
import { seedPlaybookFollowUpRecommendations } from "@/lib/v6/playbook-followups";
import { gatherPortfolioMetrics, type V6PortfolioMetrics } from "@/lib/v6/portfolio-metrics";
import { recordPlaybookInterventionOutcome } from "@/lib/v6/outcome-writers";

export type RunPlaybookOptions = {
  sourceFindingId?: string | null;
};

export function listPlaybooks(admin: AdminClient, orgId: string) {
  return listRows(
    admin,
    "adaptive_playbooks",
    orgId,
    "id, name, playbook_type, approval_mode, active, updated_at"
  );
}

export function createPlaybook(
  admin: AdminClient,
  orgId: string,
  userId: string,
  payload: { name: string; playbookType: string }
) {
  return createRow(admin, "adaptive_playbooks", orgId, {
    name: payload.name,
    playbook_type: payload.playbookType,
    created_by: userId,
  });
}

export async function previewPlaybookRun(admin: AdminClient, orgId: string, playbookId: string, userId: string) {
  const { data: playbook } = await admin
    .from("adaptive_playbooks")
    .select("playbook_type, execution_template_json")
    .eq("organization_id", orgId)
    .eq("id", playbookId)
    .maybeSingle();

  const pt = String(playbook?.playbook_type ?? "");
  const estimatedByType: Record<string, string[]> = {
    create_decision_workspace: ["insert_decision_workspaces_row", "link_contracts_if_template"],
    start_campaign: ["insert_portfolio_campaigns_remediation_draft"],
    escalate_manager: ["insert_exceptions_escalation"],
    assign_backup_owner: ["insert_contract_tasks_backup_owner"],
    request_evidence_refresh: ["insert_external_action_links_evidence_refresh"],
    reopen_exception: ["update_exceptions_status_open"],
    trigger_stakeholder_review: ["insert_decision_workspaces_remediation_acceptance"],
    generate_packet: ["insert_report_packs_assurance_summary"],
    send_bounded_external_request: ["insert_external_action_links_bounded_request"],
    schedule_focused_report_pack: ["insert_report_packs_focused_scheduled"],
    route_contracts_into_maintenance_campaign: ["insert_portfolio_campaigns_maintenance_draft"],
    finding_to_intervention: ["resolve_recommended_playbook_or_seed_recommendation"],
  };
  const estimated = estimatedByType[pt] ?? ["review_execution_template_json", "confirm_playbook_type_supported"];

  return createRow(admin, "adaptive_playbook_runs", orgId, {
    adaptive_playbook_id: playbookId,
    status: "previewed",
    preview_json: {
      estimated_actions: estimated,
      playbook_type: playbook?.playbook_type,
      template: playbook?.execution_template_json ?? {},
      generated_at: nowIso(),
    },
    run_by: userId,
  });
}

async function insertStep(
  admin: AdminClient,
  orgId: string,
  runId: string,
  order: number,
  key: string,
  stage: string,
  status: string,
  output: Record<string, unknown>
) {
  await admin.from("adaptive_playbook_steps").insert({
    organization_id: orgId,
    playbook_run_id: runId,
    step_key: key,
    step_order: order,
    stage: stage as "eligibility" | "preconditions" | "dry_run" | "approval" | "execution" | "follow_up" | "assessment" | "postmortem",
    status: status as "pending" | "running" | "completed" | "failed" | "skipped",
    output_json: output,
    started_at: nowIso(),
    completed_at: nowIso(),
  });
}

export async function runPlaybook(
  admin: AdminClient,
  orgId: string,
  playbookId: string,
  userId: string,
  options: RunPlaybookOptions = {}
) {
  const { data: playbook, error: pbErr } = await admin
    .from("adaptive_playbooks")
    .select("id, playbook_type, execution_template_json, preconditions_json, eligibility_json, approval_mode, follow_up_checks_json")
    .eq("organization_id", orgId)
    .eq("id", playbookId)
    .maybeSingle();

  if (pbErr || !playbook) {
    return { data: null, error: pbErr ?? { message: "playbook_not_found" } };
  }

  const template = (playbook.execution_template_json as Record<string, unknown>) ?? {};
  const preconditions = (playbook.preconditions_json as Record<string, unknown>) ?? {};
  const eligibility = (playbook.eligibility_json as Record<string, unknown>) ?? {};
  const metricsBefore = await gatherPortfolioMetrics(admin, orgId);

  const execCtx = { sourceFindingId: options.sourceFindingId ?? null };

  const created = await createRow(admin, "adaptive_playbook_runs", orgId, {
    adaptive_playbook_id: playbookId,
    status: "running",
    execution_input_json: {
      triggered_at: nowIso(),
      playbook_type: playbook.playbook_type,
      source_finding_id: options.sourceFindingId ?? null,
      metrics_before_snapshot: metricsBefore,
    },
    source_finding_id: options.sourceFindingId ?? null,
    run_by: userId,
    started_at: nowIso(),
  });

  if (!created.data?.id) return created;

  const runId = created.data.id as string;
  let stepOrder = 1;

  const eligible =
    typeof eligibility.require_open_findings !== "boolean" || eligibility.require_open_findings === false
      ? true
      : (options.sourceFindingId ?? null) != null;

  await insertStep(admin, orgId, runId, stepOrder++, "eligibility", "eligibility", "completed", {
    ok: eligible,
    eligibility_json: eligibility,
  });

  if (!eligible) {
    await updateRowById(admin, "adaptive_playbook_runs", orgId, runId, {
      status: "failed",
      completed_at: nowIso(),
      result_json: { reason: "eligibility_failed" },
    });
    return { data: created.data, error: { message: "eligibility_failed" } };
  }

  const preconditionMet =
    typeof preconditions.max_open_exceptions === "number"
      ? metricsBefore.open_exceptions + metricsBefore.open_exceptions_in_progress <= preconditions.max_open_exceptions
      : true;

  await insertStep(admin, orgId, runId, stepOrder++, "preconditions", "preconditions", preconditionMet ? "completed" : "failed", {
    metrics_snapshot: metricsBefore,
    preconditionMet,
  });

  if (!preconditionMet) {
    await updateRowById(admin, "adaptive_playbook_runs", orgId, runId, {
      status: "failed",
      completed_at: nowIso(),
      result_json: { reason: "preconditions_failed" },
    });
    return { data: created.data, error: { message: "preconditions_failed" } };
  }

  await insertStep(admin, orgId, runId, stepOrder++, "dry_run", "dry_run", "completed", {
    playbook_type: playbook.playbook_type,
    template_preview: {
      keys: Object.keys(template),
      contract_id: template.contract_id ?? null,
    },
    source_finding_id: options.sourceFindingId ?? null,
    at: nowIso(),
  });

  const approvalMode = String(playbook.approval_mode ?? "optional");
  if (approvalMode === "required") {
    await insertStep(admin, orgId, runId, stepOrder++, "approval", "approval", "pending", {
      awaiting: true,
    });
    await updateRowById(admin, "adaptive_playbook_runs", orgId, runId, {
      status: "awaiting_approval",
      result_json: { awaiting_approval: true },
    });
    return { data: created.data, error: null };
  }

  const sideEffects = await executePlaybookSideEffects(
    admin,
    orgId,
    userId,
    String(playbook.playbook_type),
    template,
    execCtx
  );

  await insertStep(admin, orgId, runId, stepOrder++, "execution", "execution", sideEffects.error ? "failed" : "completed", {
    ...sideEffects.records,
    error: sideEffects.error ? String(sideEffects.error) : undefined,
  });

  const followUps = Array.isArray(playbook.follow_up_checks_json)
    ? (playbook.follow_up_checks_json as string[])
    : [];
  await insertStep(admin, orgId, runId, stepOrder++, "follow_up", "follow_up", "completed", {
    checks: followUps,
    note: followUps.length ? "scheduled_follow_up" : "none",
  });

  await seedPlaybookFollowUpRecommendations(
    admin,
    orgId,
    userId,
    runId,
    followUps,
    options.sourceFindingId ?? null
  );

  const metricsAfterPartial = await gatherPortfolioMetrics(admin, orgId);
  await insertStep(admin, orgId, runId, stepOrder++, "assessment", "assessment", "completed", {
    metrics_after: metricsAfterPartial,
    improved:
      metricsAfterPartial.open_exceptions + metricsAfterPartial.open_exceptions_in_progress <=
      metricsBefore.open_exceptions + metricsBefore.open_exceptions_in_progress,
  });

  await insertStep(admin, orgId, runId, stepOrder++, "postmortem", "postmortem", "completed", {
    summary: sideEffects.error
      ? "Playbook failed during execution; see execution step output."
      : `Completed ${String(playbook.playbook_type)}; exception delta vs pre-run in assessment step.`,
    playbook_type: playbook.playbook_type,
    follow_up_seeded: followUps.length > 0,
    at: nowIso(),
  });

  const completed = await updateRowById(admin, "adaptive_playbook_runs", orgId, runId, {
    status: sideEffects.error ? "failed" : "completed",
    completed_at: nowIso(),
    result_json: { success: !sideEffects.error, side_effects: sideEffects.records },
    success_assessment_json: {
      restored_health: !sideEffects.error,
      stages: "full",
      exception_delta:
        metricsAfterPartial.open_exceptions +
        metricsAfterPartial.open_exceptions_in_progress -
        (metricsBefore.open_exceptions + metricsBefore.open_exceptions_in_progress),
      evidence_stale_delta: metricsAfterPartial.evidence_stale_proxy - metricsBefore.evidence_stale_proxy,
    },
  });

  if (!sideEffects.error && completed.data?.id) {
    const metricsAfter = await gatherPortfolioMetrics(admin, orgId);
    await recordPlaybookInterventionOutcome(admin, orgId, String(completed.data.id), metricsBefore, metricsAfter);
  }

  return { data: completed.data, error: completed.error ?? sideEffects.error };
}

/**
 * Resume a run left in `awaiting_approval` after a manager approves execution.
 */
export async function approveAndContinuePlaybookRun(
  admin: AdminClient,
  orgId: string,
  userId: string,
  runId: string
) {
  const { data: run, error: runErr } = await admin
    .from("adaptive_playbook_runs")
    .select("id, status, adaptive_playbook_id, execution_input_json, source_finding_id")
    .eq("organization_id", orgId)
    .eq("id", runId)
    .maybeSingle();

  if (runErr || !run) {
    return { data: null, error: runErr ?? { message: "run_not_found" } };
  }
  if ((run as { status: string }).status !== "awaiting_approval") {
    return { data: null, error: { message: "run_not_awaiting_approval" } };
  }

  const playbookId = String((run as { adaptive_playbook_id: string }).adaptive_playbook_id);
  const { data: playbook, error: pbErr } = await admin
    .from("adaptive_playbooks")
    .select("id, playbook_type, execution_template_json, follow_up_checks_json")
    .eq("organization_id", orgId)
    .eq("id", playbookId)
    .maybeSingle();

  if (pbErr || !playbook) {
    return { data: null, error: pbErr ?? { message: "playbook_not_found" } };
  }

  const input = ((run as { execution_input_json?: Record<string, unknown> }).execution_input_json ??
    {}) as Record<string, unknown>;
  const metricsBefore: V6PortfolioMetrics =
    (input.metrics_before_snapshot as V6PortfolioMetrics) ?? (await gatherPortfolioMetrics(admin, orgId));

  const template = (playbook.execution_template_json as Record<string, unknown>) ?? {};
  const execCtx: PlaybookExecutionContext = {
    sourceFindingId: (run as { source_finding_id?: string | null }).source_finding_id ?? null,
  };

  await admin
    .from("adaptive_playbook_steps")
    .update({
      status: "completed",
      output_json: { approved: true, approved_by: userId, at: nowIso() },
      completed_at: nowIso(),
    })
    .eq("organization_id", orgId)
    .eq("playbook_run_id", runId)
    .eq("step_key", "approval")
    .eq("status", "pending");

  await updateRowById(admin, "adaptive_playbook_runs", orgId, runId, {
    status: "running",
    result_json: { approved_at: nowIso(), approved_by: userId },
  });

  const { data: orderRow } = await admin
    .from("adaptive_playbook_steps")
    .select("step_order")
    .eq("organization_id", orgId)
    .eq("playbook_run_id", runId)
    .order("step_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  let stepOrder = Number((orderRow as { step_order?: number } | null)?.step_order ?? 0) + 1;

  const sideEffects = await executePlaybookSideEffects(
    admin,
    orgId,
    userId,
    String(playbook.playbook_type),
    template,
    execCtx
  );

  await insertStep(admin, orgId, runId, stepOrder++, "execution", "execution", sideEffects.error ? "failed" : "completed", {
    ...sideEffects.records,
    error: sideEffects.error ? String(sideEffects.error) : undefined,
  });

  const followUps = Array.isArray(playbook.follow_up_checks_json)
    ? (playbook.follow_up_checks_json as string[])
    : [];
  await insertStep(admin, orgId, runId, stepOrder++, "follow_up", "follow_up", "completed", {
    checks: followUps,
    note: followUps.length ? "scheduled_follow_up" : "none",
  });

  await seedPlaybookFollowUpRecommendations(
    admin,
    orgId,
    userId,
    runId,
    followUps,
    (run as { source_finding_id?: string | null }).source_finding_id ?? null
  );

  const metricsAfterPartial = await gatherPortfolioMetrics(admin, orgId);
  await insertStep(admin, orgId, runId, stepOrder++, "assessment", "assessment", "completed", {
    metrics_after: metricsAfterPartial,
    improved:
      metricsAfterPartial.open_exceptions + metricsAfterPartial.open_exceptions_in_progress <=
      metricsBefore.open_exceptions + metricsBefore.open_exceptions_in_progress,
  });

  await insertStep(admin, orgId, runId, stepOrder++, "postmortem", "postmortem", "completed", {
    summary: sideEffects.error
      ? "Playbook failed after approval during execution."
      : `Completed ${String(playbook.playbook_type)} after approval.`,
    playbook_type: playbook.playbook_type,
    follow_up_seeded: followUps.length > 0,
    at: nowIso(),
  });

  const completed = await updateRowById(admin, "adaptive_playbook_runs", orgId, runId, {
    status: sideEffects.error ? "failed" : "completed",
    completed_at: nowIso(),
    result_json: { success: !sideEffects.error, side_effects: sideEffects.records, after_approval: true },
    success_assessment_json: {
      restored_health: !sideEffects.error,
      stages: "full",
      exception_delta:
        metricsAfterPartial.open_exceptions +
        metricsAfterPartial.open_exceptions_in_progress -
        (metricsBefore.open_exceptions + metricsBefore.open_exceptions_in_progress),
      evidence_stale_delta: metricsAfterPartial.evidence_stale_proxy - metricsBefore.evidence_stale_proxy,
    },
  });

  if (!sideEffects.error && completed.data?.id) {
    const metricsAfter = await gatherPortfolioMetrics(admin, orgId);
    await recordPlaybookInterventionOutcome(admin, orgId, String(completed.data.id), metricsBefore, metricsAfter);
  }

  return { data: completed.data, error: completed.error ?? sideEffects.error };
}

export async function getPlaybookRun(admin: AdminClient, orgId: string, runId: string) {
  const { data: run, error } = await admin
    .from("adaptive_playbook_runs")
    .select(
      "id, organization_id, adaptive_playbook_id, source_finding_id, status, preview_json, execution_input_json, result_json, success_assessment_json, run_by, started_at, completed_at, created_at, updated_at"
    )
    .eq("organization_id", orgId)
    .eq("id", runId)
    .maybeSingle();

  if (error) return { run: null, steps: [], error };

  const { data: steps } = await admin
    .from("adaptive_playbook_steps")
    .select(
      "id, organization_id, playbook_run_id, step_key, step_order, stage, status, output_json, started_at, completed_at, created_at"
    )
    .eq("organization_id", orgId)
    .eq("playbook_run_id", runId)
    .order("step_order", { ascending: true });

  return { run, steps: steps ?? [], error: null };
}
