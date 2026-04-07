-- Contract obligations: non-date commitments linked to contracts.
-- Apply after 009_contract_notes.sql

create table if not exists public.contract_obligations (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  owner_id uuid references auth.users(id) on delete set null,
  title text not null,
  details text,
  obligation_type text not null default 'general',
  cadence text,
  due_date date,
  status text not null check (status in ('open', 'in_progress', 'done', 'waived')) default 'open',
  evidence_notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_contract_obligations_org_status
  on public.contract_obligations (organization_id, status);

create index if not exists idx_contract_obligations_owner_status
  on public.contract_obligations (owner_id, status);

create index if not exists idx_contract_obligations_due_date
  on public.contract_obligations (due_date);

create trigger update_contract_obligations_updated_at
  before update on public.contract_obligations
  for each row execute function public.update_updated_at();

alter table public.contract_obligations enable row level security;

create policy "Members can view obligations in their org"
  on public.contract_obligations for select
  using (
    organization_id in (
      select organization_id
      from public.organization_members
      where user_id = auth.uid()
    )
  );

create policy "Editors can insert obligations in their org"
  on public.contract_obligations for insert
  with check (
    exists (
      select 1
      from public.organization_members
      where user_id = auth.uid()
        and organization_id = contract_obligations.organization_id
        and role in ('admin', 'editor')
    )
  );

create policy "Editors can update obligations in their org"
  on public.contract_obligations for update
  using (
    exists (
      select 1
      from public.organization_members
      where user_id = auth.uid()
        and organization_id = contract_obligations.organization_id
        and role in ('admin', 'editor')
    )
  );

create policy "Editors can delete obligations in their org"
  on public.contract_obligations for delete
  using (
    exists (
      select 1
      from public.organization_members
      where user_id = auth.uid()
        and organization_id = contract_obligations.organization_id
        and role in ('admin', 'editor')
    )
  );
