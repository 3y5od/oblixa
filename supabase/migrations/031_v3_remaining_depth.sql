-- V3 remaining depth completion:
-- - report recipient engagement tracking
-- - threaded task comments + task artifacts
-- - org behavior metrics snapshots
-- Apply after 030_v3_automation_trigger_expansion.sql

alter table public.report_run_recipients
  add column if not exists opened_at timestamptz,
  add column if not exists clicked_at timestamptz,
  add column if not exists click_count integer not null default 0,
  add column if not exists last_clicked_url text,
  add column if not exists engagement_token text;

update public.report_run_recipients
set engagement_token = coalesce(engagement_token, encode(gen_random_bytes(18), 'hex'))
where engagement_token is null;

alter table public.report_run_recipients
  alter column engagement_token set not null;

alter table public.report_run_recipients
  drop constraint if exists report_run_recipients_delivery_status_check;

alter table public.report_run_recipients
  add constraint report_run_recipients_delivery_status_check
  check (delivery_status in ('pending', 'sent', 'delivered', 'opened', 'clicked', 'failed'));

create unique index if not exists idx_report_run_recipients_engagement_token
  on public.report_run_recipients (engagement_token);

create table if not exists public.contract_task_artifacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  task_id uuid not null references public.contract_tasks(id) on delete cascade,
  label text not null,
  url text not null,
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_contract_task_artifacts_task_created
  on public.contract_task_artifacts (task_id, created_at desc);

alter table public.contract_task_comments
  add column if not exists parent_comment_id uuid references public.contract_task_comments(id) on delete cascade,
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz;

create index if not exists idx_contract_task_comments_parent
  on public.contract_task_comments (task_id, parent_comment_id, created_at asc);

create table if not exists public.org_behavior_metrics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  metrics_date date not null,
  weekly_active_operators integer not null default 0,
  weekly_active_managers integer not null default 0,
  report_opens integer not null default 0,
  report_clicks integer not null default 0,
  dashboard_revisits integer not null default 0,
  overdue_resolution_days numeric(8, 2),
  stale_record_count integer not null default 0,
  key_field_completeness numeric(5, 2),
  unresolved_gap_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique (organization_id, metrics_date)
);

create index if not exists idx_org_behavior_metrics_org_date
  on public.org_behavior_metrics (organization_id, metrics_date desc);

alter table public.contract_task_artifacts enable row level security;
alter table public.org_behavior_metrics enable row level security;

drop policy if exists "Members can view task artifacts in their org" on public.contract_task_artifacts;
create policy "Members can view task artifacts in their org"
  on public.contract_task_artifacts for select
  using (organization_id in (select organization_id from public.organization_members where user_id = auth.uid()));

drop policy if exists "Editors can manage task artifacts in their org" on public.contract_task_artifacts;
create policy "Editors can manage task artifacts in their org"
  on public.contract_task_artifacts for all
  using (
    exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = contract_task_artifacts.organization_id
        and role in ('admin', 'editor')
    )
  );

drop policy if exists "Members can view org behavior metrics in their org" on public.org_behavior_metrics;
create policy "Members can view org behavior metrics in their org"
  on public.org_behavior_metrics for select
  using (organization_id in (select organization_id from public.organization_members where user_id = auth.uid()));

drop policy if exists "Editors can insert org behavior metrics in their org" on public.org_behavior_metrics;
create policy "Editors can insert org behavior metrics in their org"
  on public.org_behavior_metrics for insert
  with check (
    exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = org_behavior_metrics.organization_id
        and role in ('admin', 'editor')
    )
  );
