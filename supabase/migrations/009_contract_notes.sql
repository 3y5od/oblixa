-- Contract notes: lightweight collaboration and operational memory.
-- Apply after 008_contract_tasks.sql

create table if not exists public.contract_notes (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  note text not null,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_contract_notes_contract_created_desc
  on public.contract_notes (contract_id, created_at desc);

create index if not exists idx_contract_notes_org_pinned
  on public.contract_notes (organization_id, pinned);

create trigger update_contract_notes_updated_at
  before update on public.contract_notes
  for each row execute function public.update_updated_at();

alter table public.contract_notes enable row level security;

create policy "Members can view contract notes in their org"
  on public.contract_notes for select
  using (
    organization_id in (
      select organization_id
      from public.organization_members
      where user_id = auth.uid()
    )
  );

create policy "Members can insert contract notes in their org"
  on public.contract_notes for insert
  with check (
    exists (
      select 1
      from public.organization_members
      where user_id = auth.uid()
        and organization_id = contract_notes.organization_id
    )
  );

create policy "Authors or editors can update contract notes in their org"
  on public.contract_notes for update
  using (
    exists (
      select 1
      from public.organization_members
      where user_id = auth.uid()
        and organization_id = contract_notes.organization_id
        and (
          role in ('admin', 'editor')
          or contract_notes.author_id = auth.uid()
        )
    )
  );

create policy "Authors or editors can delete contract notes in their org"
  on public.contract_notes for delete
  using (
    exists (
      select 1
      from public.organization_members
      where user_id = auth.uid()
        and organization_id = contract_notes.organization_id
        and (
          role in ('admin', 'editor')
          or contract_notes.author_id = auth.uid()
        )
    )
  );
