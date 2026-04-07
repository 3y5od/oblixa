-- V2 operational depth: watchlists, value-based renewals, templates, integration control surface.
-- Apply after 016_v2_remaining_depth.sql

alter table public.contracts
  add column if not exists annual_value numeric(14, 2),
  add column if not exists crm_sync_status text check (crm_sync_status in ('never', 'ok', 'error')) default 'never',
  add column if not exists crm_last_synced_at timestamptz;

create index if not exists idx_contracts_org_renewal_value
  on public.contracts (organization_id, annual_value desc);

create table if not exists public.contract_watchlists (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  team_key text,
  note text,
  created_at timestamptz not null default now(),
  unique (contract_id, user_id)
);

create index if not exists idx_contract_watchlists_org_user
  on public.contract_watchlists (organization_id, user_id, created_at desc);

create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('google_calendar', 'outlook_calendar', 'slack', 'email', 'crm')),
  status text not null check (status in ('not_connected', 'connected', 'error')) default 'not_connected',
  config_json jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  last_error text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider)
);

create trigger update_integration_connections_updated_at
  before update on public.integration_connections
  for each row execute function public.update_updated_at();

create table if not exists public.field_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_type text,
  field_name text not null,
  default_value text,
  required boolean not null default false,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, contract_type, field_name)
);

create table if not exists public.reminder_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_type text,
  field_name text not null,
  offset_days integer not null check (offset_days >= 0),
  reminder_type text not null,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, contract_type, field_name, offset_days, reminder_type)
);

create table if not exists public.task_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_type text,
  team_key text,
  title text not null,
  details text,
  due_offset_days integer not null default 7 check (due_offset_days >= 0),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.contract_watchlists enable row level security;
alter table public.integration_connections enable row level security;
alter table public.field_templates enable row level security;
alter table public.reminder_templates enable row level security;
alter table public.task_templates enable row level security;

create policy "Members can view watchlists in org"
  on public.contract_watchlists for select
  using (
    organization_id in (
      select organization_id from public.organization_members where user_id = auth.uid()
    )
  );

create policy "Users can manage own watchlist entries"
  on public.contract_watchlists for all
  using (user_id = auth.uid());

create policy "Members can view integration connections"
  on public.integration_connections for select
  using (
    organization_id in (
      select organization_id from public.organization_members where user_id = auth.uid()
    )
  );

create policy "Admins can manage integration connections"
  on public.integration_connections for all
  using (
    exists (
      select 1
      from public.organization_members
      where user_id = auth.uid()
        and organization_id = integration_connections.organization_id
        and role = 'admin'
    )
  );

create policy "Members can view field templates"
  on public.field_templates for select
  using (
    organization_id in (
      select organization_id from public.organization_members where user_id = auth.uid()
    )
  );

create policy "Editors can manage field templates"
  on public.field_templates for all
  using (
    exists (
      select 1
      from public.organization_members
      where user_id = auth.uid()
        and organization_id = field_templates.organization_id
        and role in ('admin', 'editor')
    )
  );

create policy "Members can view reminder templates"
  on public.reminder_templates for select
  using (
    organization_id in (
      select organization_id from public.organization_members where user_id = auth.uid()
    )
  );

create policy "Editors can manage reminder templates"
  on public.reminder_templates for all
  using (
    exists (
      select 1
      from public.organization_members
      where user_id = auth.uid()
        and organization_id = reminder_templates.organization_id
        and role in ('admin', 'editor')
    )
  );

create policy "Members can view task templates"
  on public.task_templates for select
  using (
    organization_id in (
      select organization_id from public.organization_members where user_id = auth.uid()
    )
  );

create policy "Editors can manage task templates"
  on public.task_templates for all
  using (
    exists (
      select 1
      from public.organization_members
      where user_id = auth.uid()
        and organization_id = task_templates.organization_id
        and role in ('admin', 'editor')
    )
  );
