-- Improve contracts list search and filtered sort performance.
create extension if not exists pg_trgm;

create index if not exists idx_contracts_title_trgm
  on public.contracts using gin (title gin_trgm_ops);

create index if not exists idx_contracts_counterparty_trgm
  on public.contracts using gin (counterparty gin_trgm_ops);

create index if not exists idx_contracts_type_trgm
  on public.contracts using gin (contract_type gin_trgm_ops);

create index if not exists idx_contracts_search_document_trgm
  on public.contracts using gin (search_document gin_trgm_ops);

create index if not exists idx_contracts_org_owner_created_desc
  on public.contracts (organization_id, owner_id, created_at desc);

create index if not exists idx_contracts_org_region_created_desc
  on public.contracts (organization_id, region, created_at desc);
