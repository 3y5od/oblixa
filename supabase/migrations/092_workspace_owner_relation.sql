-- Release-state ownership relation for workspace administration.
-- Keep organization_members.role compatible with existing RLS; Owner is resolved
-- from organizations.owner_user_id plus the stored membership role.

alter table public.organizations
  add column if not exists owner_user_id uuid references auth.users(id) on delete set null;

with first_membership as (
  select distinct on (om.organization_id)
    om.organization_id,
    om.user_id
  from public.organization_members om
  order by
    om.organization_id,
    case when om.role = 'admin' then 0 else 1 end,
    om.created_at asc
)
update public.organizations org
set owner_user_id = first_membership.user_id
from first_membership
where org.id = first_membership.organization_id
  and org.owner_user_id is null;

create index if not exists idx_organizations_owner_user
  on public.organizations(owner_user_id);
