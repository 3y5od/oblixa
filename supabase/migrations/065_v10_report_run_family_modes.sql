alter table public.report_runs
  drop constraint if exists report_runs_report_mode_check;

alter table public.report_runs
  add constraint report_runs_report_mode_check
  check (
    report_mode in (
      'saved_view',
      'exceptions',
      'management',
      'contract_portfolio_summary',
      'renewal_horizon_report',
      'overdue_work_report',
      'exception_report',
      'evidence_status_report',
      'approval_sla_report',
      'data_quality_report',
      'audit_activity_report',
      'import_extraction_reliability_report',
      'workspace_health_report'
    )
  );