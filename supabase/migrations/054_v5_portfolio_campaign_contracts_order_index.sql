-- Supports paged exports and cron scans ordered by updated_at (org + campaign scope).
create index if not exists idx_portfolio_campaign_contracts_org_campaign_updated_at
  on public.portfolio_campaign_contracts (organization_id, campaign_id, updated_at desc);
