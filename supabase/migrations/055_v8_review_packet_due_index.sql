create index if not exists idx_renewal_checkpoints_org_status_due
  on public.contract_renewal_checkpoints (organization_id, status, due_date);
