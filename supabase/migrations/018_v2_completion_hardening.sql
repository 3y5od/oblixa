-- V2 completion hardening: policy controls, webhook delivery tracking, API keys, configurable cadence.
-- Apply after 017_v2_operational_depth.sql

alter table public.contracts
  add column if not exists owner_assigned_at timestamptz not null default now();

create table if not exists public.organization_workflow_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  weekly_intake_lookback_days integer not null default 7 check (weekly_intake_lookback_days between 1 and 30),
  renewal_horizon_days integer not null default 90 check (renewal_horizon_days between 30 and 365),
  stale_contract_days integer not null default 120 check (stale_contract_days between 30 and 365),
  stale_ownership_days integer not null default 90 check (stale_ownership_days between 14 and 365),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger update_organization_workflow_settings_updated_at
  before update on public.organization_workflow_settings
  for each row execute function public.update_updated_at();

create table if not exists public.approval_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  approval_type text not null check (approval_type in ('renewal_decision', 'notice_action', 'commercial_exception', 'ownership_handoff')),
  min_annual_value numeric(14, 2),
  contract_type text,
  required_approver_id uuid references auth.users(id) on delete set null,
  required boolean not null default true,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_approval_policies_org_active
  on public.approval_policies (organization_id, active, approval_type);

create trigger update_approval_policies_updated_at
  before update on public.approval_policies
  for each row execute function public.update_updated_at();

alter table public.integration_connections
  add column if not exists access_token text,
  add column if not exists refresh_token text,
  add column if not exists token_expires_at timestamptz,
  add column if not exists connected_account text,
  add column if not exists oauth_connected_at timestamptz;

create table if not exists public.integration_oauth_states (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('google_calendar', 'outlook_calendar', 'slack', 'email', 'crm')),
  state text not null unique,
  requested_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.integration_api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  label text not null,
  key_prefix text not null,
  key_hash text not null unique,
  active boolean not null default true,
  last_used_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_integration_api_keys_org_active
  on public.integration_api_keys (organization_id, active);

create trigger update_integration_api_keys_updated_at
  before update on public.integration_api_keys
  for each row execute function public.update_updated_at();

create table if not exists public.outbound_event_deliveries (
  id uuid primary key default gen_random_uuid(),
  outbound_event_id uuid not null references public.outbound_events(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subscription_id uuid not null references public.webhook_subscriptions(id) on delete cascade,
  attempt_count integer not null default 0,
  last_attempt_at timestamptz,
  last_error text,
  delivered boolean not null default false,
  delivered_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (outbound_event_id, subscription_id)
);

create index if not exists idx_outbound_event_deliveries_next_attempt
  on public.outbound_event_deliveries (delivered, next_attempt_at);

create trigger update_outbound_event_deliveries_updated_at
  before update on public.outbound_event_deliveries
  for each row execute function public.update_updated_at();

create table if not exists public.template_change_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  template_type text not null check (template_type in ('field', 'reminder', 'task', 'playbook', 'obligation')),
  template_id uuid not null,
  action text not null check (action in ('created', 'updated', 'toggled', 'applied')),
  details jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.organization_workflow_settings enable row level security;
alter table public.approval_policies enable row level security;
alter table public.integration_oauth_states enable row level security;
alter table public.integration_api_keys enable row level security;
alter table public.outbound_event_deliveries enable row level security;
alter table public.template_change_events enable row level security;

create policy "Members can view workflow settings"
  on public.organization_workflow_settings for select
  using (organization_id in (select organization_id from public.organization_members where user_id = auth.uid()));

create policy "Admins can manage workflow settings"
  on public.organization_workflow_settings for all
  using (
    exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = organization_workflow_settings.organization_id
        and role = 'admin'
    )
  );

create policy "Members can view approval policies"
  on public.approval_policies for select
  using (organization_id in (select organization_id from public.organization_members where user_id = auth.uid()));

create policy "Admins can manage approval policies"
  on public.approval_policies for all
  using (
    exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = approval_policies.organization_id
        and role = 'admin'
    )
  );

create policy "Members can view oauth states"
  on public.integration_oauth_states for select
  using (organization_id in (select organization_id from public.organization_members where user_id = auth.uid()));

create policy "Admins can manage oauth states"
  on public.integration_oauth_states for all
  using (
    exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = integration_oauth_states.organization_id
        and role = 'admin'
    )
  );

create policy "Members can view integration api keys"
  on public.integration_api_keys for select
  using (organization_id in (select organization_id from public.organization_members where user_id = auth.uid()));

create policy "Admins can manage integration api keys"
  on public.integration_api_keys for all
  using (
    exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = integration_api_keys.organization_id
        and role = 'admin'
    )
  );

create policy "Members can view outbound delivery states"
  on public.outbound_event_deliveries for select
  using (organization_id in (select organization_id from public.organization_members where user_id = auth.uid()));

create policy "Editors can manage outbound delivery states"
  on public.outbound_event_deliveries for all
  using (
    exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = outbound_event_deliveries.organization_id
        and role in ('admin', 'editor')
    )
  );

create policy "Members can view template change events"
  on public.template_change_events for select
  using (organization_id in (select organization_id from public.organization_members where user_id = auth.uid()));

create policy "Editors can insert template change events"
  on public.template_change_events for insert
  with check (
    exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = template_change_events.organization_id
        and role in ('admin', 'editor')
    )
  );
