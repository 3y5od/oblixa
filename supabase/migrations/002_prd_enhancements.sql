-- PRD-aligned enhancements: onboarding flag, full-document search text

alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz;

alter table public.contracts
  add column if not exists search_document text;

comment on column public.contracts.search_document is
  'Concatenated extracted plain text from contract files; used for keyword search.';
