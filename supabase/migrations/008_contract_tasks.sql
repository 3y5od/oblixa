-- Contract tasks: actionable workflow items linked to contracts.
-- Apply after 007_performance_indexes.sql

create table if not exists public.contract_tasks (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  assignee_id uuid references auth.users(id) on delete set null,
  title text not null,
  details text,
  status text not null check (status in ('open', 'in_progress', 'blocked', 'done')) default 'open',
  priority text not null check (priority in ('low', 'medium', 'high')) default 'medium',
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_contract_tasks_org_status
  on public.contract_tasks (organization_id, status);

create index if not exists idx_contract_tasks_assignee_status
  on public.contract_tasks (assignee_id, status);

create index if not exists idx_contract_tasks_due_date
  on public.contract_tasks (due_date);

create trigger update_contract_tasks_updated_at
  before update on public.contract_tasks
  for each row execute function public.update_updated_at();

alter table public.contract_tasks enable row level security;

create policy "Members can view contract tasks in their org"
  on public.contract_tasks for select
  using (
    organization_id in (
      select organization_id
      from public.organization_members
      where user_id = auth.uid()
    )
  );

create policy "Editors can insert contract tasks in their org"
  on public.contract_tasks for insert
  with check (
    exists (
      select 1
      from public.organization_members
      where user_id = auth.uid()
        and organization_id = contract_tasks.organization_id
        and role in ('admin', 'editor')
    )
  );

create policy "Editors can update contract tasks in their org"
  on public.contract_tasks for update
  using (
    exists (
      select 1
      from public.organization_members
      where user_id = auth.uid()
        and organization_id = contract_tasks.organization_id
        and role in ('admin', 'editor')
    )
  );

create policy "Editors can delete contract tasks in their org"
  on public.contract_tasks for delete
  using (
    exists (
      select 1
      from public.organization_members
      where user_id = auth.uid()
        and organization_id = contract_tasks.organization_id
        and role in ('admin', 'editor')
    )
  );
