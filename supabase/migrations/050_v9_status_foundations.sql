-- V9 status foundations: import recovery metadata and export job history.

alter table public.contract_import_jobs
  add column if not exists failure_reason text,
  add column if not exists retry_of_job_id uuid references public.contract_import_jobs(id) on delete set null,
  add column if not exists superseded_by_job_id uuid references public.contract_import_jobs(id) on delete set null,
  add column if not exists completed_at timestamptz;

alter table public.contract_import_job_rows
  add column if not exists raw_payload jsonb not null default '{}'::jsonb;

create index if not exists idx_contract_import_jobs_retry_of
  on public.contract_import_jobs (retry_of_job_id, created_at desc);

create table if not exists public.contract_export_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  scope text not null default 'workspace' check (scope in ('workspace', 'selected')),
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed', 'partial')),
  export_format text not null default 'csv' check (export_format in ('csv')),
  selected_contract_count integer not null default 0,
  exported_rows integer not null default 0,
  truncated boolean not null default false,
  error_message text,
  filter_json jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_contract_export_jobs_org_created
  on public.contract_export_jobs (organization_id, created_at desc);

create index if not exists idx_contract_export_jobs_org_status_created
  on public.contract_export_jobs (organization_id, status, created_at desc);

drop trigger if exists update_contract_export_jobs_updated_at on public.contract_export_jobs;
create trigger update_contract_export_jobs_updated_at
  before update on public.contract_export_jobs
  for each row execute function public.update_updated_at();

alter table public.contract_export_jobs enable row level security;

drop policy if exists "Members can view export jobs in org" on public.contract_export_jobs;
create policy "Members can view export jobs in org"
  on public.contract_export_jobs for select
  using (
    organization_id in (
      select organization_id
      from public.organization_members
      where user_id = auth.uid()
    )
  );

drop policy if exists "Editors can manage export jobs in org" on public.contract_export_jobs;
create policy "Editors can manage export jobs in org"
  on public.contract_export_jobs for all
  using (
    exists (
      select 1
      from public.organization_members
      where user_id = auth.uid()
        and organization_id = contract_export_jobs.organization_id
        and role in ('admin', 'editor')
    )
  );
