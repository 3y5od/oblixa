create unique index if not exists idx_notification_deliveries_evidence_followup_active_dedupe
  on public.notification_deliveries (
    organization_id,
    notification_type,
    ((metadata->>'source_id')),
    ((metadata->>'follow_up_stage'))
  )
  where status in ('pending', 'retrying')
    and channel = 'email'
    and notification_type in (
      'evidence_due_minus_3',
      'evidence_due',
      'evidence_overdue',
      'evidence_followup_owner',
      'evidence_followup_escalation'
    )
    and metadata ? 'source_id'
    and metadata ? 'follow_up_stage'
    and (metadata->>'source_type') = 'evidence_requirement';

create unique index if not exists idx_report_runs_automation_rule_active_dedupe
  on public.report_runs (
    organization_id,
    report_mode,
    ((metrics_json->>'rule_id')),
    ((metrics_json->>'contract_id'))
  )
  where status in ('queued', 'running')
    and (metrics_json->>'source') = 'automation_rule'
    and metrics_json ? 'rule_id'
    and metrics_json ? 'contract_id';

create unique index if not exists idx_report_runs_report_pack_cron_slot_dedupe
  on public.report_runs (
    organization_id,
    ((metrics_json->>'report_pack_id')),
    ((metrics_json->>'schedule_slot'))
  )
  where (metrics_json->>'source') = 'report_pack_generation_cron'
    and metrics_json ? 'report_pack_id'
    and metrics_json ? 'schedule_slot';

create unique index if not exists idx_review_board_runs_cron_slot_dedupe
  on public.review_board_runs (
    organization_id,
    review_board_id,
    ((agenda_json->>'schedule_slot'))
  )
  where (agenda_json->>'source') = 'cron'
    and agenda_json ? 'schedule_slot';