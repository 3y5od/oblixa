-- V2 remaining depth: region filters, monthly summaries, import tracking, calendar feed tokens.
-- Apply after 015_v2_depth_completion.sql

alter table public.contracts
  add column if not exists region text;

create index if not exists idx_contracts_org_region
  on public.contracts (organization_id, region);

-- Extend report frequency to support monthly summary cadence.
alter table public.report_subscriptions
  drop constraint if exists report_subscriptions_frequency_check;
alter table public.report_subscriptions
  add constraint report_subscriptions_frequency_check
  check (frequency in ('weekly', 'monthly'));

create table if not exists public.contract_import_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  source text not null default 'csv',
  status text not null default 'completed' check (status in ('processing', 'completed', 'failed')),
  total_rows integer not null default 0,
  valid_rows integer not null default 0,
  inserted_rows integer not null default 0,
  error_rows integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contract_import_job_rows (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.contract_import_jobs(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  row_index integer not null,
  title text,
  owner_email text,
  status text not null check (status in ('valid', 'inserted', 'error')),
  error_message text,
  contract_id uuid references public.contracts(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_contract_import_jobs_org_created
  on public.contract_import_jobs (organization_id, created_at desc);
create index if not exists idx_contract_import_job_rows_job
  on public.contract_import_job_rows (job_id, row_index);

create trigger update_contract_import_jobs_updated_at
  before update on public.contract_import_jobs
  for each row execute function public.update_updated_at();

create table if not exists public.calendar_feeds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  last_accessed_at timestamptz
);

create index if not exists idx_calendar_feeds_token_active
  on public.calendar_feeds (token, active);

alter table public.contract_import_jobs enable row level security;
alter table public.contract_import_job_rows enable row level security;
alter table public.calendar_feeds enable row level security;

create policy "Members can view import jobs in org"
  on public.contract_import_jobs for select
  using (
    organization_id in (
      select organization_id
      from public.organization_members
      where user_id = auth.uid()
    )
  );
create policy "Editors can manage import jobs in org"
  on public.contract_import_jobs for all
  using (
    exists (
      select 1
      from public.organization_members
      where user_id = auth.uid()
        and organization_id = contract_import_jobs.organization_id
        and role in ('admin', 'editor')
    )
  );

create policy "Members can view import job rows in org"
  on public.contract_import_job_rows for select
  using (
    organization_id in (
      select organization_id
      from public.organization_members
      where user_id = auth.uid()
    )
  );
create policy "Editors can manage import job rows in org"
  on public.contract_import_job_rows for all
  using (
    exists (
      select 1
      from public.organization_members
      where user_id = auth.uid()
        and organization_id = contract_import_job_rows.organization_id
        and role in ('admin', 'editor')
    )
  );

create policy "Users can manage own calendar feeds"
  on public.calendar_feeds for all
  using (user_id = auth.uid());
