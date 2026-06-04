create table if not exists public.workspace_access_requests (
  id uuid primary key default gen_random_uuid(),
  normalized_email text not null,
  requester_name text not null,
  company_name text not null,
  requester_role text,
  approximate_contract_count text,
  current_tracking_method text,
  has_tracker text,
  redacted_sample_available text,
  follow_up_preference text,
  pain_summary text,
  message text,
  source text not null default 'request_access' check (source in ('request_access', 'contact')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'closed')),
  duplicate_count integer not null default 0 check (duplicate_count >= 0),
  last_submitted_at timestamptz not null default now(),
  last_submission_json jsonb not null default '{}'::jsonb,
  last_operator_note text,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_workspace_access_requests_status_created
  on public.workspace_access_requests(status, created_at desc);

create index if not exists idx_workspace_access_requests_email
  on public.workspace_access_requests(normalized_email);

create unique index if not exists ux_workspace_access_requests_normalized_email
  on public.workspace_access_requests(normalized_email);

alter table public.workspace_access_requests enable row level security;

revoke all on table public.workspace_access_requests from public;
revoke all on table public.workspace_access_requests from anon;
revoke all on table public.workspace_access_requests from authenticated;
grant select, insert, update on table public.workspace_access_requests to service_role;

create table if not exists public.workspace_access_grants (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.workspace_access_requests(id) on delete set null,
  normalized_email text not null,
  token_hash text not null unique,
  status text not null default 'issued' check (status in ('issued', 'used', 'revoked', 'expired')),
  expires_at timestamptz not null,
  issued_by uuid references auth.users(id) on delete set null,
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_workspace_access_grants_request_created
  on public.workspace_access_grants(request_id, created_at desc);

create index if not exists idx_workspace_access_grants_email_status
  on public.workspace_access_grants(normalized_email, status, expires_at);

alter table public.workspace_access_grants enable row level security;

revoke all on table public.workspace_access_grants from public;
revoke all on table public.workspace_access_grants from anon;
revoke all on table public.workspace_access_grants from authenticated;
grant select, insert, update on table public.workspace_access_grants to service_role;

create table if not exists public.workspace_access_request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.workspace_access_requests(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_workspace_access_request_events_request_created
  on public.workspace_access_request_events(request_id, created_at desc);

alter table public.workspace_access_request_events enable row level security;

revoke all on table public.workspace_access_request_events from public;
revoke all on table public.workspace_access_request_events from anon;
revoke all on table public.workspace_access_request_events from authenticated;
grant select, insert on table public.workspace_access_request_events to service_role;
