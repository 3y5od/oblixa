-- Disposable local Supabase smoke for Objective 34.
-- Run with psql against a throwaway database after migrations are applied.

begin;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000101', 'authenticated', 'authenticated', 'rls-a@example.test', 'x', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000202', 'authenticated', 'authenticated', 'rls-b@example.test', 'x', now(), now(), now())
on conflict (id) do nothing;

insert into public.organizations (id, name)
values
  ('00000000-0000-0000-0000-00000000a001', 'RLS Smoke A'),
  ('00000000-0000-0000-0000-00000000b002', 'RLS Smoke B')
on conflict (id) do nothing;

insert into public.organization_members (organization_id, user_id, role)
values
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-000000000101', 'editor'),
  ('00000000-0000-0000-0000-00000000b002', '00000000-0000-0000-0000-000000000202', 'editor')
on conflict (organization_id, user_id) do nothing;

insert into public.contracts (id, organization_id, title, counterparty, contract_type, status, owner_id, created_by)
values
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000a001', 'RLS Smoke Contract A', 'A', 'msa', 'active', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000101'),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-00000000b002', 'RLS Smoke Contract B', 'B', 'msa', 'active', '00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000202')
on conflict (id) do nothing;

insert into public.contract_tasks (id, organization_id, contract_id, created_by, assignee_id, title, status)
values
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000101', 'RLS visible task', 'open'),
  ('00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-00000000b002', '00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000202', 'RLS hidden task', 'open')
on conflict (id) do nothing;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);

do $$
begin
  if not exists (
    select 1 from public.contract_tasks
    where id = '00000000-0000-0000-0000-00000000d001'
  ) then
    raise exception 'same_org_allowed failed: authenticated org member cannot read same-org task';
  end if;

  if exists (
    select 1 from public.contract_tasks
    where id = '00000000-0000-0000-0000-00000000d002'
  ) then
    raise exception 'cross_org_denied failed: authenticated org member can read cross-org task';
  end if;
end $$;

rollback;
