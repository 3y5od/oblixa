-- Legal hold on profiles: blocks self-service DSR export/delete paths when asserted by operators.

alter table public.profiles
  add column if not exists legal_hold boolean not null default false;

comment on column public.profiles.legal_hold is
  'When true, self-service export/delete hooks must refuse and defer to operator workflows.';

create index if not exists idx_profiles_legal_hold_true
  on public.profiles (id)
  where legal_hold = true;
