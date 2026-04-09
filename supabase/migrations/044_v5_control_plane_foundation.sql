-- V5 control plane foundation:
-- decision workspaces, portfolio campaigns, simulations, external actions,
-- relationship timelines, capacity forecasting, and recommendation entities.

-- 1) Decision workspaces
create table if not exists public.decision_workspaces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  decision_type text not null check (
    decision_type in (
      'renewal_recommendation',
      'amendment_request',
      'waiver_or_exception_disposition',
      'obligation_extension',
      'ownership_transfer_decision',
      'policy_exception_decision',
      'termination_recommendation',
      'remediation_acceptance_decision'
    )
  ),
  status text not null default 'draft' check (status in ('draft', 'open', 'in_review', 'approved', 'closed')),
  title text not null,
  linked_contract_ids uuid[] not null default '{}',
  linked_account_key text,
  linked_counterparty_key text,
  owner_user_id uuid references auth.users(id),
  due_at timestamptz,
  required_inputs_json jsonb not null default '{}'::jsonb,
  recommendation_json jsonb not null default '{}'::jsonb,
  rationale_markdown text,
  approval_path_json jsonb not null default '[]'::jsonb,
  final_disposition_json jsonb not null default '{}'::jsonb,
  post_decision_actions_json jsonb not null default '[]'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.decision_workspace_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  decision_workspace_id uuid not null references public.decision_workspaces(id) on delete cascade,
  event_type text not null,
  payload_json jsonb not null default '{}'::jsonb,
  actor_user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.decision_workspace_stakeholders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  decision_workspace_id uuid not null references public.decision_workspaces(id) on delete cascade,
  stakeholder_user_id uuid references auth.users(id),
  stakeholder_role text not null default 'reviewer',
  status text not null default 'pending' check (status in ('pending', 'responded', 'approved', 'rejected')),
  notes text,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.decision_recommendations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  decision_workspace_id uuid not null references public.decision_workspaces(id) on delete cascade,
  recommendation_type text not null,
  recommendation_text text not null,
  confidence numeric(5,2) not null default 0,
  reasons_json jsonb not null default '[]'::jsonb,
  source_object_refs_json jsonb not null default '[]'::jsonb,
  accepted boolean not null default false,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) Portfolio campaigns
create table if not exists public.portfolio_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_type text not null,
  status text not null default 'draft' check (status in ('draft', 'previewed', 'active', 'paused', 'closed')),
  name text not null,
  owner_user_id uuid references auth.users(id),
  eligibility_json jsonb not null default '{}'::jsonb,
  assignment_json jsonb not null default '{}'::jsonb,
  preview_summary_json jsonb not null default '{}'::jsonb,
  progress_summary_json jsonb not null default '{}'::jsonb,
  rollback_safe boolean not null default false,
  rolled_back_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portfolio_campaign_contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.portfolio_campaigns(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  segment_key text,
  assigned_team text,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'processed', 'failed', 'skipped')),
  status_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, campaign_id, contract_id)
);

create table if not exists public.portfolio_campaign_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.portfolio_campaigns(id) on delete cascade,
  event_type text not null,
  payload_json jsonb not null default '{}'::jsonb,
  actor_user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- 3) Relationship workspaces
create table if not exists public.account_workspaces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_key text not null,
  display_name text not null,
  owner_user_id uuid references auth.users(id),
  summary_json jsonb not null default '{}'::jsonb,
  health_signal_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, account_key)
);

create table if not exists public.counterparty_workspaces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  counterparty_key text not null,
  display_name text not null,
  owner_user_id uuid references auth.users(id),
  summary_json jsonb not null default '{}'::jsonb,
  health_signal_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, counterparty_key)
);

-- 4) External actions
create table if not exists public.external_action_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  token text not null unique,
  action_type text not null,
  status text not null default 'open' check (status in ('open', 'submitted', 'expired', 'revoked')),
  expires_at timestamptz not null,
  scope_json jsonb not null default '{}'::jsonb,
  requires_reauth boolean not null default false,
  one_time boolean not null default true,
  submitted_at timestamptz,
  submitted_payload_json jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.external_action_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  external_action_link_id uuid not null references public.external_action_links(id) on delete cascade,
  event_type text not null,
  payload_json jsonb not null default '{}'::jsonb,
  actor_user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- 5) Simulations and capacity
create table if not exists public.change_simulations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  simulation_type text not null,
  name text not null,
  input_json jsonb not null default '{}'::jsonb,
  latest_run_id uuid,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.change_simulation_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  simulation_id uuid not null references public.change_simulations(id) on delete cascade,
  status text not null default 'completed' check (status in ('queued', 'running', 'completed', 'failed')),
  result_json jsonb not null default '{}'::jsonb,
  promoted_campaign_id uuid references public.portfolio_campaigns(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.capacity_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  snapshot_date date not null,
  by_role_json jsonb not null default '{}'::jsonb,
  by_program_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, snapshot_date)
);

create table if not exists public.capacity_forecasts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  forecast_horizon_days integer not null default 30,
  forecast_json jsonb not null default '{}'::jsonb,
  model_version text,
  generated_at timestamptz not null default now(),
  expires_at timestamptz
);

create table if not exists public.operational_recommendations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  recommendation_type text not null,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  target_ref_type text not null,
  target_ref_id text not null,
  recommendation_text text not null,
  reason_json jsonb not null default '[]'::jsonb,
  confidence numeric(5,2) not null default 0,
  accepted boolean not null default false,
  dismissed boolean not null default false,
  generated_at timestamptz not null default now(),
  expires_at timestamptz
);

-- 6) Relationship timeline
create table if not exists public.relationship_timelines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_workspace_id uuid references public.account_workspaces(id) on delete set null,
  counterparty_workspace_id uuid references public.counterparty_workspaces(id) on delete set null,
  title text not null,
  summary_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.relationship_timeline_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  relationship_timeline_id uuid not null references public.relationship_timelines(id) on delete cascade,
  event_type text not null,
  event_at timestamptz not null default now(),
  payload_json jsonb not null default '{}'::jsonb,
  linked_contract_id uuid references public.contracts(id) on delete set null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- 7) Decision packets 2.0
create table if not exists public.decision_packet_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  packet_type text not null,
  template_json jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.decision_packet_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  decision_workspace_id uuid references public.decision_workspaces(id) on delete set null,
  packet_template_id uuid references public.decision_packet_templates(id) on delete set null,
  packet_type text not null,
  payload_json jsonb not null default '{}'::jsonb,
  exported_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Existing entities extension (additive only)
alter table public.contracts
  add column if not exists account_key text,
  add column if not exists counterparty_key text;

alter table public.contract_program_assignments
  add column if not exists v5_campaign_id uuid references public.portfolio_campaigns(id) on delete set null;

alter table public.exceptions
  add column if not exists decision_workspace_id uuid references public.decision_workspaces(id) on delete set null;

alter table public.evidence_submissions
  add column if not exists external_action_link_id uuid references public.external_action_links(id) on delete set null;

alter table public.attestation_requests
  add column if not exists decision_workspace_id uuid references public.decision_workspaces(id) on delete set null;

alter table public.approval_slas
  add column if not exists decision_workspace_id uuid references public.decision_workspaces(id) on delete set null;

alter table public.report_packs
  add column if not exists v5_packet_type text;

alter table public.report_pack_runs
  add column if not exists linked_decision_workspace_id uuid references public.decision_workspaces(id) on delete set null;

alter table public.role_command_center_preferences
  add column if not exists v5_home_layout_json jsonb not null default '{}'::jsonb;

alter table public.org_behavior_metrics
  add column if not exists v5_signal_quality_json jsonb not null default '{}'::jsonb;

alter table public.saved_views
  add column if not exists v5_scope text;

alter table public.operational_casefile_events
  add column if not exists relationship_timeline_id uuid references public.relationship_timelines(id) on delete set null;

-- Foreign key added after both tables exist.
alter table public.change_simulations
  drop constraint if exists change_simulations_latest_run_id_fkey;
alter table public.change_simulations
  add constraint change_simulations_latest_run_id_fkey
  foreign key (latest_run_id) references public.change_simulation_runs(id) on delete set null;

-- Indexes
create index if not exists idx_decision_workspaces_org_status
  on public.decision_workspaces (organization_id, status, due_at);
create index if not exists idx_decision_workspace_events_workspace
  on public.decision_workspace_events (organization_id, decision_workspace_id, created_at desc);
create index if not exists idx_decision_workspace_stakeholders_workspace
  on public.decision_workspace_stakeholders (organization_id, decision_workspace_id, status);
create index if not exists idx_decision_recommendations_workspace
  on public.decision_recommendations (organization_id, decision_workspace_id, created_at desc);

create index if not exists idx_portfolio_campaigns_org_status
  on public.portfolio_campaigns (organization_id, status, updated_at desc);
create index if not exists idx_portfolio_campaign_contracts_org_campaign_status
  on public.portfolio_campaign_contracts (organization_id, campaign_id, status);
create index if not exists idx_portfolio_campaign_events_campaign
  on public.portfolio_campaign_events (organization_id, campaign_id, created_at desc);

create index if not exists idx_account_workspaces_org
  on public.account_workspaces (organization_id, updated_at desc);
create index if not exists idx_counterparty_workspaces_org
  on public.counterparty_workspaces (organization_id, updated_at desc);

create index if not exists idx_external_action_links_org_status
  on public.external_action_links (organization_id, status, expires_at);
create index if not exists idx_external_action_events_link
  on public.external_action_events (organization_id, external_action_link_id, created_at desc);

create index if not exists idx_change_simulations_org
  on public.change_simulations (organization_id, updated_at desc);
create index if not exists idx_change_simulation_runs_sim
  on public.change_simulation_runs (organization_id, simulation_id, created_at desc);
create index if not exists idx_capacity_forecasts_org_generated
  on public.capacity_forecasts (organization_id, generated_at desc);
create index if not exists idx_operational_recommendations_org
  on public.operational_recommendations (organization_id, priority, generated_at desc);
create index if not exists idx_relationship_timelines_org
  on public.relationship_timelines (organization_id, updated_at desc);
create index if not exists idx_relationship_timeline_events_timeline
  on public.relationship_timeline_events (organization_id, relationship_timeline_id, event_at desc);
create index if not exists idx_decision_packet_runs_org
  on public.decision_packet_runs (organization_id, created_at desc);

-- Triggers for updated_at
drop trigger if exists update_decision_workspaces_updated_at on public.decision_workspaces;
create trigger update_decision_workspaces_updated_at
  before update on public.decision_workspaces
  for each row execute function public.update_updated_at();

drop trigger if exists update_decision_workspace_stakeholders_updated_at on public.decision_workspace_stakeholders;
create trigger update_decision_workspace_stakeholders_updated_at
  before update on public.decision_workspace_stakeholders
  for each row execute function public.update_updated_at();

drop trigger if exists update_decision_recommendations_updated_at on public.decision_recommendations;
create trigger update_decision_recommendations_updated_at
  before update on public.decision_recommendations
  for each row execute function public.update_updated_at();

drop trigger if exists update_portfolio_campaigns_updated_at on public.portfolio_campaigns;
create trigger update_portfolio_campaigns_updated_at
  before update on public.portfolio_campaigns
  for each row execute function public.update_updated_at();

drop trigger if exists update_portfolio_campaign_contracts_updated_at on public.portfolio_campaign_contracts;
create trigger update_portfolio_campaign_contracts_updated_at
  before update on public.portfolio_campaign_contracts
  for each row execute function public.update_updated_at();

drop trigger if exists update_account_workspaces_updated_at on public.account_workspaces;
create trigger update_account_workspaces_updated_at
  before update on public.account_workspaces
  for each row execute function public.update_updated_at();

drop trigger if exists update_counterparty_workspaces_updated_at on public.counterparty_workspaces;
create trigger update_counterparty_workspaces_updated_at
  before update on public.counterparty_workspaces
  for each row execute function public.update_updated_at();

drop trigger if exists update_external_action_links_updated_at on public.external_action_links;
create trigger update_external_action_links_updated_at
  before update on public.external_action_links
  for each row execute function public.update_updated_at();

drop trigger if exists update_change_simulations_updated_at on public.change_simulations;
create trigger update_change_simulations_updated_at
  before update on public.change_simulations
  for each row execute function public.update_updated_at();

drop trigger if exists update_relationship_timelines_updated_at on public.relationship_timelines;
create trigger update_relationship_timelines_updated_at
  before update on public.relationship_timelines
  for each row execute function public.update_updated_at();

drop trigger if exists update_decision_packet_templates_updated_at on public.decision_packet_templates;
create trigger update_decision_packet_templates_updated_at
  before update on public.decision_packet_templates
  for each row execute function public.update_updated_at();

-- RLS helpers: same pattern as V4
alter table public.decision_workspaces enable row level security;
alter table public.decision_workspace_events enable row level security;
alter table public.decision_workspace_stakeholders enable row level security;
alter table public.decision_recommendations enable row level security;
alter table public.portfolio_campaigns enable row level security;
alter table public.portfolio_campaign_contracts enable row level security;
alter table public.portfolio_campaign_events enable row level security;
alter table public.account_workspaces enable row level security;
alter table public.counterparty_workspaces enable row level security;
alter table public.external_action_links enable row level security;
alter table public.external_action_events enable row level security;
alter table public.change_simulations enable row level security;
alter table public.change_simulation_runs enable row level security;
alter table public.capacity_snapshots enable row level security;
alter table public.capacity_forecasts enable row level security;
alter table public.operational_recommendations enable row level security;
alter table public.relationship_timelines enable row level security;
alter table public.relationship_timeline_events enable row level security;
alter table public.decision_packet_templates enable row level security;
alter table public.decision_packet_runs enable row level security;

-- member select policies
drop policy if exists "Members can view decision workspaces in their org" on public.decision_workspaces;
create policy "Members can view decision workspaces in their org"
  on public.decision_workspaces for select using (public.is_org_member(organization_id));
drop policy if exists "Members can view decision workspace events in their org" on public.decision_workspace_events;
create policy "Members can view decision workspace events in their org"
  on public.decision_workspace_events for select using (public.is_org_member(organization_id));
drop policy if exists "Members can view decision workspace stakeholders in their org" on public.decision_workspace_stakeholders;
create policy "Members can view decision workspace stakeholders in their org"
  on public.decision_workspace_stakeholders for select using (public.is_org_member(organization_id));
drop policy if exists "Members can view decision recommendations in their org" on public.decision_recommendations;
create policy "Members can view decision recommendations in their org"
  on public.decision_recommendations for select using (public.is_org_member(organization_id));
drop policy if exists "Members can view portfolio campaigns in their org" on public.portfolio_campaigns;
create policy "Members can view portfolio campaigns in their org"
  on public.portfolio_campaigns for select using (public.is_org_member(organization_id));
drop policy if exists "Members can view portfolio campaign contracts in their org" on public.portfolio_campaign_contracts;
create policy "Members can view portfolio campaign contracts in their org"
  on public.portfolio_campaign_contracts for select using (public.is_org_member(organization_id));
drop policy if exists "Members can view portfolio campaign events in their org" on public.portfolio_campaign_events;
create policy "Members can view portfolio campaign events in their org"
  on public.portfolio_campaign_events for select using (public.is_org_member(organization_id));
drop policy if exists "Members can view account workspaces in their org" on public.account_workspaces;
create policy "Members can view account workspaces in their org"
  on public.account_workspaces for select using (public.is_org_member(organization_id));
drop policy if exists "Members can view counterparty workspaces in their org" on public.counterparty_workspaces;
create policy "Members can view counterparty workspaces in their org"
  on public.counterparty_workspaces for select using (public.is_org_member(organization_id));
drop policy if exists "Members can view external action links in their org" on public.external_action_links;
create policy "Members can view external action links in their org"
  on public.external_action_links for select using (public.is_org_member(organization_id));
drop policy if exists "Members can view external action events in their org" on public.external_action_events;
create policy "Members can view external action events in their org"
  on public.external_action_events for select using (public.is_org_member(organization_id));
drop policy if exists "Members can view change simulations in their org" on public.change_simulations;
create policy "Members can view change simulations in their org"
  on public.change_simulations for select using (public.is_org_member(organization_id));
drop policy if exists "Members can view change simulation runs in their org" on public.change_simulation_runs;
create policy "Members can view change simulation runs in their org"
  on public.change_simulation_runs for select using (public.is_org_member(organization_id));
drop policy if exists "Members can view capacity snapshots in their org" on public.capacity_snapshots;
create policy "Members can view capacity snapshots in their org"
  on public.capacity_snapshots for select using (public.is_org_member(organization_id));
drop policy if exists "Members can view capacity forecasts in their org" on public.capacity_forecasts;
create policy "Members can view capacity forecasts in their org"
  on public.capacity_forecasts for select using (public.is_org_member(organization_id));
drop policy if exists "Members can view operational recommendations in their org" on public.operational_recommendations;
create policy "Members can view operational recommendations in their org"
  on public.operational_recommendations for select using (public.is_org_member(organization_id));
drop policy if exists "Members can view relationship timelines in their org" on public.relationship_timelines;
create policy "Members can view relationship timelines in their org"
  on public.relationship_timelines for select using (public.is_org_member(organization_id));
drop policy if exists "Members can view relationship timeline events in their org" on public.relationship_timeline_events;
create policy "Members can view relationship timeline events in their org"
  on public.relationship_timeline_events for select using (public.is_org_member(organization_id));
drop policy if exists "Members can view decision packet templates in their org" on public.decision_packet_templates;
create policy "Members can view decision packet templates in their org"
  on public.decision_packet_templates for select using (public.is_org_member(organization_id));
drop policy if exists "Members can view decision packet runs in their org" on public.decision_packet_runs;
create policy "Members can view decision packet runs in their org"
  on public.decision_packet_runs for select using (public.is_org_member(organization_id));

-- manager/editor mutations policies
drop policy if exists "Editors can manage decision workspaces in their org" on public.decision_workspaces;
create policy "Editors can manage decision workspaces in their org"
  on public.decision_workspaces for all
  using (
    exists (
      select 1 from public.organization_members
      where organization_id = decision_workspaces.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager', 'legal_reviewer', 'finance_reviewer')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members
      where organization_id = decision_workspaces.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager', 'legal_reviewer', 'finance_reviewer')
    )
  );

drop policy if exists "Editors can manage campaign and intelligence entities in their org" on public.portfolio_campaigns;
create policy "Editors can manage campaign and intelligence entities in their org"
  on public.portfolio_campaigns for all
  using (
    exists (
      select 1 from public.organization_members
      where organization_id = portfolio_campaigns.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members
      where organization_id = portfolio_campaigns.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  );

drop policy if exists "Editors can manage campaign contracts in their org" on public.portfolio_campaign_contracts;
create policy "Editors can manage campaign contracts in their org"
  on public.portfolio_campaign_contracts for all
  using (
    exists (
      select 1 from public.organization_members
      where organization_id = portfolio_campaign_contracts.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members
      where organization_id = portfolio_campaign_contracts.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  );

drop policy if exists "Editors can manage campaign events in their org" on public.portfolio_campaign_events;
create policy "Editors can manage campaign events in their org"
  on public.portfolio_campaign_events for all
  using (
    exists (
      select 1 from public.organization_members
      where organization_id = portfolio_campaign_events.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members
      where organization_id = portfolio_campaign_events.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  );

drop policy if exists "Editors can manage remaining v5 entities in their org" on public.account_workspaces;
create policy "Editors can manage remaining v5 entities in their org"
  on public.account_workspaces for all
  using (
    exists (
      select 1 from public.organization_members
      where organization_id = account_workspaces.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members
      where organization_id = account_workspaces.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  );

drop policy if exists "Editors can manage counterparty workspaces in their org" on public.counterparty_workspaces;
create policy "Editors can manage counterparty workspaces in their org"
  on public.counterparty_workspaces for all
  using (
    exists (
      select 1 from public.organization_members
      where organization_id = counterparty_workspaces.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members
      where organization_id = counterparty_workspaces.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  );

drop policy if exists "Editors can manage external actions in their org" on public.external_action_links;
create policy "Editors can manage external actions in their org"
  on public.external_action_links for all
  using (
    exists (
      select 1 from public.organization_members
      where organization_id = external_action_links.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager', 'legal_reviewer', 'finance_reviewer')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members
      where organization_id = external_action_links.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager', 'legal_reviewer', 'finance_reviewer')
    )
  );

drop policy if exists "Editors can manage external action events in their org" on public.external_action_events;
create policy "Editors can manage external action events in their org"
  on public.external_action_events for all
  using (
    exists (
      select 1 from public.organization_members
      where organization_id = external_action_events.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager', 'legal_reviewer', 'finance_reviewer')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members
      where organization_id = external_action_events.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager', 'legal_reviewer', 'finance_reviewer')
    )
  );

drop policy if exists "Editors can manage simulations and intelligence in their org" on public.change_simulations;
create policy "Editors can manage simulations and intelligence in their org"
  on public.change_simulations for all
  using (
    exists (
      select 1 from public.organization_members
      where organization_id = change_simulations.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members
      where organization_id = change_simulations.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  );

drop policy if exists "Editors can manage simulation runs in their org" on public.change_simulation_runs;
create policy "Editors can manage simulation runs in their org"
  on public.change_simulation_runs for all
  using (
    exists (
      select 1 from public.organization_members
      where organization_id = change_simulation_runs.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members
      where organization_id = change_simulation_runs.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  );

drop policy if exists "Editors can manage capacity snapshots in their org" on public.capacity_snapshots;
create policy "Editors can manage capacity snapshots in their org"
  on public.capacity_snapshots for all
  using (
    exists (
      select 1 from public.organization_members
      where organization_id = capacity_snapshots.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members
      where organization_id = capacity_snapshots.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  );

drop policy if exists "Editors can manage capacity forecasts in their org" on public.capacity_forecasts;
create policy "Editors can manage capacity forecasts in their org"
  on public.capacity_forecasts for all
  using (
    exists (
      select 1 from public.organization_members
      where organization_id = capacity_forecasts.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members
      where organization_id = capacity_forecasts.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  );

drop policy if exists "Editors can manage operational recommendations in their org" on public.operational_recommendations;
create policy "Editors can manage operational recommendations in their org"
  on public.operational_recommendations for all
  using (
    exists (
      select 1 from public.organization_members
      where organization_id = operational_recommendations.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members
      where organization_id = operational_recommendations.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  );

drop policy if exists "Editors can manage relationship timelines in their org" on public.relationship_timelines;
create policy "Editors can manage relationship timelines in their org"
  on public.relationship_timelines for all
  using (
    exists (
      select 1 from public.organization_members
      where organization_id = relationship_timelines.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members
      where organization_id = relationship_timelines.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  );

drop policy if exists "Editors can manage relationship timeline events in their org" on public.relationship_timeline_events;
create policy "Editors can manage relationship timeline events in their org"
  on public.relationship_timeline_events for all
  using (
    exists (
      select 1 from public.organization_members
      where organization_id = relationship_timeline_events.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members
      where organization_id = relationship_timeline_events.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  );

drop policy if exists "Editors can manage decision packet templates in their org" on public.decision_packet_templates;
create policy "Editors can manage decision packet templates in their org"
  on public.decision_packet_templates for all
  using (
    exists (
      select 1 from public.organization_members
      where organization_id = decision_packet_templates.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members
      where organization_id = decision_packet_templates.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  );

drop policy if exists "Editors can manage decision packet runs in their org" on public.decision_packet_runs;
create policy "Editors can manage decision packet runs in their org"
  on public.decision_packet_runs for all
  using (
    exists (
      select 1 from public.organization_members
      where organization_id = decision_packet_runs.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members
      where organization_id = decision_packet_runs.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  );

