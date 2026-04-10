/**
 * V6 §10 reference workflows — used for demos and by POST /api/assurance/workflows/run-all (maintenance_manage).
 *
 * Production vs run-all: live assurance is driven by assurance checks, playbook runs, control-policy evaluation,
 * external collaboration links, and scheduled V6 crons. The five functions below intentionally create small,
 * id-shaped rows (findings, playbook runs, simulations, campaigns, links, experiments, review boards) so operators
 * can validate wiring after deploy; they are not replayable “business process” engines and should not be called
 * from product UI as a substitute for user-initiated flows.
 */
import { randomUUID } from "node:crypto";
import type { AdminClient } from "@/lib/v6/service";
import { createRow, updateRowById } from "@/lib/v6/service";
import { nowIso } from "@/lib/v5/api";

const WORKFLOW_PLAYBOOK_NAME = "__v6_workflow_intervention_seed__";
const WORKFLOW_BOARD_NAME_PREFIX = "Weekly portfolio health";

function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

async function getOrCreateWorkflowPlaybook(admin: AdminClient, orgId: string, userId: string) {
  const { data: existing } = await admin
    .from("adaptive_playbooks")
    .select("id")
    .eq("organization_id", orgId)
    .eq("name", WORKFLOW_PLAYBOOK_NAME)
    .maybeSingle();

  if (existing?.id) return { id: existing.id as string };

  const created = await createRow(admin, "adaptive_playbooks", orgId, {
    name: WORKFLOW_PLAYBOOK_NAME,
    playbook_type: "finding_to_intervention",
    eligibility_json: { source: "v6_workflow_seed" },
    execution_template_json: { mode: "guided_demo" },
    created_by: userId,
  });
  return { id: created.data?.id as string | undefined, error: created.error };
}

/**
 * §10 Workflow 1: finding → intervention (uses valid playbook FK).
 */
export async function workflowFindingToIntervention(admin: AdminClient, orgId: string, userId: string) {
  const pb = await getOrCreateWorkflowPlaybook(admin, orgId, userId);
  if (!pb.id) {
    return { error: pb.error ?? "playbook_missing", finding: null, playbookRun: null };
  }

  const finding = await createRow(admin, "assurance_findings", orgId, {
    finding_type: "weakening_pattern",
    title: "Finding to intervention workflow",
    severity: "medium",
    confidence: 72,
    status: "open",
    recommended_playbook_id: pb.id,
  });

  const playbookRun = await createRow(admin, "adaptive_playbook_runs", orgId, {
    adaptive_playbook_id: pb.id,
    source_finding_id: finding.data?.id,
    status: "running",
    execution_input_json: { mode: "guided" },
    run_by: userId,
    started_at: nowIso(),
  });

  await updateRowById(admin, "adaptive_playbook_runs", orgId, String(playbookRun.data?.id), {
    status: "completed",
    completed_at: nowIso(),
    success_assessment_json: { improved: true, workflow: "finding_to_intervention" },
    result_json: { workflow: "demo_complete" },
  });

  return { finding: finding.data, playbookRun: playbookRun.data, errors: [finding.error, playbookRun.error].filter(Boolean) };
}

/**
 * §10 Workflow 2: policy breach → simulation run → remediation campaign.
 */
export async function workflowPolicyBreachRemediation(admin: AdminClient, orgId: string, userId: string) {
  const simulation = await createRow(admin, "change_simulations", orgId, {
    simulation_type: "control_policy",
    name: "V6 policy breach preview",
    input_json: { source: "v6_workflow", scope: "portfolio" },
    created_by: userId,
  });

  const simId = simulation.data?.id as string | undefined;
  if (!simId) {
    return { run: null, campaign: null, error: simulation.error };
  }

  const run = await createRow(admin, "change_simulation_runs", orgId, {
    simulation_id: simId,
    status: "completed",
    result_json: { preview: "candidate_actions", workflow: "policy_breach_remediation" },
    created_by: userId,
  });

  const campaign = await createRow(admin, "portfolio_campaigns", orgId, {
    campaign_type: "remediation_push",
    status: "active",
    name: "Policy breach remediation",
    eligibility_json: { source: "v6_workflow" },
    assignment_json: {},
    preview_summary_json: { simulation_run_id: run.data?.id },
    created_by: userId,
  });

  if (campaign.data?.id && run.data?.id) {
    await admin
      .from("change_simulation_runs")
      .update({ promoted_campaign_id: campaign.data.id })
      .eq("organization_id", orgId)
      .eq("id", run.data.id);
  }

  return { run: run.data, campaign: campaign.data, simulation: simulation.data, errors: [simulation.error, run.error, campaign.error].filter(Boolean) };
}

/**
 * §10 Workflow 3: external evidence refresh loop (valid expiry, scoped chain).
 */
export async function workflowExternalEvidenceRefresh(admin: AdminClient, orgId: string, userId: string) {
  const link = await createRow(admin, "external_action_links", orgId, {
    token: `v6-${randomUUID()}`,
    action_type: "evidence_refresh_loop",
    status: "open",
    expires_at: isoDaysFromNow(7),
    scope_json: {
      reason: "evidence_freshness",
      workflow_chain: [{ type: "request_refresh", at: nowIso(), deadline: isoDaysFromNow(5) }],
    },
    created_by: userId,
  });
  return { link: link.data, error: link.error };
}

/**
 * §10 Workflow 4: program performance tuning experiment stub.
 */
export async function workflowProgramPerformanceTuning(admin: AdminClient, orgId: string, userId: string) {
  const experiment = await createRow(admin, "program_evolution_experiments", orgId, {
    status: "running",
    hypothesis: "Candidate version improves readiness",
    simulation_summary_json: { projected_gain: 5 },
    rollout_plan_json: { stage: "segment_only" },
    created_by: userId,
  });
  return { experiment: experiment.data, error: experiment.error };
}

/**
 * §10 Workflow 5: portfolio board review (unique board name per invocation to satisfy unique constraint).
 */
export async function workflowPortfolioBoardReview(admin: AdminClient, orgId: string, userId: string) {
  const uniqueName = `${WORKFLOW_BOARD_NAME_PREFIX} · ${new Date().toISOString().slice(0, 16)}`;

  const board = await createRow(admin, "review_boards", orgId, {
    name: uniqueName,
    board_type: "weekly_portfolio_health",
    cadence: "weekly",
    agenda_template_json: { sections: ["findings", "scorecards", "campaigns"] },
    created_by: userId,
  });

  const run = await createRow(admin, "review_board_runs", orgId, {
    review_board_id: board.data?.id,
    status: "generated",
    agenda_json: { generated: true, workflow: "portfolio_board_review" },
    packet_json: { generated_at: nowIso(), workflow: true },
    generated_by: userId,
  });

  return { board: board.data, run: run.data, errors: [board.error, run.error].filter(Boolean) };
}
