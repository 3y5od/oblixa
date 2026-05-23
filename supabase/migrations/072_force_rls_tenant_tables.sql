-- Force RLS for tenant data tables and make missing direct writes explicit.
-- Service-role bypass remains explicit: application code must use the audited
-- service-role helpers when it intentionally bypasses member RLS.

do $$
declare
  r record;
begin
  for r in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relrowsecurity
  loop
    execute format('alter table %I.%I enable row level security', r.schema_name, r.table_name);
    execute format('alter table %I.%I force row level security', r.schema_name, r.table_name);

    if not exists (
      select 1 from pg_policies
      where schemaname = r.schema_name
        and tablename = r.table_name
        and cmd in ('INSERT', 'ALL')
    ) then
      execute format(
        'create policy "No direct tenant insert by default" on %I.%I for insert with check (false)',
        r.schema_name,
        r.table_name
      );
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = r.schema_name
        and tablename = r.table_name
        and cmd in ('UPDATE', 'ALL')
    ) then
      execute format(
        'create policy "No direct tenant update by default" on %I.%I for update using (false) with check (false)',
        r.schema_name,
        r.table_name
      );
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = r.schema_name
        and tablename = r.table_name
        and cmd in ('DELETE', 'ALL')
    ) then
      execute format(
        'create policy "No direct tenant delete by default" on %I.%I for delete using (false)',
        r.schema_name,
        r.table_name
      );
    end if;
  end loop;
end $$;
