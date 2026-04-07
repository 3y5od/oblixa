-- V2 depth completion: automation, handoff checklists, configurable playbooks, task history.
-- Apply after 014_v2_workflow_expansion.sql

create table if not exists public.contract_task_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  task_id uuid not null references public.contract_tasks(id) on delete cascade,
  event_type text not null check (event_type in ('created', 'status_changed', 'reassigned', 'deleted', 'clarification_requested')),
  actor_id uuid references auth.users(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_contract_task_events_task_created
  on public.contract_task_events (task_id, created_at desc);
create index if not exists idx_contract_task_events_org_created
  on public.contract_task_events (organization_id, created_at desc);

create table if not exists public.contract_handoff_checklists (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  from_owner_id uuid references auth.users(id) on delete set null,
  to_owner_id uuid references auth.users(id) on delete set null,
  checklist_note text,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_contract_handoff_checklists_contract
  on public.contract_handoff_checklists (contract_id, created_at desc);

create trigger update_contract_handoff_checklists_updated_at
  before update on public.contract_handoff_checklists
  for each row execute function public.update_updated_at();

create table if not exists public.renewal_playbook_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_type text,
  task_key text not null,
  label text not null,
  offset_days integer not null check (offset_days >= 0),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, contract_type, task_key)
);

create index if not exists idx_renewal_playbook_templates_org_type
  on public.renewal_playbook_templates (organization_id, contract_type, active);

create trigger update_renewal_playbook_templates_updated_at
  before update on public.renewal_playbook_templates
  for each row execute function public.update_updated_at();

alter table public.contract_handoff_checklists enable row level security;
alter table public.contract_task_events enable row level security;
alter table public.renewal_playbook_templates enable row level security;

create policy "Members can view handoff checklists in their org"
  on public.contract_handoff_checklists for select
  using (
    organization_id in (select organization_id from public.organization_members where user_id = auth.uid())
  );
create policy "Editors can manage handoff checklists in their org"
  on public.contract_handoff_checklists for all
  using (
    exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = contract_handoff_checklists.organization_id
        and role in ('admin', 'editor')
    )
  );

create policy "Members can view task events in their org"
  on public.contract_task_events for select
  using (
    organization_id in (select organization_id from public.organization_members where user_id = auth.uid())
  );
create policy "Editors can insert task events in their org"
  on public.contract_task_events for insert
  with check (
    exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = contract_task_events.organization_id
        and role in ('admin', 'editor')
    )
  );

create policy "Members can view playbook templates in their org"
  on public.renewal_playbook_templates for select
  using (
    organization_id in (select organization_id from public.organization_members where user_id = auth.uid())
  );
create policy "Editors can manage playbook templates in their org"
  on public.renewal_playbook_templates for all
  using (
    exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = renewal_playbook_templates.organization_id
        and role in ('admin', 'editor')
    )
  );

-- Seed default templates for each org to preserve existing behavior while enabling customization.
insert into public.renewal_playbook_templates (
  organization_id,
  contract_type,
  task_key,
  label,
  offset_days,
  active
)
select
  o.id,
  null,
  t.task_key,
  t.label,
  t.offset_days,
  true
from public.organizations o
cross join (
  values
    ('r120_scope', 'Scope renewal strategy and owner', 120),
    ('r090_terms', 'Review commercial terms and obligations', 90),
    ('r060_internal', 'Collect internal decision input', 60),
    ('r030_execute', 'Draft renewal / notice execution plan', 30),
    ('r014_approve', 'Finalize approval and stakeholder signoff', 14),
    ('r007_finalize', 'Confirm execution readiness', 7),
    ('r001_send', 'Send renewal/notice action and log outcome', 1)
) as t(task_key, label, offset_days)
on conflict (organization_id, contract_type, task_key) do nothing;
