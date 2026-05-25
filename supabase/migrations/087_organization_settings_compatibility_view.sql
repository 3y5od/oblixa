create or replace view public.organization_settings
with (security_invoker = true)
as
select
  id as organization_id,
  name as organization_name,
  v6_org_settings_json as org_settings_json
from public.organizations;
