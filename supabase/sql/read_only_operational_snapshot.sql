-- Read-only Supabase operational snapshot.
-- Intended for: supabase db query --linked "$(cat supabase/sql/read_only_operational_snapshot.sql)"

with migration_ledger as (
  select
    count(*)::int as migration_count,
    min(version) as first_version,
    max(version) as latest_version,
    coalesce(jsonb_agg(version order by version), '[]'::jsonb) as versions
  from supabase_migrations.schema_migrations
),
public_tables as (
  select
    n.nspname as schema_name,
    c.relname as table_name,
    c.relrowsecurity as rls_enabled,
    c.relforcerowsecurity as rls_forced
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
),
policy_counts as (
  select
    schemaname as schema_name,
    tablename as table_name,
    count(*)::int as policy_count
  from pg_policies
  where schemaname = 'public'
  group by schemaname, tablename
),
rls_tables as (
  select
    t.schema_name,
    t.table_name,
    t.rls_enabled,
    t.rls_forced,
    coalesce(p.policy_count, 0)::int as policy_count
  from public_tables t
  left join policy_counts p
    on p.schema_name = t.schema_name
   and p.table_name = t.table_name
),
public_policies as (
  select
    schemaname as schema_name,
    tablename as table_name,
    policyname as policy_name,
    cmd,
    roles
  from pg_policies
  where schemaname = 'public'
),
public_functions as (
  select
    p.oid::regprocedure::text as function_name,
    l.lanname as language,
    p.prosecdef as security_definer,
    p.provolatile as volatility
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_language l on l.oid = p.prolang
  where n.nspname = 'public'
),
installed_extensions as (
  select
    extname as extension_name,
    extversion as extension_version
  from pg_extension
)
select
  'migration_ledger' as section,
  jsonb_build_object(
    'migrationCount', migration_count,
    'firstVersion', first_version,
    'latestVersion', latest_version,
    'versions', versions
  ) as payload
from migration_ledger
union all
select
  'table_summary' as section,
  jsonb_build_object(
    'tableCount', count(*)::int,
    'tables', coalesce(jsonb_agg(jsonb_build_object(
      'schema', schema_name,
      'name', table_name,
      'rlsEnabled', rls_enabled,
      'rlsForced', rls_forced
    ) order by table_name), '[]'::jsonb)
  ) as payload
from public_tables
union all
select
  'policy_summary' as section,
  jsonb_build_object(
    'policyCount', count(*)::int,
    'policies', coalesce(jsonb_agg(jsonb_build_object(
      'schema', schema_name,
      'table', table_name,
      'name', policy_name,
      'command', cmd,
      'roles', roles
    ) order by table_name, policy_name), '[]'::jsonb)
  ) as payload
from public_policies
union all
select
  'function_summary' as section,
  jsonb_build_object(
    'functionCount', count(*)::int,
    'functions', coalesce(jsonb_agg(jsonb_build_object(
      'name', function_name,
      'language', language,
      'securityDefiner', security_definer,
      'volatility', volatility
    ) order by function_name), '[]'::jsonb)
  ) as payload
from public_functions
union all
select
  'extension_summary' as section,
  jsonb_build_object(
    'extensionCount', count(*)::int,
    'extensions', coalesce(jsonb_agg(jsonb_build_object(
      'name', extension_name,
      'version', extension_version
    ) order by extension_name), '[]'::jsonb)
  ) as payload
from installed_extensions
union all
select
  'rls_summary' as section,
  jsonb_build_object(
    'tableCount', count(*)::int,
    'enabledCount', count(*) filter (where rls_enabled)::int,
    'forcedCount', count(*) filter (where rls_forced)::int,
    'unprotectedRlsTables', coalesce(jsonb_agg(jsonb_build_object(
      'schema', schema_name,
      'name', table_name,
      'policyCount', policy_count
    ) order by table_name) filter (where rls_enabled and policy_count = 0), '[]'::jsonb),
    'tables', coalesce(jsonb_agg(jsonb_build_object(
      'schema', schema_name,
      'name', table_name,
      'rlsEnabled', rls_enabled,
      'rlsForced', rls_forced,
      'policyCount', policy_count
    ) order by table_name), '[]'::jsonb)
  ) as payload
from rls_tables
order by section;
