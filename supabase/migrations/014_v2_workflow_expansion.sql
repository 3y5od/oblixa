-- V2 workflow expansion: operational lifecycle, collaboration, approvals, integrations.
-- Apply after 013_report_subscriptions.sql

alter table public.contracts
  add column if not exists intake_status text not null default 'awaiting_review'
    check (intake_status in ('awaiting_review', 'in_clarification', 'active', 'at_risk', 'renewal_prep', 'notice_decision', 'archived')),
  add column if not exists health_status text not null default 'unknown'
    check (health_status in ('healthy', 'watch', 'at_risk', 'unknown')),
  add column if not exists required_next_step text,
  add column if not exists received_at timestamptz not null default now(),
  add column if not exists reviewed_at timestamptz,
  add column if not exists operationally_active_at timestamptz,
  add column if not exists source_system text,
  add column if not exists external_reference_id text,
  add column if not exists secondary_owner_id uuid references auth.users(id) on delete set null;

alter table public.report_subscriptions
  add column if not exists recipient_emails text[] not null default '{}';

alter table public.contract_files
  add column if not exists superseded_by_id uuid references public.contract_files(id) on delete set null,
  add column if not exists superseded_at timestamptz,
  add column if not exists supersede_reason text;

create index if not exists idx_contracts_intake_status
  on public.contracts (organization_id, intake_status);
create index if not exists idx_contracts_health_status
  on public.contracts (organization_id, health_status);
create index if not exists idx_contracts_external_ref
  on public.contracts (organization_id, external_reference_id);

create table if not exists public.contract_intake_history (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_contract_intake_history_org_created
  on public.contract_intake_history (organization_id, created_at desc);

alter table public.contract_tasks
  add column if not exists created_via text not null default 'manual'
    check (created_via in ('manual', 'rule', 'clarification', 'integration')),
  add column if not exists linked_field_id uuid references public.extracted_fields(id) on delete set null,
  add column if not exists linked_reminder_id uuid references public.reminders(id) on delete set null,
  add column if not exists linked_obligation_id uuid references public.contract_obligations(id) on delete set null,
  add column if not exists linked_checkpoint_id uuid references public.contract_renewal_checkpoints(id) on delete set null,
  add column if not exists team_key text;

create index if not exists idx_contract_tasks_team_key
  on public.contract_tasks (organization_id, team_key, status);

create table if not exists public.task_automation_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  trigger_type text not null check (trigger_type in ('field_missing', 'date_window', 'ownership_change', 'renewal_window')),
  config_json jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_task_automation_rules_org_active
  on public.task_automation_rules (organization_id, active);

create trigger update_task_automation_rules_updated_at
  before update on public.task_automation_rules
  for each row execute function public.update_updated_at();

create table if not exists public.contract_renewal_scenarios (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  scenario text not null check (scenario in ('renew', 'renegotiate', 'terminate', 'temporary_extension', 'awaiting_decision')),
  decision_notes text,
  blocker text,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contract_id)
);

create index if not exists idx_contract_renewal_scenarios_org
  on public.contract_renewal_scenarios (organization_id, scenario);

create trigger update_contract_renewal_scenarios_updated_at
  before update on public.contract_renewal_scenarios
  for each row execute function public.update_updated_at();

create table if not exists public.contract_approvals (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  approval_type text not null check (approval_type in ('renewal_decision', 'notice_action', 'commercial_exception', 'ownership_handoff')),
  status text not null check (status in ('pending', 'approved', 'rejected')) default 'pending',
  requested_by uuid references auth.users(id) on delete set null,
  approver_id uuid references auth.users(id) on delete set null,
  notes text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_contract_approvals_org_status
  on public.contract_approvals (organization_id, status);
create index if not exists idx_contract_approvals_contract
  on public.contract_approvals (contract_id, created_at desc);

create trigger update_contract_approvals_updated_at
  before update on public.contract_approvals
  for each row execute function public.update_updated_at();

create table if not exists public.obligation_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_type text not null,
  title text not null,
  details text,
  obligation_type text not null default 'general',
  cadence text,
  due_offset_days integer,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_obligation_templates_org_type
  on public.obligation_templates (organization_id, contract_type, active);

create trigger update_obligation_templates_updated_at
  before update on public.obligation_templates
  for each row execute function public.update_updated_at();

create table if not exists public.contract_field_comments (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  field_id uuid references public.extracted_fields(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  comment text not null,
  mentions text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_contract_field_comments_contract
  on public.contract_field_comments (contract_id, created_at desc);
create index if not exists idx_contract_field_comments_org
  on public.contract_field_comments (organization_id, created_at desc);

create table if not exists public.internal_notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null check (notification_type in ('mention', 'task_assigned', 'approval_requested')),
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_internal_notifications_user_unread
  on public.internal_notifications (user_id, read_at, created_at desc);

create table if not exists public.webhook_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  url text not null,
  secret text not null,
  events text[] not null default '{"contract.updated","reminder.due"}',
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_webhook_subscriptions_org_active
  on public.webhook_subscriptions (organization_id, active);

create trigger update_webhook_subscriptions_updated_at
  before update on public.webhook_subscriptions
  for each row execute function public.update_updated_at();

create table if not exists public.outbound_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  delivered boolean not null default false,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_outbound_events_org_delivered
  on public.outbound_events (organization_id, delivered, created_at);

alter table public.contract_intake_history enable row level security;
alter table public.task_automation_rules enable row level security;
alter table public.contract_renewal_scenarios enable row level security;
alter table public.contract_approvals enable row level security;
alter table public.obligation_templates enable row level security;
alter table public.contract_field_comments enable row level security;
alter table public.internal_notifications enable row level security;
alter table public.webhook_subscriptions enable row level security;
alter table public.outbound_events enable row level security;

create policy "Members can view intake history in their org"
  on public.contract_intake_history for select
  using (organization_id in (select organization_id from public.organization_members where user_id = auth.uid()));
create policy "Editors can insert intake history in their org"
  on public.contract_intake_history for insert
  with check (exists (
    select 1 from public.organization_members
    where user_id = auth.uid()
      and organization_id = contract_intake_history.organization_id
      and role in ('admin', 'editor')
  ));

create policy "Members can view automation rules in their org"
  on public.task_automation_rules for select
  using (organization_id in (select organization_id from public.organization_members where user_id = auth.uid()));
create policy "Admins can manage automation rules in their org"
  on public.task_automation_rules for all
  using (exists (
    select 1 from public.organization_members
    where user_id = auth.uid()
      and organization_id = task_automation_rules.organization_id
      and role = 'admin'
  ));

create policy "Members can view renewal scenarios in their org"
  on public.contract_renewal_scenarios for select
  using (organization_id in (select organization_id from public.organization_members where user_id = auth.uid()));
create policy "Editors can manage renewal scenarios in their org"
  on public.contract_renewal_scenarios for all
  using (exists (
    select 1 from public.organization_members
    where user_id = auth.uid()
      and organization_id = contract_renewal_scenarios.organization_id
      and role in ('admin', 'editor')
  ));

create policy "Members can view approvals in their org"
  on public.contract_approvals for select
  using (organization_id in (select organization_id from public.organization_members where user_id = auth.uid()));
create policy "Editors can manage approvals in their org"
  on public.contract_approvals for all
  using (exists (
    select 1 from public.organization_members
    where user_id = auth.uid()
      and organization_id = contract_approvals.organization_id
      and role in ('admin', 'editor')
  ));

create policy "Members can view obligation templates in their org"
  on public.obligation_templates for select
  using (organization_id in (select organization_id from public.organization_members where user_id = auth.uid()));
create policy "Editors can manage obligation templates in their org"
  on public.obligation_templates for all
  using (exists (
    select 1 from public.organization_members
    where user_id = auth.uid()
      and organization_id = obligation_templates.organization_id
      and role in ('admin', 'editor')
  ));

create policy "Members can view field comments in their org"
  on public.contract_field_comments for select
  using (organization_id in (select organization_id from public.organization_members where user_id = auth.uid()));
create policy "Members can create field comments in their org"
  on public.contract_field_comments for insert
  with check (exists (
    select 1 from public.organization_members
    where user_id = auth.uid()
      and organization_id = contract_field_comments.organization_id
  ));
create policy "Authors or editors can delete field comments in their org"
  on public.contract_field_comments for delete
  using (exists (
    select 1 from public.organization_members
    where user_id = auth.uid()
      and organization_id = contract_field_comments.organization_id
      and (role in ('admin', 'editor') or contract_field_comments.author_id = auth.uid())
  ));

create policy "Users can view own notifications"
  on public.internal_notifications for select
  using (user_id = auth.uid());
create policy "Users can mark own notifications"
  on public.internal_notifications for update
  using (user_id = auth.uid());
create policy "System can insert org notifications"
  on public.internal_notifications for insert
  with check (organization_id in (select organization_id from public.organization_members where user_id = auth.uid()));

create policy "Members can view webhook subscriptions in their org"
  on public.webhook_subscriptions for select
  using (organization_id in (select organization_id from public.organization_members where user_id = auth.uid()));
create policy "Admins can manage webhook subscriptions in their org"
  on public.webhook_subscriptions for all
  using (exists (
    select 1 from public.organization_members
    where user_id = auth.uid()
      and organization_id = webhook_subscriptions.organization_id
      and role = 'admin'
  ));

create policy "Members can view outbound events in their org"
  on public.outbound_events for select
  using (organization_id in (select organization_id from public.organization_members where user_id = auth.uid()));
create policy "Editors can insert outbound events in their org"
  on public.outbound_events for insert
  with check (exists (
    select 1 from public.organization_members
    where user_id = auth.uid()
      and organization_id = outbound_events.organization_id
      and role in ('admin', 'editor')
  ));
