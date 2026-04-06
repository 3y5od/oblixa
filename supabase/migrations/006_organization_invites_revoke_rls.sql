-- Revoke invites + tighten unique pending index + admin read policy

alter table public.organization_invites
  add column if not exists revoked_at timestamptz;

drop index if exists idx_organization_invites_one_pending_per_email;

create unique index idx_organization_invites_one_pending_per_email
  on public.organization_invites (organization_id, lower(email))
  where consumed_at is null and revoked_at is null;

create policy "Admins can read org invites"
  on public.organization_invites for select
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and role = 'admin'
    )
  );
