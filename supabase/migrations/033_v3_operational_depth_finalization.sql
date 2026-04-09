-- V3 operational depth finalization:
-- - renewal scenario vocabulary expansion
-- - field-change automation trigger
-- - dashboard queue pinning preferences
-- - change-event maintenance queue
-- - notification delivery logs/retries
-- - richer behavior/impact metrics
-- Apply after 032_v3_policy_and_capability_layer.sql

alter table public.contract_renewal_scenarios
  drop constraint if exists contract_renewal_scenarios_scenario_check;

alter table public.contract_renewal_scenarios
  add constraint contract_renewal_scenarios_scenario_check
  check (
    scenario in (
      'renew',
      'renegotiate',
      'terminate',
      'temporary_extension',
      'awaiting_decision',
      'replace',
      'discontinue'
    )
  );

alter table public.task_automation_rules
  drop constraint if exists task_automation_rules_trigger_type_check;

alter table public.task_automation_rules
  add constraint task_automation_rules_trigger_type_check
  check (
    trigger_type in (
      'field_missing',
      'field_changed',
      'date_window',
      'ownership_change',
      'renewal_window',
      'approval_stall',
      'risk_threshold',
      'data_quality_gap'
    )
  );

alter table public.organization_workflow_settings
  add column if not exists dashboard_pins_json jsonb not null default '{}'::jsonb;

create table if not exists public.contract_change_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  event_type text not null
    check (event_type in ('amendment', 'pricing_update', 'ownership_change', 'other')),
  summary text not null,
  impact_level text not null default 'medium'
    check (impact_level in ('low', 'medium', 'high')),
  requested_by uuid references auth.users(id) on delete set null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_contract_change_events_org_processed
  on public.contract_change_events (organization_id, processed_at, created_at desc);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  channel text not null check (channel in ('email', 'slack')),
  notification_type text not null,
  recipient text,
  subject text,
  status text not null default 'pending'
    check (status in ('pending', 'retrying', 'delivered', 'failed', 'suppressed')),
  attempt_count integer not null default 0,
  next_attempt_at timestamptz,
  delivered_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_notification_deliveries_org_status
  on public.notification_deliveries (organization_id, status, created_at desc);

create trigger update_notification_deliveries_updated_at
  before update on public.notification_deliveries
  for each row execute function public.update_updated_at();

alter table public.org_behavior_metrics
  add column if not exists active_workspaces_count integer not null default 0,
  add column if not exists contracts_onboarded_30d integer not null default 0,
  add column if not exists users_invited_30d integer not null default 0,
  add column if not exists role_coverage_count integer not null default 0,
  add column if not exists tasks_completed_7d integer not null default 0,
  add column if not exists obligations_logged_7d integer not null default 0,
  add column if not exists approvals_resolved_7d integer not null default 0,
  add column if not exists renewal_checklists_started_7d integer not null default 0,
  add column if not exists missed_dates_prevented_7d integer not null default 0,
  add column if not exists overdue_resolution_time_days numeric(8, 2);

alter table public.contract_change_events enable row level security;
alter table public.notification_deliveries enable row level security;

drop policy if exists "Members can view contract change events in their org" on public.contract_change_events;
create policy "Members can view contract change events in their org"
  on public.contract_change_events for select
  using (organization_id in (select organization_id from public.organization_members where user_id = auth.uid()));

drop policy if exists "Editors can manage contract change events in their org" on public.contract_change_events;
create policy "Editors can manage contract change events in their org"
  on public.contract_change_events for all
  using (
    exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = contract_change_events.organization_id
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  );

drop policy if exists "Members can view notification deliveries in their org" on public.notification_deliveries;
create policy "Members can view notification deliveries in their org"
  on public.notification_deliveries for select
  using (organization_id in (select organization_id from public.organization_members where user_id = auth.uid()));

drop policy if exists "System can insert notification deliveries" on public.notification_deliveries;
create policy "System can insert notification deliveries"
  on public.notification_deliveries for insert
  with check (
    exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = notification_deliveries.organization_id
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  );
