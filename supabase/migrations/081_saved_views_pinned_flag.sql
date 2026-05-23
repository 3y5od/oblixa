-- Saved-view pinning is used by dashboard panels, command palette indexing,
-- and saved-view actions. Keep the schema aligned with those runtime callers.

alter table public.saved_views
  add column if not exists pinned boolean not null default false;

create index if not exists idx_saved_views_org_pinned
  on public.saved_views (organization_id, view_type, updated_at desc)
  where pinned = true;
