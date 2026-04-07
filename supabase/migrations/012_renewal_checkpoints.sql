-- Renewal playbook checkpoints tied to contracts.
-- Apply after 011_saved_views.sql

create table if not exists public.contract_renewal_checkpoints (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  task_key text not null,
  label text not null,
  offset_days integer not null check (offset_days >= 0),
  due_date date not null,
  status text not null check (status in ('pending', 'completed', 'skipped')) default 'pending',
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contract_id, task_key)
);

create index if not exists idx_renewal_checkpoints_org_due
  on public.contract_renewal_checkpoints (organization_id, due_date);

create index if not exists idx_renewal_checkpoints_status
  on public.contract_renewal_checkpoints (status);

create trigger update_contract_renewal_checkpoints_updated_at
  before update on public.contract_renewal_checkpoints
  for each row execute function public.update_updated_at();

alter table public.contract_renewal_checkpoints enable row level security;

create policy "Members can view renewal checkpoints in their org"
  on public.contract_renewal_checkpoints for select
  using (
    organization_id in (
      select organization_id
      from public.organization_members
      where user_id = auth.uid()
    )
  );

create policy "Editors can insert renewal checkpoints in their org"
  on public.contract_renewal_checkpoints for insert
  with check (
    exists (
      select 1
      from public.organization_members
      where user_id = auth.uid()
        and organization_id = contract_renewal_checkpoints.organization_id
        and role in ('admin', 'editor')
    )
  );

create policy "Editors can update renewal checkpoints in their org"
  on public.contract_renewal_checkpoints for update
  using (
    exists (
      select 1
      from public.organization_members
      where user_id = auth.uid()
        and organization_id = contract_renewal_checkpoints.organization_id
        and role in ('admin', 'editor')
    )
  );

create policy "Editors can delete renewal checkpoints in their org"
  on public.contract_renewal_checkpoints for delete
  using (
    exists (
      select 1
      from public.organization_members
      where user_id = auth.uid()
        and organization_id = contract_renewal_checkpoints.organization_id
        and role in ('admin', 'editor')
    )
  );
