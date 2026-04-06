-- Composite indexes for common org-scoped contract lists and status filters.
-- Apply after 006_organization_invites_revoke_rls.sql

create index if not exists idx_contracts_org_created_at_desc
  on public.contracts (organization_id, created_at desc);

create index if not exists idx_contracts_org_status
  on public.contracts (organization_id, status);
