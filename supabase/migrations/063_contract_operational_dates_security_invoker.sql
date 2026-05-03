-- Supabase advisor: default view behavior is SECURITY DEFINER (owner privileges on
-- underlying tables). Use security_invoker so RLS and grants apply to the querying role.
-- Requires PostgreSQL 15+ (view option).
create or replace view public.contract_operational_dates
with (security_invoker = true)
as
select
  c.id as contract_id,
  c.organization_id,
  max(ef.field_value) filter (
    where ef.status = 'approved' and ef.field_name = 'renewal_date'
  ) as renewal_date_raw,
  max(ef.field_value) filter (
    where ef.status = 'approved' and ef.field_name = 'end_date'
  ) as end_date_raw,
  max(ef.field_value) filter (
    where ef.status = 'approved' and ef.field_name = 'notice_window'
  ) as notice_window_raw
from public.contracts c
left join public.extracted_fields ef on ef.contract_id = c.id
group by c.id, c.organization_id;
