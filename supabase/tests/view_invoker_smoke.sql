-- Disposable local Supabase smoke for Objective 35.
-- Verifies tenant views run as the authenticated caller so RLS applies.

begin;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000301', 'authenticated', 'authenticated', 'view-rls-a@example.test', 'x', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000302', 'authenticated', 'authenticated', 'view-rls-b@example.test', 'x', now(), now(), now())
on conflict (id) do nothing;

insert into public.organizations (id, name)
values
  ('00000000-0000-0000-0000-00000000a301', 'View Invoker Smoke A'),
  ('00000000-0000-0000-0000-00000000b302', 'View Invoker Smoke B')
on conflict (id) do nothing;

insert into public.organization_members (organization_id, user_id, role)
values
  ('00000000-0000-0000-0000-00000000a301', '00000000-0000-0000-0000-000000000301', 'editor'),
  ('00000000-0000-0000-0000-00000000b302', '00000000-0000-0000-0000-000000000302', 'editor')
on conflict (organization_id, user_id) do nothing;

insert into public.contracts (id, organization_id, title, counterparty, contract_type, status, owner_id, created_by)
values
  ('00000000-0000-0000-0000-00000000c301', '00000000-0000-0000-0000-00000000a301', 'View Smoke Contract A', 'A', 'msa', 'active', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000301'),
  ('00000000-0000-0000-0000-00000000c302', '00000000-0000-0000-0000-00000000b302', 'View Smoke Contract B', 'B', 'msa', 'active', '00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000302')
on conflict (id) do nothing;

insert into public.extracted_fields (id, contract_id, field_name, field_value, status, source)
values
  ('00000000-0000-0000-0000-00000000e301', '00000000-0000-0000-0000-00000000c301', 'renewal_date', '2026-07-01', 'approved', 'human'),
  ('00000000-0000-0000-0000-00000000e302', '00000000-0000-0000-0000-00000000c302', 'renewal_date', '2026-08-01', 'approved', 'human')
on conflict (id) do nothing;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000301', true);

do $$
begin
  if not exists (
    select 1
    from public.contract_operational_dates
    where contract_id = '00000000-0000-0000-0000-00000000c301'
  ) then
    raise exception 'view_security_invoker_same_org_allowed failed: authenticated org member cannot read same-org view row';
  end if;

  if exists (
    select 1
    from public.contract_operational_dates
    where contract_id = '00000000-0000-0000-0000-00000000c302'
  ) then
    raise exception 'view_security_invoker_cross_org_denied failed: authenticated org member can read cross-org view row';
  end if;
end $$;

rollback;
