create index if not exists idx_report_subscriptions_organization_id
  on public.report_subscriptions (organization_id);

create index if not exists idx_internal_notifications_organization_id
  on public.internal_notifications (organization_id);

create index if not exists idx_contract_handoff_checklists_organization_id
  on public.contract_handoff_checklists (organization_id);

create index if not exists idx_contract_import_job_rows_organization_id
  on public.contract_import_job_rows (organization_id);

create index if not exists idx_calendar_feeds_organization_id
  on public.calendar_feeds (organization_id);

create index if not exists idx_integration_connections_organization_id
  on public.integration_connections (organization_id);

create index if not exists idx_field_templates_organization_id
  on public.field_templates (organization_id);

create index if not exists idx_reminder_templates_organization_id
  on public.reminder_templates (organization_id);

create index if not exists idx_task_templates_organization_id
  on public.task_templates (organization_id);

create index if not exists idx_organization_workflow_settings_organization_id
  on public.organization_workflow_settings (organization_id);

create index if not exists idx_integration_oauth_states_organization_id
  on public.integration_oauth_states (organization_id);

create index if not exists idx_outbound_event_deliveries_organization_id
  on public.outbound_event_deliveries (organization_id);

create index if not exists idx_template_change_events_organization_id
  on public.template_change_events (organization_id);

create index if not exists idx_contract_task_checklist_items_organization_id
  on public.contract_task_checklist_items (organization_id);

create index if not exists idx_contract_task_comments_organization_id
  on public.contract_task_comments (organization_id);

create index if not exists idx_contract_obligation_events_organization_id
  on public.contract_obligation_events (organization_id);

create index if not exists idx_contract_approval_events_organization_id
  on public.contract_approval_events (organization_id);

create index if not exists idx_contract_renewal_workspace_notes_organization_id
  on public.contract_renewal_workspace_notes (organization_id);

create index if not exists idx_contract_task_artifacts_organization_id
  on public.contract_task_artifacts (organization_id);

create index if not exists idx_contract_program_versions_organization_id
  on public.contract_program_versions (organization_id);

create index if not exists idx_contract_program_assignments_organization_id
  on public.contract_program_assignments (organization_id);

create index if not exists idx_exception_events_organization_id
  on public.exception_events (organization_id);

create index if not exists idx_evidence_submissions_organization_id
  on public.evidence_submissions (organization_id);

create index if not exists idx_attestation_responses_organization_id
  on public.attestation_responses (organization_id);

create index if not exists idx_maintenance_campaign_rows_organization_id
  on public.maintenance_campaign_rows (organization_id);

create index if not exists idx_report_pack_runs_organization_id
  on public.report_pack_runs (organization_id);

create index if not exists idx_capacity_snapshots_organization_id
  on public.capacity_snapshots (organization_id);

create index if not exists idx_decision_packet_templates_organization_id
  on public.decision_packet_templates (organization_id);
