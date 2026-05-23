begin;

insert into public.organizations (id, name, slug)
values ('00000000-0000-4000-8000-000000000101', 'RLS Default Deny Smoke', 'rls-default-deny-smoke')
on conflict (id) do nothing;

insert into public.contracts (id, organization_id, title, counterparty, contract_type, status, owner_id, created_by)
values (
  '00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000101',
  'RLS default deny contract',
  'Counterparty',
  'msa',
  'active',
  null,
  null
)
on conflict (id) do nothing;

create temporary table rls_default_deny_results (
  check_name text primary key,
  denied boolean not null
) on commit drop;

set local role anon;

do $$
begin
  insert into public.contracts (id, organization_id, title, counterparty, contract_type, status)
  values (
    '00000000-0000-4000-8000-000000000202',
    '00000000-0000-4000-8000-000000000101',
    'anon insert should fail',
    'Counterparty',
    'msa',
    'active'
  );
  insert into rls_default_deny_results values ('anon_direct_insert_denied', false);
exception when others then
  insert into rls_default_deny_results values ('anon_direct_insert_denied', true);
end $$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000999', true);

do $$
begin
  update public.contracts
  set title = 'authenticated update should fail'
  where id = '00000000-0000-4000-8000-000000000201';
  insert into rls_default_deny_results values ('authenticated_direct_update_denied', not found);
exception when others then
  insert into rls_default_deny_results values ('authenticated_direct_update_denied', true);
end $$;

do $$
begin
  delete from public.contracts
  where id = '00000000-0000-4000-8000-000000000201';
  insert into rls_default_deny_results values ('authenticated_direct_delete_denied', not found);
exception when others then
  insert into rls_default_deny_results values ('authenticated_direct_delete_denied', true);
end $$;

reset role;

do $$
declare
  failures text[];
begin
  select array_agg(check_name order by check_name)
    into failures
  from rls_default_deny_results
  where denied is not true;

  if array_length(failures, 1) is not null then
    raise exception 'RLS default-deny smoke checks failed: %', array_to_string(failures, ', ');
  end if;
end $$;

rollback;
