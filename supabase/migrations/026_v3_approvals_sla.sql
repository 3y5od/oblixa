-- V3 approvals SLA and exception tracking:
-- - due/escalation/delegation fields
-- - policy SLA defaults
-- - approval event history
-- Apply after 025_v3_obligations_execution.sql

alter table public.approval_policies
  add column if not exists sla_hours integer not null default 72
    check (sla_hours between 1 and 720),
  add column if not exists escalation_user_id uuid references auth.users(id) on delete set null,
  add column if not exists delegation_allowed boolean not null default true,
  add column if not exists policy_category text not null default 'standard'
    check (policy_category in ('standard', 'policy_exception', 'financial', 'operational'));

alter table public.contract_approvals
  add column if not exists due_at timestamptz,
  add column if not exists escalated_at timestamptz,
  add column if not exists delegated_from_id uuid references auth.users(id) on delete set null,
  add column if not exists delegated_to_id uuid references auth.users(id) on delete set null,
  add column if not exists category text not null default 'standard'
    check (category in ('standard', 'policy_exception', 'financial', 'operational')),
  add column if not exists exception_flag boolean not null default false,
  add column if not exists exception_reason text;

create index if not exists idx_contract_approvals_due_at
  on public.contract_approvals (organization_id, status, due_at)
  where due_at is not null and status = 'pending';
create index if not exists idx_contract_approvals_escalated_at
  on public.contract_approvals (organization_id, escalated_at)
  where escalated_at is not null;

create table if not exists public.contract_approval_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  approval_id uuid not null references public.contract_approvals(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null
    check (event_type in (
      'requested',
      'status_changed',
      'delegated',
      'escalated',
      'exception_logged'
    )),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_contract_approval_events_approval_created
  on public.contract_approval_events (approval_id, created_at desc);

alter table public.contract_approval_events enable row level security;

drop policy if exists "Members can view approval events in their org" on public.contract_approval_events;
create policy "Members can view approval events in their org"
  on public.contract_approval_events for select
  using (organization_id in (select organization_id from public.organization_members where user_id = auth.uid()));

drop policy if exists "Editors can insert approval events in their org" on public.contract_approval_events;
create policy "Editors can insert approval events in their org"
  on public.contract_approval_events for insert
  with check (
    exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = contract_approval_events.organization_id
        and role in ('admin', 'editor')
    )
  );
