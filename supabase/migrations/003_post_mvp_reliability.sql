-- Post-MVP: subscription entitlement fields + extraction job tracking
-- Apply after 001_initial_schema, 002_add_stripe_columns, 002_prd_enhancements

alter table public.organizations
  add column if not exists stripe_subscription_status text,
  add column if not exists stripe_subscription_current_period_end timestamptz;

-- Backfill legacy orgs that have a subscription id but no status yet
update public.organizations
set stripe_subscription_status = 'active'
where stripe_subscription_id is not null
  and stripe_subscription_status is null;

create table public.contract_extraction_jobs (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  status text not null check (status in ('pending', 'processing', 'succeeded', 'failed')),
  attempt_count integer not null default 0,
  last_error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contract_id)
);

create index idx_extraction_jobs_org on public.contract_extraction_jobs(organization_id);
create index idx_extraction_jobs_status on public.contract_extraction_jobs(status);

create trigger update_contract_extraction_jobs_updated_at
  before update on public.contract_extraction_jobs
  for each row execute function public.update_updated_at();

alter table public.contract_extraction_jobs enable row level security;

create policy "Users can view extraction jobs in their org"
  on public.contract_extraction_jobs for select
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid()
    )
  );

create policy "Users can manage extraction jobs in their org"
  on public.contract_extraction_jobs for all
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid()
    )
  );
