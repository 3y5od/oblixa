-- Defense-in-depth for inbound and service-role evidence submission writes.

create or replace function public.ensure_evidence_submission_requirement_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.evidence_requirements er
    where er.id = new.requirement_id
      and er.organization_id = new.organization_id
  ) then
    raise exception 'evidence submission requirement scope mismatch'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_evidence_submission_requirement_scope on public.evidence_submissions;
create trigger trg_evidence_submission_requirement_scope
  before insert or update of organization_id, requirement_id
  on public.evidence_submissions
  for each row
  execute function public.ensure_evidence_submission_requirement_scope();

create table if not exists public.inbound_provider_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source text not null check (source in ('email', 'slack', 'integrations_callback')),
  external_message_id text not null,
  target_table text,
  target_id uuid,
  received_at timestamptz not null default now(),
  unique (organization_id, source, external_message_id)
);

create index if not exists idx_inbound_provider_events_org_received
  on public.inbound_provider_events (organization_id, received_at desc);

alter table public.inbound_provider_events enable row level security;
alter table public.inbound_provider_events force row level security;
