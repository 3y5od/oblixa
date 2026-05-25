-- Compatibility view for app code that still reads contract_fields.
-- Keep security_invoker so table RLS applies to non-service callers.
create or replace view public.contract_fields
with (security_invoker = true)
as
select
  ef.id,
  ef.contract_id,
  c.organization_id,
  ef.field_name,
  ef.field_value,
  ef.source_snippet,
  ef.confidence,
  ef.status,
  ef.source,
  ef.reviewed_by,
  ef.reviewed_at,
  ef.created_at,
  ef.updated_at
from public.extracted_fields ef
join public.contracts c on c.id = ef.contract_id;
