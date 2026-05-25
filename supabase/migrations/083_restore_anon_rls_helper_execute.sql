-- RLS policies evaluate public.is_org_member for anonymous REST requests.
-- The helper is auth.uid()-bound and returns false for anon, but the anon role
-- still needs EXECUTE so policies deny normally instead of raising 42501.

grant execute on function public.is_org_member(uuid) to anon;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_member(uuid) to service_role;
