-- Restore PostgREST service_role DML privileges for server-side admin clients.
-- RLS remains enabled/forced for client roles; service_role is only used with
-- server-held credentials and has BYPASSRLS for audited operational paths.

grant usage on schema public to service_role;

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
  loop
    execute format(
      'grant select, insert, update, delete on table %I.%I to service_role',
      r.schema_name,
      r.table_name
    );
  end loop;
end $$;

alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;

alter default privileges in schema public
  grant usage, select, update on sequences to service_role;
