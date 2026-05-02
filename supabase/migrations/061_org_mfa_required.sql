-- Optional org-wide MFA requirement (enforced in dashboard layout + MFA settings).
alter table public.organizations
  add column if not exists mfa_required boolean not null default false;

comment on column public.organizations.mfa_required is
  'When true, dashboard routes require AAL2 (verified MFA) except /settings/security for enrollment.';
