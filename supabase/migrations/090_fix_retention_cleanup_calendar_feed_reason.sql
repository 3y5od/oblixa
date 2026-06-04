-- Replace the code-owned transient cleanup RPC after removing an invalid
-- calendar_feeds.revoked_reason assignment. calendar_feeds tracks revocation
-- with active/revoked_at only; revoked_reason belongs to external_action_links.

create or replace function public.cleanup_code_owned_transient_data(retention_cutoff timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  cleanup_batch_size integer := 1000;
  import_rows_redacted integer := 0;
  extraction_jobs_redacted integer := 0;
  report_tracking_redacted integer := 0;
  external_links_redacted integer := 0;
  calendar_feeds_redacted integer := 0;
  oauth_states_deleted integer := 0;
  external_action_events_redacted integer := 0;
begin
  update public.contract_import_jobs
  set retention_expires_at = coalesce(retention_expires_at, coalesce(completed_at, updated_at, created_at) + interval '30 days')
  where id in (
    select id
    from public.contract_import_jobs
    where retention_expires_at is null
    order by created_at
    limit cleanup_batch_size
  );

  with candidates as (
    select id
    from public.contract_import_job_rows
    where coalesce(retention_expires_at, created_at + interval '30 days') < retention_cutoff
      and raw_payload_redacted_at is null
    order by created_at
    limit cleanup_batch_size
  )
  update public.contract_import_job_rows
  set
    retention_expires_at = coalesce(retention_expires_at, created_at + interval '30 days'),
    raw_payload = jsonb_build_object(
      'schema_version', 1,
      'raw_payload_minimized', true,
      'redacted_by', 'cleanup_code_owned_transient_data',
      'redacted_at', retention_cutoff
    ),
    raw_payload_redacted_at = retention_cutoff
  where id in (select id from candidates);
  get diagnostics import_rows_redacted = row_count;

  with candidates as (
    select id
    from public.contract_extraction_jobs
    where coalesce(retention_expires_at, coalesce(completed_at, updated_at, created_at) + interval '30 days') < retention_cutoff
      and transient_payload_redacted_at is null
    order by created_at
    limit cleanup_batch_size
  )
  update public.contract_extraction_jobs
  set
    retention_expires_at = coalesce(retention_expires_at, coalesce(completed_at, updated_at, created_at) + interval '30 days'),
    last_error = case when last_error is null then null else '[redacted]' end,
    transient_payload_redacted_at = retention_cutoff
  where id in (select id from candidates);
  get diagnostics extraction_jobs_redacted = row_count;

  with candidates as (
    select id
    from public.report_run_recipients
    where coalesce(tracking_retention_expires_at, created_at + interval '180 days') < retention_cutoff
      and tracking_redacted_at is null
    order by created_at
    limit cleanup_batch_size
  )
  update public.report_run_recipients
  set
    tracking_retention_expires_at = coalesce(tracking_retention_expires_at, created_at + interval '180 days'),
    last_clicked_url = null,
    engagement_token_hash = null,
    engagement_token_prefix = null,
    engagement_revoked_at = coalesce(engagement_revoked_at, retention_cutoff),
    tracking_redacted_at = retention_cutoff
  where id in (select id from candidates);
  get diagnostics report_tracking_redacted = row_count;

  with candidates as (
    select id
    from public.external_action_links
    where coalesce(retention_expires_at, expires_at + interval '30 days') < retention_cutoff
      and (token_hash is not null or token_prefix is not null or submitted_payload_json is not null)
    order by expires_at
    limit cleanup_batch_size
  )
  update public.external_action_links
  set
    retention_expires_at = coalesce(retention_expires_at, expires_at + interval '30 days'),
    token_hash = null,
    token_prefix = null,
    submitted_payload_json = case when submitted_payload_json is null then null else jsonb_build_object('redacted', true, 'redacted_by', 'cleanup_code_owned_transient_data') end,
    revoked_at = coalesce(revoked_at, retention_cutoff),
    revoked_reason = coalesce(revoked_reason, 'retention_cleanup')
  where id in (select id from candidates);
  get diagnostics external_links_redacted = row_count;

  with candidates as (
    select id
    from public.calendar_feeds
    where coalesce(retention_expires_at, coalesce(expires_at, revoked_at, last_accessed_at, created_at) + interval '30 days') < retention_cutoff
      and (token_hash is not null or token_prefix is not null or active = true)
    order by coalesce(expires_at, revoked_at, last_accessed_at, created_at)
    limit cleanup_batch_size
  )
  update public.calendar_feeds
  set
    retention_expires_at = coalesce(retention_expires_at, coalesce(expires_at, revoked_at, last_accessed_at, created_at) + interval '30 days'),
    token_hash = null,
    token_prefix = null,
    active = false,
    revoked_at = coalesce(revoked_at, retention_cutoff)
  where id in (select id from candidates);
  get diagnostics calendar_feeds_redacted = row_count;

  delete from public.integration_oauth_states
  where id in (
    select id
    from public.integration_oauth_states
    where expires_at < retention_cutoff - interval '7 days'
    order by expires_at
    limit cleanup_batch_size
  );
  get diagnostics oauth_states_deleted = row_count;

  with candidates as (
    select id
    from public.external_action_events
    where created_at < retention_cutoff - interval '365 days'
      and payload_redacted_at is null
      and payload_json <> '{}'::jsonb
    order by created_at
    limit cleanup_batch_size
  )
  update public.external_action_events
  set
    payload_json = jsonb_build_object('redacted', true, 'redacted_by', 'cleanup_code_owned_transient_data'),
    payload_redacted_at = retention_cutoff
  where id in (select id from candidates);
  get diagnostics external_action_events_redacted = row_count;

  return jsonb_build_object(
    'import_rows_redacted', import_rows_redacted,
    'extraction_jobs_redacted', extraction_jobs_redacted,
    'report_tracking_redacted', report_tracking_redacted,
    'external_links_redacted', external_links_redacted,
    'calendar_feeds_redacted', calendar_feeds_redacted,
    'oauth_states_deleted', oauth_states_deleted,
    'external_action_events_redacted', external_action_events_redacted
  );
end;
$$;

revoke all on function public.cleanup_code_owned_transient_data(timestamptz) from public;
grant execute on function public.cleanup_code_owned_transient_data(timestamptz) to service_role;
