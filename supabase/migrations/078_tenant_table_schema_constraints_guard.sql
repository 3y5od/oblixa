-- Fail future deployments if tenant-owned organization_id columns lose structural ownership constraints.
-- v10_runtime_coverage_ledger is intentionally tenant-adjacent rather than tenant-owned:
-- some release/blocker coverage rows are global and therefore have a nullable organization_id.
do $$
declare
  missing_not_null text[];
  missing_fk text[];
begin
  select coalesce(array_agg(c.table_name order by c.table_name), array[]::text[])
    into missing_not_null
  from (
    select pc.oid as table_oid, pc.relname::text as table_name, a.attnum, a.attnotnull
    from pg_class pc
    join pg_namespace pn
      on pn.oid = pc.relnamespace
    join pg_attribute a
      on a.attrelid = pc.oid
    where pn.nspname = 'public'
      and pc.relkind = 'r'
      and a.attnum > 0
      and a.attisdropped = false
      and a.attname = 'organization_id'
  ) c
  where c.attnotnull = false
    and c.table_name <> 'v10_runtime_coverage_ledger';

  select coalesce(array_agg(c.table_name order by c.table_name), array[]::text[])
    into missing_fk
  from (
    select pc.oid as table_oid, pc.relname::text as table_name, a.attnum
    from pg_class pc
    join pg_namespace pn
      on pn.oid = pc.relnamespace
    join pg_attribute a
      on a.attrelid = pc.oid
    where pn.nspname = 'public'
      and pc.relkind = 'r'
      and a.attnum > 0
      and a.attisdropped = false
      and a.attname = 'organization_id'
  ) c
  cross join (
    select attnum
    from pg_attribute
    where attrelid = 'public.organizations'::regclass
      and attname = 'id'
      and attnum > 0
      and attisdropped = false
  ) org_id
  where true
    and not exists (
      select 1
      from pg_constraint fk
      where fk.conrelid = c.table_oid
        and fk.contype = 'f'
        and fk.conkey = array[c.attnum]::smallint[]
        and fk.confrelid = 'public.organizations'::regclass
        and fk.confkey = array[org_id.attnum]::smallint[]
    );

  if array_length(missing_not_null, 1) is not null then
    raise exception 'tenant organization_id columns must be NOT NULL: %', array_to_string(missing_not_null, ', ');
  end if;

  if array_length(missing_fk, 1) is not null then
    raise exception 'tenant organization_id columns must reference public.organizations(id): %', array_to_string(missing_fk, ', ');
  end if;
end $$;
