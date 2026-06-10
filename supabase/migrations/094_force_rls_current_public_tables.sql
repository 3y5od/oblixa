-- Re-apply owner-bypass hardening after later workspace access tables.
-- Service-role bypass remains explicit through audited server helpers.

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
      and (
        c.relrowsecurity
        or c.relname in (
          'workspace_access_requests',
          'workspace_access_grants',
          'workspace_access_request_events'
        )
      )
  loop
    execute format('alter table %I.%I enable row level security', r.schema_name, r.table_name);
    execute format('alter table %I.%I force row level security', r.schema_name, r.table_name);
  end loop;
end $$;
