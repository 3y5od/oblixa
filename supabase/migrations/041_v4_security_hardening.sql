-- V4 security hardening: tenant-safe storage policies, stricter RLS for sensitive tables,
-- and tighter SECURITY DEFINER function safeguards.
-- Apply after 040_v4_exception_dedup_and_auditability.sql.

-- Extract org id from storage object names like: org/<org-uuid>/...
create or replace function public.storage_object_org_id(object_name text)
returns uuid
language plpgsql
immutable
as $$
declare
  org_text text;
begin
  if split_part(coalesce(object_name, ''), '/', 1) = 'org' then
    org_text := split_part(split_part(coalesce(object_name, ''), '/', 2), '/', 1);
  else
    -- Backward compatibility for legacy paths: <org-id>/<contract-id>/...
    org_text := split_part(coalesce(object_name, ''), '/', 1);
  end if;
  if org_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return org_text::uuid;
  end if;
  return null;
end;
$$;

drop policy if exists "Org members can upload contract files" on storage.objects;
drop policy if exists "Org members can view contract files" on storage.objects;

create policy "Org members can upload contract files"
  on storage.objects for insert
  with check (
    bucket_id = 'contracts'
    and public.storage_object_org_id(name) is not null
    and public.is_org_member(public.storage_object_org_id(name))
  );

create policy "Org members can view contract files"
  on storage.objects for select
  using (
    bucket_id = 'contracts'
    and public.storage_object_org_id(name) is not null
    and public.is_org_member(public.storage_object_org_id(name))
  );

-- SECURITY DEFINER hardening: always bind the requested user to auth.uid().
create or replace function public.create_user_org(user_id uuid, org_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
begin
  if auth.uid() is null or auth.uid() <> user_id then
    raise exception 'forbidden';
  end if;

  insert into public.organizations (name) values (org_name) returning id into new_org_id;
  insert into public.organization_members (organization_id, user_id, role)
  values (new_org_id, user_id, 'admin');
end;
$$;

-- SECURITY DEFINER hardening: pin search_path explicitly.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

-- Prevent cross-user notification insertion.
drop policy if exists "System can insert org notifications" on public.internal_notifications;
create policy "System can insert org notifications"
  on public.internal_notifications for insert
  with check (
    user_id = auth.uid()
    and organization_id in (
      select organization_id from public.organization_members where user_id = auth.uid()
    )
  );

-- Tighten access to integration connection secrets/tokens.
drop policy if exists "Members can view integration connections" on public.integration_connections;
create policy "Admins and editors can view integration connections"
  on public.integration_connections for select
  using (
    exists (
      select 1
      from public.organization_members
      where user_id = auth.uid()
        and organization_id = integration_connections.organization_id
        and role in ('admin', 'editor')
    )
  );

-- Tighten access to webhook subscription secrets.
drop policy if exists "Members can view webhook subscriptions in their org" on public.webhook_subscriptions;
create policy "Admins can view webhook subscriptions in their org"
  on public.webhook_subscriptions for select
  using (
    exists (
      select 1
      from public.organization_members
      where user_id = auth.uid()
        and organization_id = webhook_subscriptions.organization_id
        and role = 'admin'
    )
  );

-- Improve audit event integrity: caller cannot spoof another user id.
drop policy if exists "System can insert audit events" on public.audit_events;
create policy "System can insert audit events"
  on public.audit_events for insert
  with check (
    user_id = auth.uid()
    and organization_id in (
      select organization_id from public.organization_members where user_id = auth.uid()
    )
  );

-- Prevent viewers from mutating extraction jobs.
drop policy if exists "Users can manage extraction jobs in their org" on public.contract_extraction_jobs;
create policy "Editors can manage extraction jobs in their org"
  on public.contract_extraction_jobs for all
  using (
    exists (
      select 1
      from public.organization_members
      where user_id = auth.uid()
        and organization_id = contract_extraction_jobs.organization_id
        and role in ('admin', 'editor')
    )
  )
  with check (
    exists (
      select 1
      from public.organization_members
      where user_id = auth.uid()
        and organization_id = contract_extraction_jobs.organization_id
        and role in ('admin', 'editor')
    )
  );

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Org members can view contract files'
  ) then
    raise exception 'expected storage view policy not found';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'integration_connections'
      and policyname = 'Admins and editors can view integration connections'
  ) then
    raise exception 'expected integration_connections select policy not found';
  end if;
end;
$$;
