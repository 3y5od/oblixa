-- Oblixa — Initial Schema
-- Run this in Supabase Dashboard → SQL Editor

-- 1. Organizations
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Profiles (extends auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Organization members
create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'editor', 'viewer')) default 'editor',
  created_at timestamptz not null default now(),
  unique(organization_id, user_id)
);

-- 4. Contracts
create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  counterparty text,
  contract_type text,
  status text not null check (status in ('draft', 'pending_review', 'active', 'expired', 'terminated')) default 'pending_review',
  owner_id uuid references auth.users(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. Contract files
create table public.contract_files (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  file_name text not null,
  file_type text not null,
  file_size integer not null,
  storage_path text not null,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- 6. Extracted fields
create table public.extracted_fields (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  field_name text not null,
  field_value text,
  source_snippet text,
  confidence real,
  status text not null check (status in ('pending', 'approved', 'rejected', 'edited')) default 'pending',
  source text not null check (source in ('ai', 'human')) default 'ai',
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 7. Reminders
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  field_id uuid references public.extracted_fields(id) on delete set null,
  reminder_type text not null,
  reminder_date date not null,
  sent_at timestamptz,
  recipient_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- 8. Audit events
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid references public.contracts(id) on delete set null,
  user_id uuid references auth.users(id),
  action text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

-- Indexes for common queries
create index idx_contracts_org on public.contracts(organization_id);
create index idx_contracts_status on public.contracts(status);
create index idx_contracts_owner on public.contracts(owner_id);
create index idx_contract_files_contract on public.contract_files(contract_id);
create index idx_extracted_fields_contract on public.extracted_fields(contract_id);
create index idx_extracted_fields_status on public.extracted_fields(status);
create index idx_reminders_contract on public.reminders(contract_id);
create index idx_reminders_date on public.reminders(reminder_date);
create index idx_audit_events_org on public.audit_events(organization_id);
create index idx_audit_events_contract on public.audit_events(contract_id);
create index idx_org_members_org on public.organization_members(organization_id);
create index idx_org_members_user on public.organization_members(user_id);

-- Auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Auto-update updated_at timestamp
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_organizations_updated_at
  before update on public.organizations
  for each row execute function public.update_updated_at();

create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();

create trigger update_contracts_updated_at
  before update on public.contracts
  for each row execute function public.update_updated_at();

create trigger update_extracted_fields_updated_at
  before update on public.extracted_fields
  for each row execute function public.update_updated_at();

-- Row Level Security
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.contracts enable row level security;
alter table public.contract_files enable row level security;
alter table public.extracted_fields enable row level security;
alter table public.reminders enable row level security;
alter table public.audit_events enable row level security;

-- Profiles: users can read/update their own profile
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Organization members: users can see memberships for their orgs
create policy "Members can view org memberships"
  on public.organization_members for select
  using (
    user_id = auth.uid()
    or organization_id in (
      select organization_id from public.organization_members where user_id = auth.uid()
    )
  );

-- Organizations: users can see orgs they belong to
create policy "Members can view their organizations"
  on public.organizations for select
  using (
    id in (select organization_id from public.organization_members where user_id = auth.uid())
  );

create policy "Admins can update their organizations"
  on public.organizations for update
  using (
    id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- Contracts: org members can see contracts in their org
create policy "Members can view org contracts"
  on public.contracts for select
  using (
    organization_id in (
      select organization_id from public.organization_members where user_id = auth.uid()
    )
  );

create policy "Editors can insert contracts"
  on public.contracts for insert
  with check (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and role in ('admin', 'editor')
    )
  );

create policy "Editors can update contracts"
  on public.contracts for update
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and role in ('admin', 'editor')
    )
  );

create policy "Admins can delete contracts"
  on public.contracts for delete
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- Contract files: follow contract access
create policy "Members can view contract files"
  on public.contract_files for select
  using (
    contract_id in (
      select c.id from public.contracts c
      join public.organization_members om on om.organization_id = c.organization_id
      where om.user_id = auth.uid()
    )
  );

create policy "Editors can insert contract files"
  on public.contract_files for insert
  with check (
    contract_id in (
      select c.id from public.contracts c
      join public.organization_members om on om.organization_id = c.organization_id
      where om.user_id = auth.uid() and om.role in ('admin', 'editor')
    )
  );

-- Extracted fields: follow contract access
create policy "Members can view extracted fields"
  on public.extracted_fields for select
  using (
    contract_id in (
      select c.id from public.contracts c
      join public.organization_members om on om.organization_id = c.organization_id
      where om.user_id = auth.uid()
    )
  );

create policy "Editors can insert extracted fields"
  on public.extracted_fields for insert
  with check (
    contract_id in (
      select c.id from public.contracts c
      join public.organization_members om on om.organization_id = c.organization_id
      where om.user_id = auth.uid() and om.role in ('admin', 'editor')
    )
  );

create policy "Editors can update extracted fields"
  on public.extracted_fields for update
  using (
    contract_id in (
      select c.id from public.contracts c
      join public.organization_members om on om.organization_id = c.organization_id
      where om.user_id = auth.uid() and om.role in ('admin', 'editor')
    )
  );

-- Reminders: follow contract access
create policy "Members can view reminders"
  on public.reminders for select
  using (
    contract_id in (
      select c.id from public.contracts c
      join public.organization_members om on om.organization_id = c.organization_id
      where om.user_id = auth.uid()
    )
  );

create policy "Editors can manage reminders"
  on public.reminders for all
  using (
    contract_id in (
      select c.id from public.contracts c
      join public.organization_members om on om.organization_id = c.organization_id
      where om.user_id = auth.uid() and om.role in ('admin', 'editor')
    )
  );

-- Audit events: org members can view
create policy "Members can view audit events"
  on public.audit_events for select
  using (
    organization_id in (
      select organization_id from public.organization_members where user_id = auth.uid()
    )
  );

create policy "System can insert audit events"
  on public.audit_events for insert
  with check (
    organization_id in (
      select organization_id from public.organization_members where user_id = auth.uid()
    )
  );

-- RPC: auto-create org + membership on signup
create or replace function public.create_user_org(user_id uuid, org_name text)
returns void as $$
declare
  new_org_id uuid;
begin
  insert into public.organizations (name) values (org_name) returning id into new_org_id;
  insert into public.organization_members (organization_id, user_id, role)
  values (new_org_id, user_id, 'admin');
end;
$$ language plpgsql security definer;

-- Storage bucket for contract files
insert into storage.buckets (id, name, public)
values ('contracts', 'contracts', false)
on conflict (id) do nothing;

create policy "Org members can upload contract files"
  on storage.objects for insert
  with check (
    bucket_id = 'contracts'
    and auth.uid() is not null
  );

create policy "Org members can view contract files"
  on storage.objects for select
  using (
    bucket_id = 'contracts'
    and auth.uid() is not null
  );
