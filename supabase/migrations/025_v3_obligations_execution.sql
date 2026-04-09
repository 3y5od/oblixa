-- V3 obligations execution primitives:
-- - normalized recurrence and next due metadata
-- - escalation tracking and evidence linkage
-- Apply after 024_v3_tasks_execution.sql

alter table public.contract_obligations
  add column if not exists recurrence_type text not null default 'none'
    check (recurrence_type in ('none', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom_days')),
  add column if not exists recurrence_interval_days integer check (recurrence_interval_days is null or recurrence_interval_days between 1 and 3650),
  add column if not exists next_due_date date,
  add column if not exists escalation_due_at timestamptz,
  add column if not exists escalation_status text not null default 'none'
    check (escalation_status in ('none', 'pending', 'sent', 'acked')),
  add column if not exists evidence_file_path text,
  add column if not exists evidence_url text;

create index if not exists idx_contract_obligations_next_due
  on public.contract_obligations (organization_id, next_due_date)
  where next_due_date is not null;
create index if not exists idx_contract_obligations_escalation_due
  on public.contract_obligations (organization_id, escalation_due_at)
  where escalation_due_at is not null;

create table if not exists public.contract_obligation_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  obligation_id uuid not null references public.contract_obligations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null
    check (event_type in (
      'created',
      'updated',
      'status_changed',
      'evidence_added',
      'escalated',
      'recurrence_generated'
    )),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_contract_obligation_events_obligation_created
  on public.contract_obligation_events (obligation_id, created_at desc);

alter table public.contract_obligation_events enable row level security;

drop policy if exists "Members can view obligation events in their org" on public.contract_obligation_events;
create policy "Members can view obligation events in their org"
  on public.contract_obligation_events for select
  using (organization_id in (select organization_id from public.organization_members where user_id = auth.uid()));

drop policy if exists "Editors can insert obligation events in their org" on public.contract_obligation_events;
create policy "Editors can insert obligation events in their org"
  on public.contract_obligation_events for insert
  with check (
    exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = contract_obligation_events.organization_id
        and role in ('admin', 'editor')
    )
  );
