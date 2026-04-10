-- Optional hot-path indexes for V6 assurance analytics (org-scoped time windows).
create index if not exists idx_external_action_events_org_created_event
  on public.external_action_events (organization_id, created_at desc, event_type);

create index if not exists idx_assurance_finding_events_org_created
  on public.assurance_finding_events (organization_id, created_at desc);
