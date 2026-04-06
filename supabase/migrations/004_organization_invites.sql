-- DB-backed org invites: token row validated on first login (email must match).

create table public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'editor', 'viewer')),
  invited_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_organization_invites_org on public.organization_invites(organization_id);
create index idx_organization_invites_email_lower on public.organization_invites (lower(email));

create unique index idx_organization_invites_one_pending_per_email
  on public.organization_invites (organization_id, lower(email))
  where consumed_at is null;

alter table public.organization_invites enable row level security;
