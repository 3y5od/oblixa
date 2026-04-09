-- Fix RLS recursion on organization_members by using a SECURITY DEFINER helper.
-- Apply after 034_retry_worker_perf_and_observability_indexes.sql.

create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = target_org
      and om.user_id = auth.uid()
  );
$$;

drop policy if exists "Members can view org memberships" on public.organization_members;
create policy "Members can view org memberships"
  on public.organization_members for select
  using (
    user_id = auth.uid()
    or public.is_org_member(organization_id)
  );
