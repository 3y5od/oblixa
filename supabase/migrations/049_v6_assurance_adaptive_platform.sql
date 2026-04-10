-- V6 assurance + adaptive platform foundation
-- Introduces control policies, assurance findings/checks, adaptive playbooks,
-- autopilot, scorecards, health graph, review boards, segments, outcomes,
-- and program evolution entities.

create table if not exists public.control_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  objective text not null,
  scope_json jsonb not null default '{}'::jsonb,
  severity_model_json jsonb not null default '{}'::jsonb,
  enforcement_mode text not null default 'observe_only' check (
    enforcement_mode in (
      'observe_only',
      'warn',
      'create_exception',
      'require_decision_workspace',
      'trigger_campaign',
      'trigger_autopilot_action',
      'escalate_immediately'
    )
  ),
  remediation_playbook_id uuid,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  latest_version_id uuid,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.control_policy_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  control_policy_id uuid not null references public.control_policies(id) on delete cascade,
  version integer not null check (version > 0),
  objective text not null,
  policy_json jsonb not null default '{}'::jsonb,
  evidence_expectations_json jsonb not null default '{}'::jsonb,
  sla_thresholds_json jsonb not null default '{}'::jsonb,
  exemption_rules_json jsonb not null default '[]'::jsonb,
  severity_model_json jsonb not null default '{}'::jsonb,
  enforcement_mode text not null default 'observe_only' check (
    enforcement_mode in (
      'observe_only',
      'warn',
      'create_exception',
      'require_decision_workspace',
      'trigger_campaign',
      'trigger_autopilot_action',
      'escalate_immediately'
    )
  ),
  published boolean not null default false,
  published_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, control_policy_id, version)
);

create table if not exists public.control_policy_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  control_policy_id uuid not null references public.control_policies(id) on delete cascade,
  control_policy_version_id uuid references public.control_policy_versions(id) on delete set null,
  assignment_type text not null check (assignment_type in ('segment', 'account', 'counterparty', 'program', 'contract_class', 'global')),
  segment_id uuid,
  target_ref_type text,
  target_ref_id text,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.assurance_findings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  finding_type text not null,
  title text not null,
  summary text,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  confidence numeric(5,2) not null default 0,
  scope_json jsonb not null default '{}'::jsonb,
  linked_controls_json jsonb not null default '[]'::jsonb,
  linked_entities_json jsonb not null default '[]'::jsonb,
  recommended_playbook_id uuid,
  analyst_note text,
  status text not null default 'open' check (status in ('open', 'in_review', 'resolved', 'dismissed')),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id),
  source_check_run_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assurance_finding_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  finding_id uuid not null references public.assurance_findings(id) on delete cascade,
  event_type text not null,
  payload_json jsonb not null default '{}'::jsonb,
  actor_user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.assurance_check_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  check_type text not null,
  trigger_type text not null default 'scheduled' check (trigger_type in ('scheduled', 'event', 'manual')),
  status text not null default 'completed' check (status in ('queued', 'running', 'completed', 'failed')),
  summary_json jsonb not null default '{}'::jsonb,
  risk_delta_json jsonb not null default '{}'::jsonb,
  watch_signals_json jsonb not null default '[]'::jsonb,
  recommended_interventions_json jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.assurance_findings
  drop constraint if exists assurance_findings_source_check_run_id_fkey;
alter table public.assurance_findings
  add constraint assurance_findings_source_check_run_id_fkey
  foreign key (source_check_run_id) references public.assurance_check_runs(id) on delete set null;

create table if not exists public.adaptive_playbooks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  playbook_type text not null,
  eligibility_json jsonb not null default '{}'::jsonb,
  preconditions_json jsonb not null default '{}'::jsonb,
  approval_mode text not null default 'optional' check (approval_mode in ('none', 'optional', 'required')),
  execution_template_json jsonb not null default '{}'::jsonb,
  follow_up_checks_json jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

alter table public.control_policies
  drop constraint if exists control_policies_remediation_playbook_id_fkey;
alter table public.control_policies
  add constraint control_policies_remediation_playbook_id_fkey
  foreign key (remediation_playbook_id) references public.adaptive_playbooks(id) on delete set null;

create table if not exists public.adaptive_playbook_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  adaptive_playbook_id uuid not null references public.adaptive_playbooks(id) on delete cascade,
  source_finding_id uuid references public.assurance_findings(id) on delete set null,
  status text not null default 'queued' check (status in ('queued', 'previewed', 'awaiting_approval', 'running', 'completed', 'failed', 'cancelled')),
  preview_json jsonb not null default '{}'::jsonb,
  execution_input_json jsonb not null default '{}'::jsonb,
  result_json jsonb not null default '{}'::jsonb,
  success_assessment_json jsonb not null default '{}'::jsonb,
  run_by uuid references auth.users(id),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.adaptive_playbook_steps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  playbook_run_id uuid not null references public.adaptive_playbook_runs(id) on delete cascade,
  step_key text not null,
  step_order integer not null default 0,
  stage text not null check (stage in ('eligibility', 'preconditions', 'dry_run', 'approval', 'execution', 'follow_up', 'assessment', 'postmortem')),
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed', 'skipped')),
  output_json jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, playbook_run_id, step_key)
);

create table if not exists public.portfolio_health_graph_nodes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  node_type text not null,
  node_ref_id text not null,
  label text,
  risk_score numeric(6,2) not null default 0,
  concentration_score numeric(6,2) not null default 0,
  metadata_json jsonb not null default '{}'::jsonb,
  snapshot_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, node_type, node_ref_id)
);

create table if not exists public.portfolio_health_graph_edges (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_node_id uuid not null references public.portfolio_health_graph_nodes(id) on delete cascade,
  target_node_id uuid not null references public.portfolio_health_graph_nodes(id) on delete cascade,
  relationship_type text not null,
  weight numeric(8,4) not null default 1,
  propagation_risk numeric(6,2) not null default 0,
  explainability_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, source_node_id, target_node_id, relationship_type)
);

create table if not exists public.assurance_scorecards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  scorecard_type text not null check (scorecard_type in ('team', 'account', 'segment', 'program', 'counterparty')),
  entity_ref_id text not null,
  overall_score numeric(6,2) not null default 0,
  dimensions_json jsonb not null default '{}'::jsonb,
  score_drivers_json jsonb not null default '[]'::jsonb,
  summary_json jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, scorecard_type, entity_ref_id)
);

create table if not exists public.scorecard_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assurance_scorecard_id uuid not null references public.assurance_scorecards(id) on delete cascade,
  snapshot_at timestamptz not null default now(),
  overall_score numeric(6,2) not null default 0,
  dimensions_json jsonb not null default '{}'::jsonb,
  score_drivers_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.outcome_intervention_analyses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  intervention_type text not null,
  intervention_ref_id text,
  source_playbook_run_id uuid references public.adaptive_playbook_runs(id) on delete set null,
  source_campaign_id uuid references public.portfolio_campaigns(id) on delete set null,
  source_control_policy_id uuid references public.control_policies(id) on delete set null,
  before_metrics_json jsonb not null default '{}'::jsonb,
  after_metrics_json jsonb not null default '{}'::jsonb,
  effectiveness_score numeric(6,2) not null default 0,
  recurrence_delta numeric(6,2) not null default 0,
  time_to_stability_hours numeric(10,2),
  workload_tradeoff_json jsonb not null default '{}'::jsonb,
  false_signal_rates_json jsonb not null default '{}'::jsonb,
  recommendation_effectiveness_json jsonb not null default '{}'::jsonb,
  analyzed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.review_boards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  board_type text not null check (
    board_type in (
      'weekly_portfolio_health',
      'monthly_control_effectiveness',
      'renewal_readiness',
      'evidence_compliance',
      'campaign_effectiveness',
      'counterparty_risk'
    )
  ),
  cadence text not null default 'weekly' check (cadence in ('weekly', 'biweekly', 'monthly', 'quarterly')),
  active boolean not null default true,
  agenda_template_json jsonb not null default '{}'::jsonb,
  subscriptions_json jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.review_board_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  review_board_id uuid not null references public.review_boards(id) on delete cascade,
  status text not null default 'generated' check (status in ('generated', 'reviewed', 'closed')),
  agenda_json jsonb not null default '{}'::jsonb,
  packet_json jsonb not null default '{}'::jsonb,
  unresolved_findings_json jsonb not null default '[]'::jsonb,
  action_capture_json jsonb not null default '[]'::jsonb,
  decision_log_json jsonb not null default '[]'::jsonb,
  generated_by uuid references auth.users(id),
  generated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.segment_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  segment_type text not null check (segment_type in ('business_unit', 'region', 'product_line', 'contract_class', 'customer_tier', 'operational_tier', 'control_sensitivity_tier', 'custom')),
  key text not null,
  name text not null,
  criteria_json jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, key)
);

create table if not exists public.segment_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  segment_definition_id uuid not null references public.segment_definitions(id) on delete cascade,
  entity_type text not null check (entity_type in ('contract', 'account', 'counterparty', 'program', 'owner', 'team')),
  entity_ref_id text not null,
  computed_at timestamptz not null default now(),
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, segment_definition_id, entity_type, entity_ref_id)
);

alter table public.control_policy_assignments
  drop constraint if exists control_policy_assignments_segment_id_fkey;
alter table public.control_policy_assignments
  add constraint control_policy_assignments_segment_id_fkey
  foreign key (segment_id) references public.segment_definitions(id) on delete set null;

create table if not exists public.autopilot_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  action_type text not null,
  enabled boolean not null default false,
  severity_threshold text not null default 'low' check (severity_threshold in ('low', 'medium', 'high', 'critical')),
  sensitivity_tier text,
  allowlist_json jsonb not null default '[]'::jsonb,
  dry_run_count integer not null default 0,
  requires_approval boolean not null default true,
  reversible boolean not null default false,
  guardrails_json jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.autopilot_run_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  autopilot_rule_id uuid not null references public.autopilot_rules(id) on delete cascade,
  status text not null default 'dry_run' check (status in ('dry_run', 'executed', 'blocked', 'failed', 'reverted')),
  action_type text not null,
  target_ref_type text,
  target_ref_id text,
  finding_id uuid references public.assurance_findings(id) on delete set null,
  playbook_run_id uuid references public.adaptive_playbook_runs(id) on delete set null,
  input_json jsonb not null default '{}'::jsonb,
  output_json jsonb not null default '{}'::jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.program_evolution_experiments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  program_id uuid references public.contract_programs(id) on delete set null,
  baseline_program_version_id uuid references public.contract_program_versions(id) on delete set null,
  candidate_program_version_id uuid references public.contract_program_versions(id) on delete set null,
  target_segment_id uuid references public.segment_definitions(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'simulated', 'running', 'completed', 'cancelled')),
  hypothesis text,
  simulation_summary_json jsonb not null default '{}'::jsonb,
  rollout_plan_json jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.program_evolution_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  experiment_id uuid not null references public.program_evolution_experiments(id) on delete cascade,
  period_start date,
  period_end date,
  health_impact_json jsonb not null default '{}'::jsonb,
  scorecard_delta_json jsonb not null default '{}'::jsonb,
  decision_slippage_delta numeric(10,2),
  recommendation_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- existing entity extensions
alter table public.decision_workspaces
  add column if not exists v6_assurance_context_json jsonb not null default '{}'::jsonb;

alter table public.portfolio_campaigns
  add column if not exists v6_effectiveness_json jsonb not null default '{}'::jsonb;

alter table public.change_simulations
  add column if not exists v6_scope_json jsonb not null default '{}'::jsonb;

alter table public.capacity_forecasts
  add column if not exists v6_assurance_projection_json jsonb not null default '{}'::jsonb;

alter table public.relationship_timelines
  add column if not exists v6_risk_propagation_json jsonb not null default '{}'::jsonb;

alter table public.operational_recommendations
  add column if not exists v6_outcome_tracking_json jsonb not null default '{}'::jsonb;

alter table public.report_packs
  add column if not exists v6_assurance_pack_json jsonb not null default '{}'::jsonb;

alter table public.org_behavior_metrics
  add column if not exists v6_assurance_quality_json jsonb not null default '{}'::jsonb;

alter table public.exceptions
  add column if not exists assurance_finding_id uuid references public.assurance_findings(id) on delete set null;

alter table public.evidence_submissions
  add column if not exists v6_freshness_score numeric(6,2) not null default 0;

-- indexes
create index if not exists idx_control_policies_org_status on public.control_policies (organization_id, status, updated_at desc);
create index if not exists idx_control_policy_versions_org_policy on public.control_policy_versions (organization_id, control_policy_id, version desc);
create index if not exists idx_control_policy_assignments_org_policy on public.control_policy_assignments (organization_id, control_policy_id, active);
create index if not exists idx_assurance_findings_org_status on public.assurance_findings (organization_id, status, severity, updated_at desc);
create index if not exists idx_assurance_finding_events_org_finding on public.assurance_finding_events (organization_id, finding_id, created_at desc);
create index if not exists idx_assurance_check_runs_org on public.assurance_check_runs (organization_id, check_type, created_at desc);
create index if not exists idx_adaptive_playbooks_org on public.adaptive_playbooks (organization_id, active, updated_at desc);
create index if not exists idx_adaptive_playbook_runs_org on public.adaptive_playbook_runs (organization_id, status, created_at desc);
create index if not exists idx_adaptive_playbook_steps_org_run on public.adaptive_playbook_steps (organization_id, playbook_run_id, step_order);
create index if not exists idx_health_graph_nodes_org on public.portfolio_health_graph_nodes (organization_id, node_type, risk_score desc);
create index if not exists idx_health_graph_edges_org on public.portfolio_health_graph_edges (organization_id, relationship_type, propagation_risk desc);
create index if not exists idx_assurance_scorecards_org on public.assurance_scorecards (organization_id, scorecard_type, overall_score desc);
create index if not exists idx_scorecard_snapshots_org on public.scorecard_snapshots (organization_id, snapshot_at desc);
create index if not exists idx_outcome_intervention_analyses_org on public.outcome_intervention_analyses (organization_id, analyzed_at desc);
create index if not exists idx_review_boards_org on public.review_boards (organization_id, active, updated_at desc);
create index if not exists idx_review_board_runs_org on public.review_board_runs (organization_id, generated_at desc);
create index if not exists idx_segment_definitions_org on public.segment_definitions (organization_id, segment_type, key);
create index if not exists idx_segment_memberships_org on public.segment_memberships (organization_id, segment_definition_id, entity_type);
create index if not exists idx_autopilot_rules_org on public.autopilot_rules (organization_id, enabled, updated_at desc);
create index if not exists idx_autopilot_run_logs_org on public.autopilot_run_logs (organization_id, created_at desc);
create index if not exists idx_program_evolution_experiments_org on public.program_evolution_experiments (organization_id, status, updated_at desc);
create index if not exists idx_program_evolution_results_org on public.program_evolution_results (organization_id, created_at desc);

-- update_updated_at triggers
create or replace function public.v6_apply_updated_at_trigger(table_name text)
returns void
language plpgsql
as $$
begin
  execute format('drop trigger if exists update_%I_updated_at on public.%I', table_name, table_name);
  execute format(
    'create trigger update_%I_updated_at before update on public.%I for each row execute function public.update_updated_at()',
    table_name,
    table_name
  );
end;
$$;

select public.v6_apply_updated_at_trigger('control_policies');
select public.v6_apply_updated_at_trigger('adaptive_playbooks');
select public.v6_apply_updated_at_trigger('adaptive_playbook_runs');
select public.v6_apply_updated_at_trigger('portfolio_health_graph_nodes');
select public.v6_apply_updated_at_trigger('portfolio_health_graph_edges');
select public.v6_apply_updated_at_trigger('assurance_findings');
select public.v6_apply_updated_at_trigger('assurance_scorecards');
select public.v6_apply_updated_at_trigger('review_boards');
select public.v6_apply_updated_at_trigger('review_board_runs');
select public.v6_apply_updated_at_trigger('segment_definitions');
select public.v6_apply_updated_at_trigger('autopilot_rules');
select public.v6_apply_updated_at_trigger('program_evolution_experiments');

-- RLS
alter table public.control_policies enable row level security;
alter table public.control_policy_versions enable row level security;
alter table public.control_policy_assignments enable row level security;
alter table public.assurance_findings enable row level security;
alter table public.assurance_finding_events enable row level security;
alter table public.assurance_check_runs enable row level security;
alter table public.adaptive_playbooks enable row level security;
alter table public.adaptive_playbook_runs enable row level security;
alter table public.adaptive_playbook_steps enable row level security;
alter table public.portfolio_health_graph_nodes enable row level security;
alter table public.portfolio_health_graph_edges enable row level security;
alter table public.assurance_scorecards enable row level security;
alter table public.scorecard_snapshots enable row level security;
alter table public.outcome_intervention_analyses enable row level security;
alter table public.review_boards enable row level security;
alter table public.review_board_runs enable row level security;
alter table public.segment_definitions enable row level security;
alter table public.segment_memberships enable row level security;
alter table public.autopilot_rules enable row level security;
alter table public.autopilot_run_logs enable row level security;
alter table public.program_evolution_experiments enable row level security;
alter table public.program_evolution_results enable row level security;

do $$
declare
  table_name text;
  tables text[] := array[
    'control_policies',
    'control_policy_versions',
    'control_policy_assignments',
    'assurance_findings',
    'assurance_finding_events',
    'assurance_check_runs',
    'adaptive_playbooks',
    'adaptive_playbook_runs',
    'adaptive_playbook_steps',
    'portfolio_health_graph_nodes',
    'portfolio_health_graph_edges',
    'assurance_scorecards',
    'scorecard_snapshots',
    'outcome_intervention_analyses',
    'review_boards',
    'review_board_runs',
    'segment_definitions',
    'segment_memberships',
    'autopilot_rules',
    'autopilot_run_logs',
    'program_evolution_experiments',
    'program_evolution_results'
  ];
begin
  foreach table_name in array tables loop
    execute format('drop policy if exists "Members can view %1$s in their org" on public.%1$s', table_name);
    execute format(
      'create policy "Members can view %1$s in their org" on public.%1$s for select using (public.is_org_member(organization_id))',
      table_name
    );

    execute format('drop policy if exists "Editors can manage %1$s in their org" on public.%1$s', table_name);
    execute format(
      'create policy "Editors can manage %1$s in their org" on public.%1$s for all using (exists (select 1 from public.organization_members where organization_id = %1$s.organization_id and user_id = auth.uid() and role in (''admin'',''editor'',''ops_manager'',''manager''))) with check (exists (select 1 from public.organization_members where organization_id = %1$s.organization_id and user_id = auth.uid() and role in (''admin'',''editor'',''ops_manager'',''manager'')))',
      table_name
    );
  end loop;
end $$;

drop function if exists public.v6_apply_updated_at_trigger(text);
