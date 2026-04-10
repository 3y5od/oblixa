-- Optional contract tags for V6 segment criteria (tag overlap matching).
alter table public.contracts
  add column if not exists tags text[] not null default '{}'::text[];

comment on column public.contracts.tags is 'Optional labels for portfolio segmentation (V6).';

create index if not exists idx_contracts_org_tags on public.contracts using gin (tags);
