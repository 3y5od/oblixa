-- Report subscriptions: scheduled summary digests for saved views.
-- Apply after 012_renewal_checkpoints.sql

create table if not exists public.report_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  saved_view_id uuid not null references public.saved_views(id) on delete cascade,
  frequency text not null check (frequency in ('weekly')),
  active boolean not null default true,
  next_run_at timestamptz not null default now(),
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, saved_view_id, frequency)
);

create index if not exists idx_report_subscriptions_next_run
  on public.report_subscriptions (active, next_run_at);

create trigger update_report_subscriptions_updated_at
  before update on public.report_subscriptions
  for each row execute function public.update_updated_at();

alter table public.report_subscriptions enable row level security;

create policy "Users can view own report subscriptions"
  on public.report_subscriptions for select
  using (user_id = auth.uid());

create policy "Users can create own report subscriptions"
  on public.report_subscriptions for insert
  with check (user_id = auth.uid());

create policy "Users can update own report subscriptions"
  on public.report_subscriptions for update
  using (user_id = auth.uid());

create policy "Users can delete own report subscriptions"
  on public.report_subscriptions for delete
  using (user_id = auth.uid());
