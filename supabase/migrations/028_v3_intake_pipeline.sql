-- V3 intake pipeline:
-- - intake request entity and triage ownership
-- - contract-level intake completeness metadata
-- Apply after 027_v3_renewal_workspace.sql

alter table public.contracts
  add column if not exists intake_owner_id uuid references auth.users(id) on delete set null,
  add column if not exists intake_source text,
  add column if not exists intake_completeness_score numeric(5, 2)
    check (intake_completeness_score is null or (intake_completeness_score >= 0 and intake_completeness_score <= 100)),
  add column if not exists intake_last_scored_at timestamptz;

create index if not exists idx_contracts_intake_owner_status
  on public.contracts (organization_id, intake_owner_id, intake_status);

create table if not exists public.contract_intake_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid references public.contracts(id) on delete set null,
  submitted_by uuid references auth.users(id) on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,
  source text not null default 'manual',
  source_label text,
  status text not null default 'new'
    check (status in ('new', 'triage', 'review', 'ready', 'rejected')),
  payload_json jsonb not null default '{}'::jsonb,
  completeness_score numeric(5, 2)
    check (completeness_score is null or (completeness_score >= 0 and completeness_score <= 100)),
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger update_contract_intake_requests_updated_at
  before update on public.contract_intake_requests
  for each row execute function public.update_updated_at();

create index if not exists idx_contract_intake_requests_org_status
  on public.contract_intake_requests (organization_id, status, created_at desc);
create index if not exists idx_contract_intake_requests_org_assigned
  on public.contract_intake_requests (organization_id, assigned_to, status);

alter table public.contract_intake_requests enable row level security;

drop policy if exists "Members can view intake requests in their org" on public.contract_intake_requests;
create policy "Members can view intake requests in their org"
  on public.contract_intake_requests for select
  using (organization_id in (select organization_id from public.organization_members where user_id = auth.uid()));

drop policy if exists "Editors can insert intake requests in their org" on public.contract_intake_requests;
create policy "Editors can insert intake requests in their org"
  on public.contract_intake_requests for insert
  with check (
    exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = contract_intake_requests.organization_id
        and role in ('admin', 'editor')
    )
  );

drop policy if exists "Editors can update intake requests in their org" on public.contract_intake_requests;
create policy "Editors can update intake requests in their org"
  on public.contract_intake_requests for update
  using (
    exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = contract_intake_requests.organization_id
        and role in ('admin', 'editor')
    )
  );
