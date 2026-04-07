-- Saved views: persistent filter presets for recurring operational reviews.
-- Apply after 010_contract_obligations.sql

create table if not exists public.saved_views (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  view_type text not null check (view_type in ('contracts', 'tasks', 'obligations', 'renewals')),
  name text not null,
  query_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, view_type, name)
);

create index if not exists idx_saved_views_org_type
  on public.saved_views (organization_id, view_type);

create trigger update_saved_views_updated_at
  before update on public.saved_views
  for each row execute function public.update_updated_at();

alter table public.saved_views enable row level security;

create policy "Users can view own saved views"
  on public.saved_views for select
  using (user_id = auth.uid());

create policy "Users can create own saved views"
  on public.saved_views for insert
  with check (user_id = auth.uid());

create policy "Users can update own saved views"
  on public.saved_views for update
  using (user_id = auth.uid());

create policy "Users can delete own saved views"
  on public.saved_views for delete
  using (user_id = auth.uid());
