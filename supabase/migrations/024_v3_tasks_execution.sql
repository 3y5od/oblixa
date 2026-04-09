-- V3 tasks execution primitives:
-- - dependencies and blocker metadata
-- - recurrence and SLA fields
-- - checklist + comments
-- Apply after 023_prd_enhancements.sql

alter table public.contract_tasks
  add column if not exists parent_task_id uuid references public.contract_tasks(id) on delete set null,
  add column if not exists blocked_by_task_id uuid references public.contract_tasks(id) on delete set null,
  add column if not exists blocked_reason text,
  add column if not exists recurrence_rule text,
  add column if not exists recurrence_interval_days integer check (recurrence_interval_days is null or recurrence_interval_days between 1 and 3650),
  add column if not exists recurrence_anchor_date date,
  add column if not exists next_run_date date,
  add column if not exists sla_due_at timestamptz,
  add column if not exists escalation_at timestamptz,
  add column if not exists last_auto_transition_at timestamptz;

create index if not exists idx_contract_tasks_parent
  on public.contract_tasks (parent_task_id);
create index if not exists idx_contract_tasks_blocked_by
  on public.contract_tasks (blocked_by_task_id);
create index if not exists idx_contract_tasks_next_run
  on public.contract_tasks (organization_id, next_run_date)
  where next_run_date is not null;
create index if not exists idx_contract_tasks_sla_due
  on public.contract_tasks (organization_id, sla_due_at)
  where sla_due_at is not null;

create table if not exists public.contract_task_dependencies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  task_id uuid not null references public.contract_tasks(id) on delete cascade,
  depends_on_task_id uuid not null references public.contract_tasks(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (task_id, depends_on_task_id),
  check (task_id <> depends_on_task_id)
);

create index if not exists idx_contract_task_dependencies_org_task
  on public.contract_task_dependencies (organization_id, task_id);
create index if not exists idx_contract_task_dependencies_org_depends
  on public.contract_task_dependencies (organization_id, depends_on_task_id);

create table if not exists public.contract_task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  task_id uuid not null references public.contract_tasks(id) on delete cascade,
  label text not null,
  sort_order integer not null default 0,
  is_done boolean not null default false,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_contract_task_checklist_items_task
  on public.contract_task_checklist_items (task_id, sort_order, created_at);

create trigger update_contract_task_checklist_items_updated_at
  before update on public.contract_task_checklist_items
  for each row execute function public.update_updated_at();

create table if not exists public.contract_task_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  task_id uuid not null references public.contract_tasks(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_contract_task_comments_task_created
  on public.contract_task_comments (task_id, created_at desc);

alter table public.contract_task_dependencies enable row level security;
alter table public.contract_task_checklist_items enable row level security;
alter table public.contract_task_comments enable row level security;

drop policy if exists "Members can view task dependencies in their org" on public.contract_task_dependencies;
create policy "Members can view task dependencies in their org"
  on public.contract_task_dependencies for select
  using (organization_id in (select organization_id from public.organization_members where user_id = auth.uid()));

drop policy if exists "Editors can manage task dependencies in their org" on public.contract_task_dependencies;
create policy "Editors can manage task dependencies in their org"
  on public.contract_task_dependencies for all
  using (
    exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = contract_task_dependencies.organization_id
        and role in ('admin', 'editor')
    )
  );

drop policy if exists "Members can view task checklist in their org" on public.contract_task_checklist_items;
create policy "Members can view task checklist in their org"
  on public.contract_task_checklist_items for select
  using (organization_id in (select organization_id from public.organization_members where user_id = auth.uid()));

drop policy if exists "Editors can manage task checklist in their org" on public.contract_task_checklist_items;
create policy "Editors can manage task checklist in their org"
  on public.contract_task_checklist_items for all
  using (
    exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = contract_task_checklist_items.organization_id
        and role in ('admin', 'editor')
    )
  );

drop policy if exists "Members can view task comments in their org" on public.contract_task_comments;
create policy "Members can view task comments in their org"
  on public.contract_task_comments for select
  using (organization_id in (select organization_id from public.organization_members where user_id = auth.uid()));

drop policy if exists "Members can create task comments in their org" on public.contract_task_comments;
create policy "Members can create task comments in their org"
  on public.contract_task_comments for insert
  with check (
    exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = contract_task_comments.organization_id
    )
  );

drop policy if exists "Authors or editors can delete task comments in their org" on public.contract_task_comments;
create policy "Authors or editors can delete task comments in their org"
  on public.contract_task_comments for delete
  using (
    exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = contract_task_comments.organization_id
        and (role in ('admin', 'editor') or contract_task_comments.author_id = auth.uid())
    )
  );
