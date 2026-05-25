-- Forward-only neutral read-only view aliases for versioned SQL tables.
-- Legacy tables remain the data-bearing source until linked catalog verification,
-- application cutover evidence, and compatibility queues approve legacy removal.

create or replace view public.activation_state
with (security_invoker = true)
as
select * from public.v10_activation_state;

revoke all on table public.activation_state from public;
grant select on table public.activation_state to authenticated;
grant select on table public.activation_state to service_role;

create or replace view public.advanced_assurance_linked_records
with (security_invoker = true)
as
select * from public.v10_advanced_assurance_linked_records;

revoke all on table public.advanced_assurance_linked_records from public;
grant select on table public.advanced_assurance_linked_records to authenticated;
grant select on table public.advanced_assurance_linked_records to service_role;

create or replace view public.approval_records
with (security_invoker = true)
as
select * from public.v10_approval_records;

revoke all on table public.approval_records from public;
grant select on table public.approval_records to authenticated;
grant select on table public.approval_records to service_role;

do $$
begin
  if to_regclass('public.audit_events') is null then
    execute $view$
      create view public.audit_events
      with (security_invoker = true)
      as
      select * from public.v10_audit_events;
    $view$;
    execute $grant$revoke all on table public.audit_events from public;$grant$;
    execute $grant$grant select on table public.audit_events to authenticated;$grant$;
    execute $grant$grant select on table public.audit_events to service_role;$grant$;
  elsif exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'audit_events'
      and c.relkind = 'v'
  ) then
    execute $view$
      create or replace view public.audit_events
      with (security_invoker = true)
      as
      select * from public.v10_audit_events;
    $view$;
    execute $grant$revoke all on table public.audit_events from public;$grant$;
    execute $grant$grant select on table public.audit_events to authenticated;$grant$;
    execute $grant$grant select on table public.audit_events to service_role;$grant$;
  else
    raise notice 'Skipping public.audit_events neutral view alias because the relation already exists and is not a view.';
  end if;
end $$;

create or replace view public.command_search_index
with (security_invoker = true)
as
select * from public.v10_command_search_index;

revoke all on table public.command_search_index from public;
grant select on table public.command_search_index to authenticated;
grant select on table public.command_search_index to service_role;

create or replace view public.contract_activity_events
with (security_invoker = true)
as
select * from public.v10_contract_activity_events;

revoke all on table public.contract_activity_events from public;
grant select on table public.contract_activity_events to authenticated;
grant select on table public.contract_activity_events to service_role;

create or replace view public.contract_health_snapshots
with (security_invoker = true)
as
select * from public.v10_contract_health_snapshots;

revoke all on table public.contract_health_snapshots from public;
grant select on table public.contract_health_snapshots to authenticated;
grant select on table public.contract_health_snapshots to service_role;

create or replace view public.denominator_locks
with (security_invoker = true)
as
select * from public.v10_denominator_locks;

revoke all on table public.denominator_locks from public;
grant select on table public.denominator_locks to authenticated;
grant select on table public.denominator_locks to service_role;

create or replace view public.evidence_request_statuses
with (security_invoker = true)
as
select * from public.v10_evidence_request_statuses;

revoke all on table public.evidence_request_statuses from public;
grant select on table public.evidence_request_statuses to authenticated;
grant select on table public.evidence_request_statuses to service_role;

create or replace view public.exception_records
with (security_invoker = true)
as
select * from public.v10_exception_records;

revoke all on table public.exception_records from public;
grant select on table public.exception_records to authenticated;
grant select on table public.exception_records to service_role;

create or replace view public.external_blocker_records
with (security_invoker = true)
as
select * from public.v10_external_blocker_records;

revoke all on table public.external_blocker_records from public;
grant select on table public.external_blocker_records to authenticated;
grant select on table public.external_blocker_records to service_role;

create or replace view public.external_evidence_submissions
with (security_invoker = true)
as
select * from public.v10_external_evidence_submissions;

revoke all on table public.external_evidence_submissions from public;
grant select on table public.external_evidence_submissions to authenticated;
grant select on table public.external_evidence_submissions to service_role;

create or replace view public.field_provenance_records
with (security_invoker = true)
as
select * from public.v10_field_provenance_records;

revoke all on table public.field_provenance_records from public;
grant select on table public.field_provenance_records to authenticated;
grant select on table public.field_provenance_records to service_role;

create or replace view public.fixture_manifests
with (security_invoker = true)
as
select * from public.v10_fixture_manifests;

revoke all on table public.fixture_manifests from public;
grant select on table public.fixture_manifests to authenticated;
grant select on table public.fixture_manifests to service_role;

create or replace view public.fixture_teardown_records
with (security_invoker = true)
as
select * from public.v10_fixture_teardown_records;

revoke all on table public.fixture_teardown_records from public;
grant select on table public.fixture_teardown_records to authenticated;
grant select on table public.fixture_teardown_records to service_role;

create or replace view public.job_run_visibility
with (security_invoker = true)
as
select * from public.v10_job_run_visibility;

revoke all on table public.job_run_visibility from public;
grant select on table public.job_run_visibility to authenticated;
grant select on table public.job_run_visibility to service_role;

create or replace view public.metric_runs
with (security_invoker = true)
as
select * from public.v10_metric_runs;

revoke all on table public.metric_runs from public;
grant select on table public.metric_runs to authenticated;
grant select on table public.metric_runs to service_role;

create or replace view public.mutation_idempotency
with (security_invoker = true)
as
select * from public.v10_mutation_idempotency;

revoke all on table public.mutation_idempotency from public;
grant select on table public.mutation_idempotency to service_role;

do $$
begin
  if to_regclass('public.notification_deliveries') is null then
    execute $view$
      create view public.notification_deliveries
      with (security_invoker = true)
      as
      select * from public.v10_notification_deliveries;
    $view$;
    execute $grant$revoke all on table public.notification_deliveries from public;$grant$;
    execute $grant$grant select on table public.notification_deliveries to authenticated;$grant$;
    execute $grant$grant select on table public.notification_deliveries to service_role;$grant$;
  elsif exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'notification_deliveries'
      and c.relkind = 'v'
  ) then
    execute $view$
      create or replace view public.notification_deliveries
      with (security_invoker = true)
      as
      select * from public.v10_notification_deliveries;
    $view$;
    execute $grant$revoke all on table public.notification_deliveries from public;$grant$;
    execute $grant$grant select on table public.notification_deliveries to authenticated;$grant$;
    execute $grant$grant select on table public.notification_deliveries to service_role;$grant$;
  else
    raise notice 'Skipping public.notification_deliveries neutral view alias because the relation already exists and is not a view.';
  end if;
end $$;

create or replace view public.obligation_records
with (security_invoker = true)
as
select * from public.v10_obligation_records;

revoke all on table public.obligation_records from public;
grant select on table public.obligation_records to authenticated;
grant select on table public.obligation_records to service_role;

create or replace view public.promotion_decisions
with (security_invoker = true)
as
select * from public.v10_promotion_decisions;

revoke all on table public.promotion_decisions from public;
grant select on table public.promotion_decisions to authenticated;
grant select on table public.promotion_decisions to service_role;

create or replace view public.read_model_lineage
with (security_invoker = true)
as
select * from public.v10_read_model_lineage;

revoke all on table public.read_model_lineage from public;
grant select on table public.read_model_lineage to authenticated;
grant select on table public.read_model_lineage to service_role;

create or replace view public.read_model_refresh_jobs
with (security_invoker = true)
as
select * from public.v10_read_model_refresh_jobs;

revoke all on table public.read_model_refresh_jobs from public;
grant select on table public.read_model_refresh_jobs to authenticated;
grant select on table public.read_model_refresh_jobs to service_role;

create or replace view public.read_model_rows
with (security_invoker = true)
as
select * from public.v10_read_model_rows;

revoke all on table public.read_model_rows from public;
grant select on table public.read_model_rows to authenticated;
grant select on table public.read_model_rows to service_role;

create or replace view public.release_evidence_records
with (security_invoker = true)
as
select * from public.v10_release_evidence_records;

revoke all on table public.release_evidence_records from public;
grant select on table public.release_evidence_records to authenticated;
grant select on table public.release_evidence_records to service_role;

create or replace view public.release_waivers
with (security_invoker = true)
as
select * from public.v10_release_waivers;

revoke all on table public.release_waivers from public;
grant select on table public.release_waivers to authenticated;
grant select on table public.release_waivers to service_role;

create or replace view public.renewal_checkpoint_records
with (security_invoker = true)
as
select * from public.v10_renewal_checkpoint_records;

revoke all on table public.renewal_checkpoint_records from public;
grant select on table public.renewal_checkpoint_records to authenticated;
grant select on table public.renewal_checkpoint_records to service_role;

create or replace view public.renewal_posture_snapshots
with (security_invoker = true)
as
select * from public.v10_renewal_posture_snapshots;

revoke all on table public.renewal_posture_snapshots from public;
grant select on table public.renewal_posture_snapshots to authenticated;
grant select on table public.renewal_posture_snapshots to service_role;

create or replace view public.report_run_visibility
with (security_invoker = true)
as
select * from public.v10_report_run_visibility;

revoke all on table public.report_run_visibility from public;
grant select on table public.report_run_visibility to authenticated;
grant select on table public.report_run_visibility to service_role;

create or replace view public.runtime_artifacts
with (security_invoker = true)
as
select * from public.v10_runtime_artifacts;

revoke all on table public.runtime_artifacts from public;
grant select on table public.runtime_artifacts to authenticated;
grant select on table public.runtime_artifacts to service_role;

create or replace view public.runtime_coverage_ledger
with (security_invoker = true)
as
select * from public.v10_runtime_coverage_ledger;

revoke all on table public.runtime_coverage_ledger from public;
grant select on table public.runtime_coverage_ledger to authenticated;
grant select on table public.runtime_coverage_ledger to service_role;

create or replace view public.verification_command_results
with (security_invoker = true)
as
select * from public.v10_verification_command_results;

revoke all on table public.verification_command_results from public;
grant select on table public.verification_command_results to authenticated;
grant select on table public.verification_command_results to service_role;

create or replace view public.work_items
with (security_invoker = true)
as
select * from public.v10_work_items;

revoke all on table public.work_items from public;
grant select on table public.work_items to authenticated;
grant select on table public.work_items to service_role;
