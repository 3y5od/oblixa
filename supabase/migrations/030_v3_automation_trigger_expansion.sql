-- V3 automation trigger expansion
-- Adds trigger types for approval stalls, risk thresholds, and data quality gaps.
-- Apply after 029_v3_reporting_data_quality.sql

alter table public.task_automation_rules
  drop constraint if exists task_automation_rules_trigger_type_check;

alter table public.task_automation_rules
  add constraint task_automation_rules_trigger_type_check
  check (
    trigger_type in (
      'field_missing',
      'date_window',
      'ownership_change',
      'renewal_window',
      'approval_stall',
      'risk_threshold',
      'data_quality_gap'
    )
  );
