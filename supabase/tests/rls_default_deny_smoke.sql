begin;

insert into public.organizations (id, name)
values ('00000000-0000-4000-8000-000000000101', 'RLS Default Deny Smoke')
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

set local role anon;

do $$
declare
  denied boolean := false;
begin
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
  exception when others then
    denied := true;
  end;

  if denied is not true then
    raise exception 'RLS default-deny smoke checks failed: anon_direct_insert_denied';
  end if;
end $$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000999', true);

do $$
declare
  denied boolean := false;
  affected_rows integer := 0;
begin
  begin
    update public.contracts
    set title = 'authenticated update should fail'
    where id = '00000000-0000-4000-8000-000000000201';
    get diagnostics affected_rows = row_count;
  exception when others then
    denied := true;
  end;

  if denied is not true and affected_rows <> 0 then
    raise exception 'RLS default-deny smoke checks failed: authenticated_direct_update_denied';
  end if;
end $$;

do $$
declare
  denied boolean := false;
  affected_rows integer := 0;
begin
  begin
    delete from public.contracts
    where id = '00000000-0000-4000-8000-000000000201';
    get diagnostics affected_rows = row_count;
  exception when others then
    denied := true;
  end;

  if denied is not true and affected_rows <> 0 then
    raise exception 'RLS default-deny smoke checks failed: authenticated_direct_delete_denied';
  end if;
end $$;

reset role;

rollback;
