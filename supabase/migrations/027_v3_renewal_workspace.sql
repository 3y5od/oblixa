-- V3 renewal workspace:
-- - decision planning metadata
-- - workspace status and context
-- - scenario-linked checkpoints and workspace notes
-- Apply after 026_v3_approvals_sla.sql

alter table public.contract_renewal_scenarios
  add column if not exists workspace_status text not null default 'not_started'
    check (workspace_status in ('not_started', 'in_progress', 'blocked', 'decision_pending', 'closed')),
  add column if not exists owner_id uuid references auth.users(id) on delete set null,
  add column if not exists target_decision_date date,
  add column if not exists decision_date date,
  add column if not exists escalation_date date,
  add column if not exists commercial_context text,
  add column if not exists scenario_confidence integer
    check (scenario_confidence is null or scenario_confidence between 1 and 100),
  add column if not exists last_reviewed_at timestamptz;

create index if not exists idx_contract_renewal_scenarios_workspace
  on public.contract_renewal_scenarios (organization_id, workspace_status, target_decision_date);

alter table public.contract_renewal_checkpoints
  add column if not exists scenario_id uuid references public.contract_renewal_scenarios(id) on delete set null,
  add column if not exists required boolean not null default true,
  add column if not exists completed_by uuid references auth.users(id) on delete set null;

create index if not exists idx_contract_renewal_checkpoints_scenario
  on public.contract_renewal_checkpoints (scenario_id, due_date);

create table if not exists public.contract_renewal_workspace_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  scenario_id uuid references public.contract_renewal_scenarios(id) on delete set null,
  author_id uuid references auth.users(id) on delete set null,
  body text not null,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger update_contract_renewal_workspace_notes_updated_at
  before update on public.contract_renewal_workspace_notes
  for each row execute function public.update_updated_at();

create index if not exists idx_contract_renewal_workspace_notes_contract
  on public.contract_renewal_workspace_notes (contract_id, created_at desc);

alter table public.contract_renewal_workspace_notes enable row level security;

drop policy if exists "Members can view renewal workspace notes in their org" on public.contract_renewal_workspace_notes;
create policy "Members can view renewal workspace notes in their org"
  on public.contract_renewal_workspace_notes for select
  using (organization_id in (select organization_id from public.organization_members where user_id = auth.uid()));

drop policy if exists "Members can create renewal workspace notes in their org" on public.contract_renewal_workspace_notes;
create policy "Members can create renewal workspace notes in their org"
  on public.contract_renewal_workspace_notes for insert
  with check (
    exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = contract_renewal_workspace_notes.organization_id
    )
  );

drop policy if exists "Authors or editors can update renewal workspace notes in their org" on public.contract_renewal_workspace_notes;
create policy "Authors or editors can update renewal workspace notes in their org"
  on public.contract_renewal_workspace_notes for update
  using (
    exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = contract_renewal_workspace_notes.organization_id
        and (role in ('admin', 'editor') or contract_renewal_workspace_notes.author_id = auth.uid())
    )
  );
