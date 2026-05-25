import type { AdminClient } from "@/lib/assurance/service";

/**
 * Lightweight adoption / health signal for the legacy assurance quality metrics JSON.
 */
export async function recordAssuranceActivity(
  admin: AdminClient,
  orgId: string,
  patch: Record<string, unknown>
) {
  const day = new Date().toISOString().slice(0, 10);
  const { data: row } = await admin
    .from("org_behavior_metrics")
    .select("id, v6_assurance_quality_json")
    .eq("organization_id", orgId)
    .eq("metrics_date", day)
    .maybeSingle();

  const prev = (row?.v6_assurance_quality_json as Record<string, unknown>) ?? {};
  const next = { ...prev, ...patch, updated_at: new Date().toISOString() };

  if (row?.id) {
    await admin
      .from("org_behavior_metrics")
      .update({ v6_assurance_quality_json: next })
      .eq("organization_id", orgId)
      .eq("id", row.id);
    return;
  }

  await admin.from("org_behavior_metrics").insert({
    organization_id: orgId,
    metrics_date: day,
    weekly_active_operators: 0,
    weekly_active_managers: 0,
    report_opens: 0,
    report_clicks: 0,
    dashboard_revisits: 0,
    stale_record_count: 0,
    unresolved_gap_count: 0,
    v6_assurance_quality_json: next,
  });
}

const METRICS_INSERT_DEFAULTS = {
  weekly_active_operators: 0,
  weekly_active_managers: 0,
  report_opens: 0,
  report_clicks: 0,
  dashboard_revisits: 0,
  stale_record_count: 0,
  unresolved_gap_count: 0,
};

/** Counters inside org_behavior_metrics.v6_assurance_quality_json (daily row). */
/** Known keys written by assurance routes and jobs (others may appear from JSON merges). */
export const ASSURANCE_QUALITY_COUNTER_FIELDS = [
  "api_get_assurance_findings_total",
  "api_get_assurance_scorecards_total",
  "api_get_assurance_health_graph_total",
  "api_get_assurance_analytics_summary_total",
  "api_get_assurance_finding_events_total",
  "api_get_assurance_check_run_detail_total",
  "api_get_assurance_check_runs_list_total",
  "api_get_scorecard_snapshots_list_total",
  "assurance_hub_layout_renders_total",
  "api_get_playbooks_list_total",
  "api_get_review_boards_list_total",
  "api_get_review_board_runs_list_total",
  "api_get_control_policies_list_total",
  "api_get_segments_list_total",
  "api_get_outcomes_interventions_total",
  "api_get_outcomes_program_effectiveness_total",
  "api_get_outcomes_control_effectiveness_total",
  "api_get_autopilot_rules_list_total",
  "api_get_autopilot_runs_list_total",
  "external_response_pack_merges_total",
  "external_collaboration_submissions_total",
  "external_public_status_polls_total",
  "external_workflow_step_appends_total",
  "external_action_links_created_total",
  "findings_labeled_false_positive_total",
  "review_board_notifications_delivered_total",
  "review_board_manual_generate_run_total",
  "api_get_playbook_run_detail_total",
  "evidence_submit_incremental_assurance_hook_total",
  "api_post_assurance_checks_run_total",
  "api_post_control_policies_create_total",
  "api_patch_control_policy_remediation_total",
  "api_post_control_policy_assign_total",
  "api_post_control_policy_simulate_total",
  "api_post_control_policy_publish_total",
  "api_post_playbook_preview_total",
  "api_post_playbook_run_total",
  "api_post_playbook_run_approve_total",
  "api_patch_review_board_total",
  "api_get_review_board_run_export_total",
  "api_patch_review_board_run_total",
  "api_post_autopilot_rule_create_total",
  "api_patch_autopilot_rule_total",
  "api_delete_autopilot_rule_total",
  "api_post_autopilot_enable_total",
  "api_post_autopilot_dry_run_total",
  "api_post_autopilot_revert_total",
  "api_post_segment_create_total",
  "api_post_segment_recompute_total",
  "api_get_program_evolution_experiments_list_total",
  "api_post_program_evolution_experiment_create_total",
  "api_post_program_evolution_simulate_total",
  "api_post_program_evolution_advance_rollout_total",
  "api_post_program_evolution_result_capture_total",
  "api_get_workspace_v6_settings_total",
  "api_patch_workspace_v6_settings_total",
  "api_post_assurance_workflows_run_all_total",
  "api_post_campaign_start_total",
  "api_post_campaign_close_total",
  "api_post_campaign_pause_total",
  "api_post_campaign_resume_total",
  "api_post_campaign_preview_total",
  "api_patch_campaign_total",
  "api_post_external_create_link_total",
  "cron_v6_assurance_checks_org_ok_total",
  "cron_v6_finding_refresh_org_processed_total",
  "cron_v6_autopilot_dry_run_org_ok_total",
  "cron_v6_autopilot_execution_org_ok_total",
  "cron_v6_scorecard_recompute_org_ok_total",
  "cron_v6_health_graph_org_ok_total",
  "cron_v6_control_policy_reeval_org_ok_total",
  "cron_v6_outcome_effectiveness_org_ok_total",
  "cron_v6_review_board_packet_org_ok_total",
  "cron_v6_segment_recompute_org_ok_total",
  "cron_v6_playbook_followup_assurance_org_ok_total",
  "cron_v6_external_deadline_org_touched_total",
] as const;

export async function incrementAssuranceQualityCounter(
  admin: AdminClient,
  orgId: string,
  field: string,
  delta = 1
) {
  if (!field || !Number.isFinite(delta) || delta === 0) return;
  const day = new Date().toISOString().slice(0, 10);
  const { data: row } = await admin
    .from("org_behavior_metrics")
    .select("id, v6_assurance_quality_json")
    .eq("organization_id", orgId)
    .eq("metrics_date", day)
    .maybeSingle();

  const prev = (row?.v6_assurance_quality_json as Record<string, unknown>) ?? {};
  const prevVal = Number(prev[field] ?? 0);
  const safeVal = Number.isFinite(prevVal) ? prevVal : 0;
  const cur = safeVal + delta;
  const next = { ...prev, [field]: cur, updated_at: new Date().toISOString() };

  if (row?.id) {
    await admin
      .from("org_behavior_metrics")
      .update({ v6_assurance_quality_json: next })
      .eq("organization_id", orgId)
      .eq("id", row.id);
    return;
  }

  await admin.from("org_behavior_metrics").insert({
    organization_id: orgId,
    metrics_date: day,
    ...METRICS_INSERT_DEFAULTS,
    v6_assurance_quality_json: next,
  });
}

const MAX_ASSURANCE_HUB_VISITOR_IDS = 400;

/**
 * Tracks distinct workspace users hitting /assurance/* (per day, capped list in v6_assurance_quality_json).
 * Roll up unique IDs across recent days in analytics for a weekly-active style signal.
 */
export async function recordAssuranceHubVisitor(admin: AdminClient, orgId: string, userId: string) {
  const uid = String(userId ?? "").trim();
  if (!uid) return;
  const day = new Date().toISOString().slice(0, 10);
  const { data: row } = await admin
    .from("org_behavior_metrics")
    .select("id, v6_assurance_quality_json")
    .eq("organization_id", orgId)
    .eq("metrics_date", day)
    .maybeSingle();

  const prev = (row?.v6_assurance_quality_json as Record<string, unknown>) ?? {};
  const raw = prev.assurance_hub_visitor_ids;
  const existing = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string" && x.length > 0) : [];
  const nextIds = existing.includes(uid) ? existing : [...existing, uid];
  const trimmed = nextIds.slice(-MAX_ASSURANCE_HUB_VISITOR_IDS);
  const next = {
    ...prev,
    assurance_hub_visitor_ids: trimmed,
    updated_at: new Date().toISOString(),
  };

  if (row?.id) {
    await admin
      .from("org_behavior_metrics")
      .update({ v6_assurance_quality_json: next })
      .eq("organization_id", orgId)
      .eq("id", row.id);
    return;
  }

  await admin.from("org_behavior_metrics").insert({
    organization_id: orgId,
    metrics_date: day,
    ...METRICS_INSERT_DEFAULTS,
    v6_assurance_quality_json: next,
  });
}

export const V6_QUALITY_COUNTER_FIELDS = ASSURANCE_QUALITY_COUNTER_FIELDS;
export const recordV6AssuranceActivity = recordAssuranceActivity;
export const incrementV6QualityCounter = incrementAssuranceQualityCounter;

// Version-name compatibility aliases. Prefer neutral exports in new code.
export { incrementV6QualityCounter as incrementQualityCounter };
export { V6_QUALITY_COUNTER_FIELDS as QUALITY_COUNTER_FIELDS };
// End version-name compatibility aliases.
