-- V3 reporting and data quality:
-- - report run history and recipients
-- - contract data quality snapshots
-- Apply after 028_v3_intake_pipeline.sql

alter table public.report_subscriptions
  add column if not exists report_mode text not null default 'saved_view'
    check (report_mode in ('saved_view', 'exceptions', 'management')),
  add column if not exists last_error text;

create table if not exists public.report_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subscription_id uuid references public.report_subscriptions(id) on delete set null,
  report_mode text not null
    check (report_mode in ('saved_view', 'exceptions', 'management')),
  status text not null
    check (status in ('queued', 'running', 'succeeded', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  triggered_by uuid references auth.users(id) on delete set null,
  metrics_json jsonb not null default '{}'::jsonb,
  error_summary text,
  created_at timestamptz not null default now()
);

create index if not exists idx_report_runs_org_started
  on public.report_runs (organization_id, started_at desc);
create index if not exists idx_report_runs_subscription
  on public.report_runs (subscription_id, started_at desc);

create table if not exists public.report_run_recipients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  report_run_id uuid not null references public.report_runs(id) on delete cascade,
  recipient_email text not null,
  delivery_status text not null default 'pending'
    check (delivery_status in ('pending', 'sent', 'failed')),
  delivery_error text,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  unique (report_run_id, recipient_email)
);

create index if not exists idx_report_run_recipients_org_status
  on public.report_run_recipients (organization_id, delivery_status, created_at desc);

create table if not exists public.contract_data_quality_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  completeness_score numeric(5, 2) not null
    check (completeness_score >= 0 and completeness_score <= 100),
  stale_fields_count integer not null default 0,
  missing_critical_count integer not null default 0,
  approved_field_count integer not null default 0,
  total_field_count integer not null default 0,
  generated_at timestamptz not null default now(),
  unique (contract_id, generated_at)
);

create index if not exists idx_contract_data_quality_org_generated
  on public.contract_data_quality_snapshots (organization_id, generated_at desc);
create index if not exists idx_contract_data_quality_contract_generated
  on public.contract_data_quality_snapshots (contract_id, generated_at desc);

alter table public.report_runs enable row level security;
alter table public.report_run_recipients enable row level security;
alter table public.contract_data_quality_snapshots enable row level security;

drop policy if exists "Members can view report runs in their org" on public.report_runs;
create policy "Members can view report runs in their org"
  on public.report_runs for select
  using (organization_id in (select organization_id from public.organization_members where user_id = auth.uid()));

drop policy if exists "Editors can insert report runs in their org" on public.report_runs;
create policy "Editors can insert report runs in their org"
  on public.report_runs for insert
  with check (
    exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = report_runs.organization_id
        and role in ('admin', 'editor')
    )
  );

drop policy if exists "Editors can update report runs in their org" on public.report_runs;
create policy "Editors can update report runs in their org"
  on public.report_runs for update
  using (
    exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = report_runs.organization_id
        and role in ('admin', 'editor')
    )
  );

drop policy if exists "Members can view report run recipients in their org" on public.report_run_recipients;
create policy "Members can view report run recipients in their org"
  on public.report_run_recipients for select
  using (organization_id in (select organization_id from public.organization_members where user_id = auth.uid()));

drop policy if exists "Editors can manage report run recipients in their org" on public.report_run_recipients;
create policy "Editors can manage report run recipients in their org"
  on public.report_run_recipients for all
  using (
    exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = report_run_recipients.organization_id
        and role in ('admin', 'editor')
    )
  );

drop policy if exists "Members can view quality snapshots in their org" on public.contract_data_quality_snapshots;
create policy "Members can view quality snapshots in their org"
  on public.contract_data_quality_snapshots for select
  using (organization_id in (select organization_id from public.organization_members where user_id = auth.uid()));

drop policy if exists "Editors can insert quality snapshots in their org" on public.contract_data_quality_snapshots;
create policy "Editors can insert quality snapshots in their org"
  on public.contract_data_quality_snapshots for insert
  with check (
    exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = contract_data_quality_snapshots.organization_id
        and role in ('admin', 'editor')
    )
  );
