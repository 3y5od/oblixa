-- V10 runtime contract foundation.
-- These tables do not replace existing V8/V9 product tables; they provide the
-- durable, queryable V10 read-model, audit, and idempotency contracts.

alter table public.organization_members
  drop constraint if exists organization_members_role_check;

alter table public.organization_members
  add constraint organization_members_role_check
  check (role in ('viewer', 'legal_reviewer', 'finance_reviewer', 'editor', 'ops_manager', 'manager', 'admin'));

create table if not exists public.v10_mutation_idempotency (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  mutation_name text not null,
  target_type text not null,
  target_id text not null,
  idempotency_key text not null,
  client_request_id text,
  request_hash text not null,
  response_json jsonb not null,
  claim_status text not null default 'completed'
    check (claim_status in ('in_progress', 'completed')),
  claimed_at timestamptz not null default now(),
  completed_at timestamptz,
  claim_expires_at timestamptz,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  unique (organization_id, actor_user_id, mutation_name, target_type, target_id, idempotency_key)
);

alter table public.v10_mutation_idempotency
  add column if not exists client_request_id text;
alter table public.v10_mutation_idempotency
  add column if not exists claim_status text not null default 'completed';
alter table public.v10_mutation_idempotency
  add column if not exists claimed_at timestamptz not null default now();
alter table public.v10_mutation_idempotency
  add column if not exists completed_at timestamptz;
alter table public.v10_mutation_idempotency
  add column if not exists claim_expires_at timestamptz;

alter table public.v10_mutation_idempotency
  drop constraint if exists v10_mutation_idempotency_claim_status_check;
alter table public.v10_mutation_idempotency
  add constraint v10_mutation_idempotency_claim_status_check
  check (claim_status in ('in_progress', 'completed'));

alter table public.v10_mutation_idempotency
  drop constraint if exists v10_mutation_idempotency_claim_timing_check;
alter table public.v10_mutation_idempotency
  add constraint v10_mutation_idempotency_claim_timing_check
  check (
    claim_expires_at is null
    or claim_expires_at >= claimed_at
  );

create index if not exists idx_v10_mutation_idempotency_lookup
  on public.v10_mutation_idempotency (organization_id, actor_user_id, mutation_name, target_type, target_id, idempotency_key);

create index if not exists idx_v10_mutation_idempotency_expiry
  on public.v10_mutation_idempotency (expires_at);

create index if not exists idx_v10_mutation_idempotency_client_request
  on public.v10_mutation_idempotency (organization_id, actor_user_id, client_request_id)
  where client_request_id is not null;

create index if not exists idx_v10_mutation_idempotency_in_progress
  on public.v10_mutation_idempotency (claim_status, claim_expires_at)
  where claim_status = 'in_progress';

create or replace function public.cleanup_expired_v10_mutation_idempotency(retention_cutoff timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.v10_mutation_idempotency
  where expires_at < retention_cutoff
    or (
      claim_status = 'in_progress'
      and claim_expires_at is not null
      and claim_expires_at < retention_cutoff
    );
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.cleanup_expired_v10_mutation_idempotency(timestamptz) from public;
grant execute on function public.cleanup_expired_v10_mutation_idempotency(timestamptz) to service_role;

create or replace function public.claim_v10_mutation_idempotency(
  p_organization_id uuid,
  p_actor_user_id uuid,
  p_mutation_name text,
  p_target_type text,
  p_target_id text,
  p_idempotency_key text,
  p_client_request_id text,
  p_request_hash text,
  p_pending_response_json jsonb,
  p_claim_expires_at timestamptz default (now() + interval '5 minutes')
)
returns table (
  claim_result text,
  request_hash text,
  response_json jsonb,
  claim_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_row public.v10_mutation_idempotency%rowtype;
begin
  insert into public.v10_mutation_idempotency (
    organization_id,
    actor_user_id,
    mutation_name,
    target_type,
    target_id,
    idempotency_key,
    client_request_id,
    request_hash,
    response_json,
    claim_status,
    claimed_at,
    claim_expires_at
  )
  values (
    p_organization_id,
    p_actor_user_id,
    p_mutation_name,
    p_target_type,
    p_target_id,
    p_idempotency_key,
    p_client_request_id,
    p_request_hash,
    p_pending_response_json,
    'in_progress',
    now(),
    p_claim_expires_at
  )
  on conflict (organization_id, actor_user_id, mutation_name, target_type, target_id, idempotency_key) do nothing
  returning * into existing_row;

  if found then
    return query select 'claimed'::text, existing_row.request_hash, existing_row.response_json, existing_row.claim_status;
    return;
  end if;

  select *
    into existing_row
  from public.v10_mutation_idempotency row
  where row.organization_id = p_organization_id
    and row.actor_user_id = p_actor_user_id
    and row.mutation_name = p_mutation_name
    and row.target_type = p_target_type
    and row.target_id = p_target_id
    and row.idempotency_key = p_idempotency_key;

  if not found then
    return query select 'missing_after_conflict'::text, p_request_hash, p_pending_response_json, 'in_progress'::text;
    return;
  end if;

  if existing_row.request_hash <> p_request_hash then
    return query select 'payload_conflict'::text, existing_row.request_hash, existing_row.response_json, existing_row.claim_status;
    return;
  end if;

  if existing_row.claim_status = 'completed' then
    return query select 'replay'::text, existing_row.request_hash, existing_row.response_json, existing_row.claim_status;
    return;
  end if;

  return query select 'in_progress'::text, existing_row.request_hash, existing_row.response_json, existing_row.claim_status;
end;
$$;

revoke all on function public.claim_v10_mutation_idempotency(uuid, uuid, text, text, text, text, text, text, jsonb, timestamptz) from public;
grant execute on function public.claim_v10_mutation_idempotency(uuid, uuid, text, text, text, text, text, text, jsonb, timestamptz) to service_role;

create or replace function public.complete_v10_mutation_idempotency(
  p_organization_id uuid,
  p_actor_user_id uuid,
  p_mutation_name text,
  p_target_type text,
  p_target_id text,
  p_idempotency_key text,
  p_request_hash text,
  p_response_json jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  update public.v10_mutation_idempotency row
  set response_json = p_response_json,
      claim_status = 'completed',
      completed_at = now(),
      claim_expires_at = null
  where row.organization_id = p_organization_id
    and row.actor_user_id = p_actor_user_id
    and row.mutation_name = p_mutation_name
    and row.target_type = p_target_type
    and row.target_id = p_target_id
    and row.idempotency_key = p_idempotency_key
    and row.request_hash = p_request_hash
    and row.claim_status = 'in_progress';
  get diagnostics updated_count = row_count;
  return updated_count = 1;
end;
$$;

revoke all on function public.complete_v10_mutation_idempotency(uuid, uuid, text, text, text, text, text, jsonb) from public;
grant execute on function public.complete_v10_mutation_idempotency(uuid, uuid, text, text, text, text, text, jsonb) to service_role;

create or replace function public.v10_role_rank(role_name text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case role_name
    when 'viewer' then 10
    when 'legal_reviewer' then 20
    when 'finance_reviewer' then 20
    when 'editor' then 30
    when 'ops_manager' then 40
    when 'manager' then 50
    when 'admin' then 60
    else 0
  end
$$;

revoke all on function public.v10_role_rank(text) from public;
grant execute on function public.v10_role_rank(text) to authenticated;
grant execute on function public.v10_role_rank(text) to service_role;

create or replace function public.v10_member_can_read(
  row_organization_id uuid,
  row_required_role_minimum text,
  row_visibility_state text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select row_visibility_state = 'visible'
    and exists (
      select 1
      from public.organization_members om
      where om.organization_id = row_organization_id
        and om.user_id = auth.uid()
        and public.v10_role_rank(om.role) >= public.v10_role_rank(coalesce(row_required_role_minimum, 'viewer'))
    )
$$;

revoke all on function public.v10_member_can_read(uuid, text, text) from public;
grant execute on function public.v10_member_can_read(uuid, text, text) to authenticated;
grant execute on function public.v10_member_can_read(uuid, text, text) to service_role;

create table if not exists public.v10_audit_events (
  audit_event_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_mode text not null default 'core',
  required_role_minimum text not null default 'viewer',
  feature_family text not null default 'audit',
  visibility_state text not null default 'visible'
    check (visibility_state in ('visible', 'hidden_by_mode', 'hidden_by_role', 'hidden_by_plan', 'hidden_by_module', 'deleted', 'archived')),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_type text not null check (actor_type in ('user', 'system', 'external')) default 'user',
  action text not null,
  target_type text not null,
  target_id text not null,
  contract_id uuid references public.contracts(id) on delete set null,
  outcome text not null,
  before_state_hash text,
  after_state_hash text,
  safe_metadata jsonb not null default '{}'::jsonb,
  diagnostic_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_v10_audit_events_org_created
  on public.v10_audit_events (organization_id, created_at desc);

create index if not exists idx_v10_audit_events_org_action_created
  on public.v10_audit_events (organization_id, action, created_at desc);

create index if not exists idx_v10_audit_events_target
  on public.v10_audit_events (organization_id, target_type, target_id, created_at desc);

create table if not exists public.v10_read_model_rows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_mode text not null default 'core',
  required_role_minimum text not null default 'viewer',
  feature_family text not null,
  source_table text not null,
  source_id text not null,
  model_key text not null,
  fields jsonb not null default '{}'::jsonb,
  visibility_state text not null default 'visible'
    check (visibility_state in ('visible', 'hidden_by_mode', 'hidden_by_role', 'hidden_by_plan', 'hidden_by_module', 'deleted', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  archived_at timestamptz,
  unique (organization_id, model_key, source_table, source_id)
);

create index if not exists idx_v10_read_model_rows_org_model
  on public.v10_read_model_rows (organization_id, model_key, updated_at desc);

create table if not exists public.v10_activation_state (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_mode text not null default 'core',
  required_role_minimum text not null default 'viewer',
  feature_family text not null default 'activation',
  source_table text not null default 'contracts',
  source_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  contract_id uuid references public.contracts(id) on delete cascade,
  state text not null,
  accepted_upload_at timestamptz,
  extraction_started_at timestamptz,
  extraction_completed_at timestamptz,
  required_fields_total integer not null default 0,
  required_fields_approved integer not null default 0,
  owner_state text not null default 'unassigned',
  first_generated_work_item_id text,
  first_generated_work_item_at timestamptz,
  blocked_reason text,
  next_action text not null default 'continue_activation',
  visibility_state text not null default 'visible',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  archived_at timestamptz
);

create index if not exists idx_v10_activation_state_org_contract
  on public.v10_activation_state (organization_id, contract_id);

create index if not exists idx_v10_activation_state_org_state
  on public.v10_activation_state (organization_id, state, updated_at desc);

create table if not exists public.v10_work_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_mode text not null default 'core',
  required_role_minimum text not null default 'viewer',
  feature_family text not null default 'work',
  source_table text not null,
  source_id text not null,
  type text not null,
  status text not null,
  title text not null,
  contract_id uuid references public.contracts(id) on delete set null,
  source_type text not null,
  owner_user_id uuid references auth.users(id) on delete set null,
  owner_state text not null default 'unassigned',
  due_at timestamptz,
  due_state text not null default 'none',
  priority text not null default 'normal',
  severity text not null default 'none',
  blocked_reason text,
  primary_action text not null,
  secondary_actions text[] not null default '{}',
  compatible_action_group text not null,
  last_state_change_at timestamptz not null default now(),
  last_state_change_actor_id uuid references auth.users(id) on delete set null,
  audit_event_id uuid,
  visibility_state text not null default 'visible',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  archived_at timestamptz
);

create unique index if not exists idx_v10_work_items_org_source_unique
  on public.v10_work_items (organization_id, source_table, source_id, type);

create index if not exists idx_v10_work_items_org_lens
  on public.v10_work_items (organization_id, owner_state, due_state, status, updated_at desc);

create index if not exists idx_v10_work_items_org_visibility_status
  on public.v10_work_items (organization_id, visibility_state, status, updated_at desc);

create index if not exists idx_v10_work_items_org_owner_status
  on public.v10_work_items (organization_id, owner_user_id, owner_state, status, updated_at desc);

create index if not exists idx_v10_work_items_org_due_status
  on public.v10_work_items (organization_id, due_state, due_at, status, updated_at desc);

create table if not exists public.v10_contract_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_mode text not null default 'core',
  required_role_minimum text not null default 'viewer',
  feature_family text not null default 'contracts',
  source_table text not null default 'contracts',
  source_id text not null,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  score integer not null check (score >= 0 and score <= 100),
  band text not null,
  deductions jsonb not null default '[]'::jsonb,
  next_action text not null,
  computed_at timestamptz not null default now(),
  stale_owner boolean not null default false,
  missing_required_field_count integer not null default 0,
  missing_critical_date_count integer not null default 0,
  overdue_work_count integer not null default 0,
  open_high_or_critical_exception_count integer not null default 0,
  outstanding_evidence_count integer not null default 0,
  failed_or_partial_job_count integer not null default 0,
  visibility_state text not null default 'visible',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  archived_at timestamptz
);

create index if not exists idx_v10_contract_health_org_contract
  on public.v10_contract_health_snapshots (organization_id, contract_id, computed_at desc);

create table if not exists public.v10_job_run_visibility (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_mode text not null default 'core',
  required_role_minimum text not null default 'viewer',
  feature_family text not null default 'jobs',
  source_table text not null,
  source_id text not null,
  job_id text not null,
  job_class text not null,
  status text not null,
  cancellation_state text not null default 'cancelable',
  source_type text not null,
  contract_id uuid references public.contracts(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  completed_count integer not null default 0,
  failed_count integer not null default 0,
  skipped_count integer not null default 0,
  retryable_count integer not null default 0,
  diagnostic_id text,
  failure_category text,
  user_visible_detail text not null default '',
  retry_action text,
  visibility_state text not null default 'visible',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  archived_at timestamptz,
  unique (organization_id, job_class, job_id)
);

create index if not exists idx_v10_job_visibility_org_status
  on public.v10_job_run_visibility (organization_id, status, updated_at desc);

create table if not exists public.v10_report_run_visibility (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_mode text not null default 'core',
  required_role_minimum text not null default 'viewer',
  feature_family text not null default 'reports',
  source_table text not null default 'report_runs',
  source_id text not null,
  report_run_id text not null,
  report_family text not null,
  source_filters_safe jsonb not null default '{}'::jsonb,
  initiated_by_user_id uuid references auth.users(id) on delete set null,
  schedule_id text,
  status text not null,
  started_at timestamptz,
  completed_at timestamptz,
  selected_row_count integer,
  generated_row_count integer,
  artifact_url text,
  delivery_destination_state text not null default 'not_requested',
  failure_category text,
  diagnostic_id text,
  retry_action text,
  visibility_state text not null default 'visible',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  archived_at timestamptz,
  unique (organization_id, report_run_id)
);

create index if not exists idx_v10_report_visibility_org_status
  on public.v10_report_run_visibility (organization_id, status, updated_at desc);

create table if not exists public.v10_command_search_index (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_mode text not null default 'core',
  required_role_minimum text not null default 'viewer',
  feature_family text not null,
  source_table text not null,
  source_id text not null,
  record_type text not null,
  record_id text not null,
  label text not null,
  description_safe text not null default '',
  href text not null,
  rank_terms_safe text[] not null default '{}',
  workspace_mode_minimum text not null default 'core',
  module_key text,
  plan_minimum text not null default 'core',
  visibility_state text not null default 'visible',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  archived_at timestamptz,
  unique (organization_id, record_type, record_id)
);

create index if not exists idx_v10_command_search_rank_terms
  on public.v10_command_search_index using gin (rank_terms_safe);

create index if not exists idx_v10_command_search_org_visibility
  on public.v10_command_search_index (organization_id, visibility_state, updated_at desc);

create table if not exists public.v10_contract_activity_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_mode text not null default 'core',
  required_role_minimum text not null default 'viewer',
  feature_family text not null default 'audit',
  source_table text not null default 'v10_audit_events',
  source_id text not null,
  contract_id uuid references public.contracts(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_display text not null default 'system',
  action text not null,
  target_type text not null,
  target_id text not null,
  outcome text not null,
  safe_summary text not null,
  metadata_safe jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  visibility_state text not null default 'visible',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  archived_at timestamptz,
  unique (organization_id, source_table, source_id)
);

create table if not exists public.v10_field_provenance_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_mode text not null default 'core',
  required_role_minimum text not null default 'viewer',
  feature_family text not null default 'review',
  source_table text not null default 'extracted_fields',
  source_id text not null,
  contract_id uuid references public.contracts(id) on delete cascade,
  field_key text not null,
  current_value_display text not null,
  value_hash text,
  state text not null,
  source_label text not null,
  source_file_id text,
  confidence_state text not null default 'none',
  reviewer_user_id uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  last_modified_actor_id uuid references auth.users(id) on delete set null,
  last_modified_at timestamptz not null default now(),
  visibility_state text not null default 'visible',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  archived_at timestamptz,
  unique (organization_id, source_table, source_id)
);

create table if not exists public.v10_renewal_posture_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_mode text not null default 'core',
  required_role_minimum text not null default 'viewer',
  feature_family text not null default 'renewals',
  source_table text not null default 'contracts',
  source_id text not null,
  contract_id uuid references public.contracts(id) on delete cascade,
  posture text not null,
  horizon text,
  approved_end_date text,
  approved_renewal_date text,
  approved_notice_deadline text,
  reminder_eligible boolean not null default false,
  blocked_reason text,
  next_checkpoint_work_item_id text,
  computed_at timestamptz not null default now(),
  visibility_state text not null default 'visible',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  archived_at timestamptz,
  unique (organization_id, contract_id)
);

create index if not exists idx_v10_renewal_posture_org_posture
  on public.v10_renewal_posture_snapshots (organization_id, posture, computed_at desc);

create table if not exists public.v10_evidence_request_statuses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_mode text not null default 'core',
  required_role_minimum text not null default 'viewer',
  feature_family text not null default 'evidence',
  source_table text not null default 'evidence_requirements',
  source_id text not null,
  evidence_request_id uuid not null,
  contract_id uuid references public.contracts(id) on delete set null,
  requester_user_id uuid references auth.users(id) on delete set null,
  external_responder_state text not null default 'not_provided',
  due_at timestamptz,
  status text not null,
  submission_count integer not null default 0,
  latest_submission_at timestamptz,
  reviewer_user_id uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  resubmission_allowed boolean not null default false,
  external_link_state text not null default 'not_created',
  audit_event_ids text[] not null default '{}',
  visibility_state text not null default 'visible',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  archived_at timestamptz,
  unique (organization_id, evidence_request_id)
);

create index if not exists idx_v10_evidence_status_org_due
  on public.v10_evidence_request_statuses (organization_id, status, due_at);

create table if not exists public.v10_obligation_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_mode text not null default 'core',
  required_role_minimum text not null default 'viewer',
  feature_family text not null default 'obligations',
  source_table text not null default 'contract_obligations',
  source_id text not null,
  obligation_id uuid not null,
  contract_id uuid references public.contracts(id) on delete cascade,
  title text not null,
  owner_user_id uuid references auth.users(id) on delete set null,
  owner_state text not null,
  status text not null,
  due_at timestamptz,
  due_state text not null default 'none',
  source_field_key text,
  source_clause_hash text,
  evidence_required boolean not null default false,
  evidence_request_ids text[] not null default '{}',
  linked_exception_ids text[] not null default '{}',
  last_activity_at timestamptz,
  audit_event_ids text[] not null default '{}',
  visibility_state text not null default 'visible',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  archived_at timestamptz,
  unique (organization_id, obligation_id)
);

create table if not exists public.v10_approval_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_mode text not null default 'core',
  required_role_minimum text not null default 'viewer',
  feature_family text not null default 'approvals',
  source_table text not null default 'contract_approvals',
  source_id text not null,
  approval_id uuid not null,
  contract_id uuid references public.contracts(id) on delete cascade,
  approval_type text not null,
  requester_user_id uuid references auth.users(id) on delete set null,
  approver_user_id uuid references auth.users(id) on delete set null,
  delegated_approver_user_id uuid references auth.users(id) on delete set null,
  status text not null,
  due_at timestamptz,
  due_state text not null default 'none',
  sla_state text not null,
  decision_note_state text not null default 'not_provided',
  decided_at timestamptz,
  linked_decision_id text,
  audit_event_ids text[] not null default '{}',
  visibility_state text not null default 'visible',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  archived_at timestamptz,
  unique (organization_id, approval_id)
);

create index if not exists idx_v10_approval_records_org_due
  on public.v10_approval_records (organization_id, status, due_at);

create table if not exists public.v10_exception_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_mode text not null default 'core',
  required_role_minimum text not null default 'viewer',
  feature_family text not null default 'exceptions',
  source_table text not null default 'exceptions',
  source_id text not null,
  exception_id uuid not null,
  contract_id uuid references public.contracts(id) on delete cascade,
  title text not null,
  severity text not null,
  owner_user_id uuid references auth.users(id) on delete set null,
  owner_state text not null,
  status text not null,
  root_cause text,
  due_at timestamptz,
  due_state text not null default 'none',
  source_type text not null default 'exception',
  linked_source_id text,
  resolution_action text,
  resolved_at timestamptz,
  reopened_at timestamptz,
  linked_task_ids text[] not null default '{}',
  linked_evidence_request_ids text[] not null default '{}',
  linked_approval_id text,
  linked_decision_id text,
  audit_event_ids text[] not null default '{}',
  visibility_state text not null default 'visible',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  archived_at timestamptz,
  unique (organization_id, exception_id)
);

create index if not exists idx_v10_exception_records_org_severity
  on public.v10_exception_records (organization_id, status, severity, due_at);

create table if not exists public.v10_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_mode text not null default 'core',
  required_role_minimum text not null default 'viewer',
  feature_family text not null default 'notifications',
  source_table text not null default 'notification_deliveries',
  source_id text not null,
  notification_id uuid not null,
  notification_class text not null,
  recipient_user_id uuid references auth.users(id) on delete set null,
  recipient_channel text not null,
  source_type text not null,
  linked_source_id text not null,
  contract_id uuid references public.contracts(id) on delete set null,
  eligibility_state text not null default 'eligible',
  preference_state text not null default 'enabled',
  scheduled_at timestamptz,
  sent_at timestamptz,
  delivery_status text not null,
  failure_category text,
  diagnostic_id text,
  deep_link_href text,
  audit_event_id uuid,
  visibility_state text not null default 'visible',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  archived_at timestamptz,
  unique (organization_id, notification_id)
);

create index if not exists idx_v10_notification_deliveries_org_status
  on public.v10_notification_deliveries (organization_id, delivery_status, scheduled_at);

create table if not exists public.v10_renewal_checkpoint_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_mode text not null default 'core',
  required_role_minimum text not null default 'viewer',
  feature_family text not null default 'renewals',
  source_table text not null default 'contract_renewal_checkpoints',
  source_id text not null,
  renewal_checkpoint_id uuid not null,
  contract_id uuid references public.contracts(id) on delete cascade,
  checkpoint_type text not null,
  owner_user_id uuid references auth.users(id) on delete set null,
  owner_state text not null,
  status text not null,
  due_at timestamptz,
  due_state text not null default 'none',
  approved_notice_deadline text,
  approved_renewal_date text,
  posture_before text,
  posture_after text,
  reminder_eligible boolean not null default false,
  blocked_reason text,
  audit_event_ids text[] not null default '{}',
  visibility_state text not null default 'visible',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  archived_at timestamptz,
  unique (organization_id, renewal_checkpoint_id)
);

create index if not exists idx_v10_renewal_checkpoints_org_due
  on public.v10_renewal_checkpoint_records (organization_id, status, due_at);

create table if not exists public.v10_external_evidence_submissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_mode text not null default 'core',
  required_role_minimum text not null default 'viewer',
  feature_family text not null default 'evidence',
  source_table text not null default 'evidence_submissions',
  source_id text not null,
  submission_id uuid not null,
  evidence_request_id uuid not null,
  contract_id uuid references public.contracts(id) on delete set null,
  external_link_id text,
  submitter_name_state text not null default 'not_provided',
  submitter_email_state text not null default 'not_provided',
  submitted_at timestamptz,
  file_count integer not null default 0,
  file_type_summary text not null default 'none',
  note_state text not null default 'not_provided',
  upload_status text not null,
  review_status text not null,
  reviewer_user_id uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  audit_event_ids text[] not null default '{}',
  visibility_state text not null default 'visible',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  archived_at timestamptz,
  unique (organization_id, submission_id)
);

create index if not exists idx_v10_external_evidence_org_request
  on public.v10_external_evidence_submissions (organization_id, evidence_request_id, submitted_at desc);

create table if not exists public.v10_release_evidence_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  evidence_key text not null,
  evidence_kind text not null,
  release_state text not null,
  owner text not null,
  evidence_url text,
  denominator_lock_id text,
  fixed_sample_size integer,
  promotion_rule text not null default 'release_owner_promotion_required',
  captured_at timestamptz,
  expires_at timestamptz,
  status text not null default 'draft',
  pending_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, evidence_key, release_state)
);

alter table public.v10_release_evidence_records
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists denominator_lock_id text,
  add column if not exists fixed_sample_size integer,
  add column if not exists promotion_rule text not null default 'release_owner_promotion_required';

alter table public.v10_release_evidence_records
  alter column organization_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.v10_release_evidence_records'::regclass
      and c.contype in ('p', 'u')
      and c.conkey = array[
        (select attnum from pg_attribute where attrelid = 'public.v10_release_evidence_records'::regclass and attname = 'organization_id'),
        (select attnum from pg_attribute where attrelid = 'public.v10_release_evidence_records'::regclass and attname = 'evidence_key'),
        (select attnum from pg_attribute where attrelid = 'public.v10_release_evidence_records'::regclass and attname = 'release_state')
      ]::smallint[]
  ) then
    create unique index if not exists idx_v10_release_evidence_records_org_key_state
      on public.v10_release_evidence_records (organization_id, evidence_key, release_state);
  end if;
end
$$;

alter table public.v10_release_evidence_records
  drop constraint if exists v10_release_evidence_records_promotion_check;
alter table public.v10_release_evidence_records
  add constraint v10_release_evidence_records_promotion_check
  check (
    (fixed_sample_size is null or fixed_sample_size >= 0)
    and promotion_rule <> ''
    and (
      status not in ('promoted', 'accepted', 'verified')
      or captured_at is not null
    )
  );

create table if not exists public.v10_fixture_manifests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  fixture_id text not null,
  fixture_version text not null,
  spec_version text not null default 'v10',
  category text not null,
  generated_data_only boolean not null default true,
  source_counts jsonb not null default '{}'::jsonb,
  denominator_locks jsonb not null default '{}'::jsonb,
  privacy_scan_status text not null default 'pending',
  teardown_status text not null default 'pending',
  promoted_evidence_protected boolean not null default true,
  created_by text not null default 'release',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, fixture_version, category)
);

alter table public.v10_fixture_manifests
  drop constraint if exists v10_fixture_manifests_status_check;
alter table public.v10_fixture_manifests
  add constraint v10_fixture_manifests_status_check
  check (
    spec_version = 'v10'
    and category <> ''
    and jsonb_typeof(source_counts) = 'object'
    and jsonb_typeof(denominator_locks) = 'object'
    and privacy_scan_status in ('pending', 'passed', 'failed')
    and teardown_status in ('pending', 'succeeded', 'failed', 'preserved_promoted_evidence')
    and generated_data_only
    and promoted_evidence_protected
  );

create index if not exists idx_v10_fixture_manifests_org_category
  on public.v10_fixture_manifests (organization_id, category, updated_at desc);

create table if not exists public.v10_denominator_locks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lock_id text not null,
  metric_key text not null,
  fixture_version text not null,
  fixed_sample_size integer not null,
  denominator_count integer not null,
  exclusion_policy text not null,
  locked_by text not null default 'release',
  locked_at timestamptz not null default now(),
  status text not null default 'locked',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, lock_id)
);

alter table public.v10_denominator_locks
  drop constraint if exists v10_denominator_locks_status_check;
alter table public.v10_denominator_locks
  add constraint v10_denominator_locks_status_check
  check (
    fixed_sample_size > 0
    and denominator_count = fixed_sample_size
    and exclusion_policy <> ''
    and status in ('locked', 'superseded', 'invalid')
    and jsonb_typeof(metadata) = 'object'
  );

create index if not exists idx_v10_denominator_locks_org_metric
  on public.v10_denominator_locks (organization_id, metric_key, status, locked_at desc);

create table if not exists public.v10_metric_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  metric_key text not null,
  release_state text not null,
  denominator_lock_id text not null,
  fixed_sample_size integer not null,
  pass_count integer not null default 0,
  fail_count integer not null default 0,
  excluded_count integer not null default 0,
  exclusion_reasons text[] not null default '{}',
  runtime_source text not null default 'release_candidate_workspace',
  evidence_key text not null,
  status text not null default 'candidate',
  generated_at timestamptz not null default now(),
  promoted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, metric_key, release_state, denominator_lock_id)
);

alter table public.v10_metric_runs
  drop constraint if exists v10_metric_runs_accounting_check;
alter table public.v10_metric_runs
  add constraint v10_metric_runs_accounting_check
  check (
    release_state in ('beta', 'GA', 'complete')
    and fixed_sample_size > 0
    and pass_count >= 0
    and fail_count >= 0
    and excluded_count >= 0
    and pass_count + fail_count + excluded_count = fixed_sample_size
    and evidence_key like 'v10-release:%'
    and status in ('draft', 'candidate', 'promoted', 'stale', 'invalid', 'historical', 'release_check_required')
    and (status <> 'promoted' or promoted_at is not null)
    and jsonb_typeof(metadata) = 'object'
  );

create index if not exists idx_v10_metric_runs_org_metric_state
  on public.v10_metric_runs (organization_id, metric_key, release_state, status, generated_at desc);

create table if not exists public.v10_promotion_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  decision_key text not null,
  release_state text not null,
  decision text not null,
  owner text not null,
  decided_at timestamptz,
  evidence_keys text[] not null default '{}',
  unresolved_blockers text[] not null default '{}',
  denominator_locks text[] not null default '{}',
  rollback_ready boolean not null default false,
  post_ga_dashboard_refs text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, decision_key)
);

alter table public.v10_promotion_decisions
  drop constraint if exists v10_promotion_decisions_check;
alter table public.v10_promotion_decisions
  add constraint v10_promotion_decisions_check
  check (
    release_state in ('beta', 'GA', 'complete')
    and decision in ('blocked', 'promoted')
    and owner <> ''
    and cardinality(evidence_keys) > 0
    and cardinality(denominator_locks) > 0
    and (decision <> 'promoted' or (decided_at is not null and rollback_ready and cardinality(unresolved_blockers) = 0))
    and jsonb_typeof(metadata) = 'object'
  );

create index if not exists idx_v10_promotion_decisions_org_state
  on public.v10_promotion_decisions (organization_id, release_state, decision, updated_at desc);

create table if not exists public.v10_release_waivers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  waiver_key text not null,
  release_state text not null,
  waived_evidence_key text not null,
  approver text not null,
  reason text not null,
  expires_at timestamptz not null,
  status text not null default 'active',
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, waiver_key)
);

alter table public.v10_release_waivers
  drop constraint if exists v10_release_waivers_check;
alter table public.v10_release_waivers
  add constraint v10_release_waivers_check
  check (
    release_state in ('beta', 'GA', 'complete')
    and waived_evidence_key like 'v10-release:%'
    and approver <> ''
    and reason <> ''
    and expires_at > created_at
    and status in ('active', 'expired', 'revoked')
    and (status <> 'revoked' or revoked_at is not null)
    and jsonb_typeof(metadata) = 'object'
  );

create index if not exists idx_v10_release_waivers_org_status
  on public.v10_release_waivers (organization_id, status, expires_at);

create table if not exists public.v10_verification_command_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  command text not null,
  required_for text not null,
  status text not null,
  output_summary text,
  prerequisite text,
  blocker_reason text,
  evidence_key text,
  captured_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, command, captured_at)
);

alter table public.v10_verification_command_results
  drop constraint if exists v10_verification_command_results_status_check;
alter table public.v10_verification_command_results
  add constraint v10_verification_command_results_status_check
  check (
    command <> ''
    and required_for in ('focused_v10', 'migration', 'type_lint', 'logic_regression', 'coverage', 'e2e', 'broad_verify')
    and status in ('passed', 'failed', 'skipped', 'unavailable')
    and (
      (status = 'passed' and output_summary is not null and evidence_key is not null)
      or (status = 'failed' and output_summary is not null and blocker_reason is not null and evidence_key is not null)
      or (status in ('skipped', 'unavailable') and prerequisite is not null and blocker_reason is not null and evidence_key is not null)
    )
    and jsonb_typeof(metadata) = 'object'
  );

create index if not exists idx_v10_verification_command_results_org_status
  on public.v10_verification_command_results (organization_id, required_for, status, captured_at desc);

create table if not exists public.v10_external_blocker_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  blocker_key text not null,
  evidence_kind text not null,
  release_state text not null,
  owner text not null,
  status text not null default 'release_check_required',
  evidence_url text,
  captured_at timestamptz,
  expires_at timestamptz,
  blocker_reason text,
  mitigation text,
  waiver_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, blocker_key, release_state)
);

alter table public.v10_external_blocker_records
  drop constraint if exists v10_external_blocker_records_status_check;
alter table public.v10_external_blocker_records
  add constraint v10_external_blocker_records_status_check
  check (
    release_state in ('beta', 'GA', 'complete')
    and owner <> ''
    and status in ('release_check_required', 'candidate', 'promoted', 'stale', 'invalid', 'waived')
    and (status not in ('promoted', 'candidate') or captured_at is not null)
    and (evidence_url is null or evidence_url like 'https://%')
    and (status <> 'release_check_required' or blocker_reason is not null)
    and jsonb_typeof(metadata) = 'object'
  );

create index if not exists idx_v10_external_blocker_records_org_state
  on public.v10_external_blocker_records (organization_id, release_state, status, updated_at desc);

create table if not exists public.v10_fixture_teardown_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  fixture_version text not null,
  teardown_key text not null,
  status text not null,
  deleted_counts jsonb not null default '{}'::jsonb,
  preserved_evidence_keys text[] not null default '{}',
  diagnostic_id text,
  executed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, teardown_key)
);

alter table public.v10_fixture_teardown_records
  drop constraint if exists v10_fixture_teardown_records_status_check;
alter table public.v10_fixture_teardown_records
  add constraint v10_fixture_teardown_records_status_check
  check (
    fixture_version <> ''
    and status in ('pending', 'succeeded', 'failed', 'preserved_promoted_evidence')
    and jsonb_typeof(deleted_counts) = 'object'
    and (status <> 'failed' or diagnostic_id is not null)
    and jsonb_typeof(metadata) = 'object'
  );

create index if not exists idx_v10_fixture_teardown_records_org_status
  on public.v10_fixture_teardown_records (organization_id, status, executed_at desc);

create table if not exists public.v10_read_model_refresh_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  refresh_job_id text not null,
  refresh_reason text not null,
  refresh_scope text not null default 'full'
    check (refresh_scope in ('full', 'incremental', 'repair', 'dry_run', 'one_contract', 'one_model')),
  repair_mode text not null default 'replace_visible'
    check (repair_mode in ('replace_visible', 'incremental_upsert', 'dry_run')),
  status text not null default 'running'
    check (status in ('queued', 'running', 'succeeded', 'partial', 'failed_retryable', 'failed_terminal', 'canceled')),
  model_keys text[] not null default '{}',
  expected_source_tables text[] not null default '{}',
  source_counts jsonb not null default '{}'::jsonb,
  target_counts jsonb not null default '{}'::jsonb,
  failure_count integer not null default 0,
  failed_source_tables text[] not null default '{}',
  stale_source_tables text[] not null default '{}',
  drift_state text not null default 'fresh'
    check (drift_state in ('fresh', 'stale', 'partial', 'failed', 'missing')),
  diagnostic_id text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, refresh_job_id)
);

create index if not exists idx_v10_refresh_jobs_org_status
  on public.v10_read_model_refresh_jobs (organization_id, status, updated_at desc);

create index if not exists idx_v10_refresh_jobs_org_scope_drift
  on public.v10_read_model_refresh_jobs (organization_id, refresh_scope, drift_state, updated_at desc);

create or replace function public.cleanup_old_v10_read_model_refresh_jobs(retention_cutoff timestamptz default now() - interval '30 days')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.v10_read_model_refresh_jobs
  where completed_at is not null
    and completed_at < retention_cutoff
    and status in ('succeeded', 'partial', 'failed_terminal', 'failed_retryable', 'canceled');

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.cleanup_old_v10_read_model_refresh_jobs(timestamptz) from public;
grant execute on function public.cleanup_old_v10_read_model_refresh_jobs(timestamptz) to service_role;

create table if not exists public.v10_read_model_lineage (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_mode text not null default 'core',
  required_role_minimum text not null default 'admin',
  feature_family text not null default 'settings',
  refresh_job_id text not null,
  model_key text not null,
  read_model_table text not null,
  read_model_source_table text not null,
  read_model_source_id text not null,
  source_table text not null,
  source_id text not null,
  audit_event_id uuid,
  spec_requirement_id text,
  visibility_state text not null default 'visible'
    check (visibility_state in ('visible', 'hidden_by_mode', 'hidden_by_role', 'hidden_by_plan', 'hidden_by_module', 'deleted', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, refresh_job_id, model_key, read_model_source_table, read_model_source_id, source_table, source_id)
);

alter table public.v10_read_model_lineage
  add column if not exists workspace_mode text not null default 'core',
  add column if not exists required_role_minimum text not null default 'admin',
  add column if not exists feature_family text not null default 'settings',
  add column if not exists target_model text not null default 'unclassified';

create index if not exists idx_v10_lineage_org_model_source
  on public.v10_read_model_lineage (organization_id, model_key, source_table, source_id);

create table if not exists public.v10_runtime_artifacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_mode text not null default 'core',
  required_role_minimum text not null default 'admin',
  feature_family text not null default 'settings',
  artifact_key text not null,
  artifact_kind text not null
    check (artifact_kind in ('export', 'report', 'screenshot', 'trace', 'release_bundle', 'generated_fixture', 'support_diagnostic', 'signed_link')),
  source_type text not null,
  source_id text not null,
  checksum text,
  classification text not null default 'support_safe'
    check (classification in ('public_metadata', 'support_safe', 'customer_private', 'synthetic_release_evidence', 'prohibited')),
  access_scope text not null default 'organization'
    check (access_scope in ('organization', 'actor', 'external_token', 'service_role_only', 'release_owner')),
  evidence_key text,
  diagnostic_id text,
  href text,
  expires_at timestamptz,
  revoked_at timestamptz,
  visibility_state text not null default 'visible'
    check (visibility_state in ('visible', 'hidden_by_mode', 'hidden_by_role', 'hidden_by_plan', 'hidden_by_module', 'deleted', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, artifact_key)
);

alter table public.v10_runtime_artifacts
  add column if not exists workspace_mode text not null default 'core',
  add column if not exists required_role_minimum text not null default 'admin',
  add column if not exists feature_family text not null default 'settings';

alter table public.v10_runtime_artifacts
  drop constraint if exists v10_runtime_artifacts_retention_check;
alter table public.v10_runtime_artifacts
  add constraint v10_runtime_artifacts_retention_check
  check (
    (expires_at is null or expires_at >= created_at)
    and (
      classification <> 'prohibited'
      or visibility_state <> 'visible'
    )
  );

create index if not exists idx_v10_runtime_artifacts_org_kind
  on public.v10_runtime_artifacts (organization_id, artifact_kind, updated_at desc);

create or replace function public.cleanup_expired_v10_runtime_artifacts(retention_cutoff timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  archived_count integer;
begin
  update public.v10_runtime_artifacts
  set visibility_state = 'archived',
      revoked_at = coalesce(revoked_at, retention_cutoff),
      updated_at = retention_cutoff
  where expires_at is not null
    and expires_at < retention_cutoff
    and visibility_state = 'visible';
  get diagnostics archived_count = row_count;
  return archived_count;
end;
$$;

revoke all on function public.cleanup_expired_v10_runtime_artifacts(timestamptz) from public;
grant execute on function public.cleanup_expired_v10_runtime_artifacts(timestamptz) to service_role;

create table if not exists public.v10_runtime_coverage_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  coverage_key text not null,
  coverage_kind text not null
    check (coverage_kind in ('spec_section', 'acceptance_gate', 'route', 'mutation', 'read_model', 'telemetry_event', 'audit_action', 'fixture', 'report_family', 'job_class', 'notification_class', 'non_autonomous_blocker')),
  priority text not null check (priority in ('P0', 'P1', 'P2', 'release_blocker')),
  owner text not null,
  source_artifact text not null,
  source_table text,
  route_path text,
  mutation_name text,
  read_model_key text,
  telemetry_action text,
  audit_action text,
  fixture_key text,
  release_evidence_key text,
  blocker_key text,
  runtime_status text not null default 'contract_only'
    check (runtime_status in ('runtime_backed', 'contract_only', 'release_check_required', 'environment_gated', 'external_blocker')),
  test_status text not null default 'missing'
    check (test_status in ('unit', 'api', 'ui', 'e2e', 'release_check', 'missing')),
  freshness_state text not null default 'unknown'
    check (freshness_state in ('fresh', 'stale', 'partial', 'failed', 'missing', 'unknown')),
  rollback_path text,
  residual_risk text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (organization_id, coverage_kind, coverage_key)
);

create index if not exists idx_v10_runtime_coverage_org_kind_status
  on public.v10_runtime_coverage_ledger (organization_id, coverage_kind, runtime_status, updated_at desc);

create table if not exists public.v10_advanced_assurance_linked_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_mode text not null default 'advanced',
  required_role_minimum text not null default 'viewer',
  feature_family text not null,
  source_table text not null,
  source_id text not null,
  record_type text not null,
  record_id text not null,
  workspace_mode_minimum text not null check (workspace_mode_minimum in ('advanced', 'assurance')),
  status text not null,
  owner_user_id uuid references auth.users(id) on delete set null,
  source_contract_ids text[] not null default '{}',
  generated_work_item_ids text[] not null default '{}',
  command_search_record_id text,
  audit_event_ids text[] not null default '{}',
  visibility_state text not null default 'visible',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  archived_at timestamptz,
  unique (organization_id, record_type, record_id)
);

create index if not exists idx_v10_advanced_assurance_org_mode_status
  on public.v10_advanced_assurance_linked_records (organization_id, workspace_mode_minimum, status);

create unique index if not exists idx_v10_read_model_rows_org_model_source_upsert
  on public.v10_read_model_rows (organization_id, model_key, source_table, source_id);
create unique index if not exists idx_v10_activation_state_org_source_upsert
  on public.v10_activation_state (organization_id, source_table, source_id);
create unique index if not exists idx_v10_work_items_org_source_upsert
  on public.v10_work_items (organization_id, source_table, source_id, type);
create unique index if not exists idx_v10_contract_health_org_source_upsert
  on public.v10_contract_health_snapshots (organization_id, source_table, source_id);
create unique index if not exists idx_v10_contract_activity_org_source_upsert
  on public.v10_contract_activity_events (organization_id, source_table, source_id);
create unique index if not exists idx_v10_field_provenance_org_source_upsert
  on public.v10_field_provenance_records (organization_id, source_table, source_id);
create unique index if not exists idx_v10_renewal_posture_org_source_upsert
  on public.v10_renewal_posture_snapshots (organization_id, source_table, source_id);
create unique index if not exists idx_v10_evidence_status_org_source_upsert
  on public.v10_evidence_request_statuses (organization_id, source_table, source_id);
create unique index if not exists idx_v10_obligation_records_org_source_upsert
  on public.v10_obligation_records (organization_id, source_table, source_id);
create unique index if not exists idx_v10_approval_records_org_source_upsert
  on public.v10_approval_records (organization_id, source_table, source_id);
create unique index if not exists idx_v10_exception_records_org_source_upsert
  on public.v10_exception_records (organization_id, source_table, source_id);
create unique index if not exists idx_v10_notification_deliveries_org_source_upsert
  on public.v10_notification_deliveries (organization_id, source_table, source_id);
create unique index if not exists idx_v10_renewal_checkpoints_org_source_upsert
  on public.v10_renewal_checkpoint_records (organization_id, source_table, source_id);
create unique index if not exists idx_v10_external_evidence_org_source_upsert
  on public.v10_external_evidence_submissions (organization_id, source_table, source_id);
create unique index if not exists idx_v10_job_visibility_org_source_upsert
  on public.v10_job_run_visibility (organization_id, source_table, source_id);
create unique index if not exists idx_v10_report_visibility_org_source_upsert
  on public.v10_report_run_visibility (organization_id, source_table, source_id);
create unique index if not exists idx_v10_command_search_org_source_upsert
  on public.v10_command_search_index (organization_id, source_table, source_id);
create unique index if not exists idx_v10_advanced_assurance_org_source_upsert
  on public.v10_advanced_assurance_linked_records (organization_id, source_table, source_id);
create unique index if not exists idx_v10_refresh_jobs_org_source_upsert
  on public.v10_read_model_refresh_jobs (organization_id, refresh_job_id);
create unique index if not exists idx_v10_runtime_artifacts_org_key_upsert
  on public.v10_runtime_artifacts (organization_id, artifact_key);
create unique index if not exists idx_v10_runtime_coverage_org_key_upsert
  on public.v10_runtime_coverage_ledger (organization_id, coverage_kind, coverage_key);

create or replace function public.replace_v10_read_model_rows(
  p_table_name text,
  p_organization_id uuid,
  p_rows jsonb,
  p_identity_columns text[],
  p_archived_at timestamptz default now()
)
returns table (upserted_count integer, archived_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed_tables constant text[] := array[
    'v10_read_model_rows',
    'v10_work_items',
    'v10_contract_health_snapshots',
    'v10_activation_state',
    'v10_contract_activity_events',
    'v10_field_provenance_records',
    'v10_renewal_posture_snapshots',
    'v10_evidence_request_statuses',
    'v10_obligation_records',
    'v10_approval_records',
    'v10_exception_records',
    'v10_notification_deliveries',
    'v10_renewal_checkpoint_records',
    'v10_external_evidence_submissions',
    'v10_job_run_visibility',
    'v10_report_run_visibility',
    'v10_command_search_index',
    'v10_advanced_assurance_linked_records',
    'v10_read_model_lineage',
    'v10_runtime_artifacts',
    'v10_runtime_coverage_ledger'
  ];
  row_count_input integer := coalesce(jsonb_array_length(coalesce(p_rows, '[]'::jsonb)), 0);
  insert_columns text;
  select_columns text;
  conflict_columns text;
  update_set text;
  identity_predicate text;
  scope_predicate text;
  archive_scope_predicate text := 'true';
  sql text;
begin
  if p_table_name <> all (allowed_tables) then
    raise exception 'unsupported V10 read-model table: %', p_table_name;
  end if;

  if jsonb_typeof(coalesce(p_rows, '[]'::jsonb)) <> 'array' then
    raise exception 'p_rows must be a JSON array';
  end if;

  if coalesce(array_length(p_identity_columns, 1), 0) = 0 then
    raise exception 'p_identity_columns must not be empty';
  end if;

  if exists (
    select 1
    from unnest(p_identity_columns) as identity_column(column_name)
    left join information_schema.columns column_info
      on column_info.table_schema = 'public'
      and column_info.table_name = p_table_name
      and column_info.column_name = identity_column.column_name
    where column_info.column_name is null
  ) then
    raise exception 'identity column is not valid for table %', p_table_name;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) as incoming(row_json)
    where incoming.row_json->>'organization_id' is distinct from p_organization_id::text
  ) then
    raise exception 'replacement rows must all belong to organization %', p_organization_id;
  end if;

  select
    string_agg(format('%I', key), ', ' order by key),
    string_agg(format('incoming.%I', key), ', ' order by key)
    into insert_columns, select_columns
  from (
    select distinct key
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) as incoming(row_json)
    cross join jsonb_object_keys(incoming.row_json) as keys(key)
    join information_schema.columns column_info
      on column_info.table_schema = 'public'
      and column_info.table_name = p_table_name
      and column_info.column_name = keys.key
    where keys.key <> 'id'
  ) valid_columns;

  select string_agg(format('%I', column_name), ', ' order by ordinality)
    into conflict_columns
  from unnest(p_identity_columns) with ordinality as identity_column(column_name, ordinality);

  select string_agg(format('%1$I = excluded.%1$I', key), ', ' order by key)
    into update_set
  from (
    select distinct key
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) as incoming(row_json)
    cross join jsonb_object_keys(incoming.row_json) as keys(key)
    join information_schema.columns column_info
      on column_info.table_schema = 'public'
      and column_info.table_name = p_table_name
      and column_info.column_name = keys.key
    where keys.key <> 'id'
      and keys.key <> all (p_identity_columns)
  ) updatable_columns;

  if row_count_input > 0 then
    if insert_columns is null then
      raise exception 'no valid columns supplied for table %', p_table_name;
    end if;
    if update_set is null then
      sql := format(
        'insert into public.%1$I (%2$s) select %3$s from jsonb_populate_recordset(null::public.%1$I, $1) as incoming on conflict (%4$s) do nothing',
        p_table_name,
        insert_columns,
        select_columns,
        conflict_columns
      );
    else
      sql := format(
        'insert into public.%1$I (%2$s) select %3$s from jsonb_populate_recordset(null::public.%1$I, $1) as incoming on conflict (%4$s) do update set %5$s',
        p_table_name,
        insert_columns,
        select_columns,
        conflict_columns,
        update_set
      );
    end if;
    execute sql using p_rows;
    get diagnostics upserted_count = row_count;
  else
    upserted_count := 0;
  end if;

  select string_agg(
    format(
      'coalesce(identity_row.row_json->>%L, '''') = coalesce(target.%I::text, '''')',
      column_name,
      column_name
    ),
    ' and ' order by ordinality
  )
    into identity_predicate
  from unnest(p_identity_columns) with ordinality as identity_column(column_name, ordinality);

  if row_count_input = 0 then
    archived_count := 0;
    return next;
  end if;

  select string_agg(
    format('coalesce(scope_row.row_json->>%L, '''') = coalesce(target.%I::text, '''')', scope_column.column_name, scope_column.column_name),
    ' and ' order by scope_column.ordinality
  )
    into scope_predicate
  from unnest(array[
    'model_key',
    'contract_id',
    'source_table',
    'source_type',
    'job_class',
    'report_family',
    'record_type',
    'artifact_kind',
    'coverage_kind'
  ]) with ordinality as scope_column(column_name, ordinality)
  join information_schema.columns column_info
    on column_info.table_schema = 'public'
    and column_info.table_name = p_table_name
    and column_info.column_name = scope_column.column_name
  where (
    select count(*)
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) as incoming(row_json)
    where incoming.row_json ? scope_column.column_name
  ) = row_count_input
    and (
      select count(distinct incoming.row_json->>scope_column.column_name)
      from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) as incoming(row_json)
      where incoming.row_json ? scope_column.column_name
    ) = 1;

  if scope_predicate is not null then
    archive_scope_predicate := format(
      'exists (
          select 1
          from jsonb_array_elements($2) as scope_row(row_json)
          where %s
        )',
      scope_predicate
    );
  end if;

  sql := format(
    'update public.%1$I as target
      set visibility_state = ''archived'',
          archived_at = $3,
          updated_at = $3
      where target.organization_id = $1
        and target.visibility_state = ''visible''
        and %3$s
        and not exists (
          select 1
          from jsonb_array_elements($2) as identity_row(row_json)
          where %2$s
        )',
    p_table_name,
    identity_predicate,
    archive_scope_predicate
  );
  execute sql using p_organization_id, coalesce(p_rows, '[]'::jsonb), p_archived_at;
  get diagnostics archived_count = row_count;

  return next;
end;
$$;

revoke all on function public.replace_v10_read_model_rows(text, uuid, jsonb, text[], timestamptz) from public;
grant execute on function public.replace_v10_read_model_rows(text, uuid, jsonb, text[], timestamptz) to service_role;

-- V10 enum guardrails. The TypeScript catalogs are the authoring source, but
-- these constraints keep persisted read-model rows from drifting silently.
alter table public.v10_activation_state
  drop constraint if exists v10_activation_state_state_check;
alter table public.v10_activation_state
  add constraint v10_activation_state_state_check
  check (state in ('workspace_prepared', 'contract_uploaded_or_imported', 'extraction_queued', 'extraction_running', 'extraction_partially_complete', 'extraction_failed', 'required_field_review_ready', 'required_fields_approved', 'owner_assigned', 'first_work_item_generated', 'dashboard_updated'));

alter table public.v10_activation_state
  drop constraint if exists v10_activation_state_owner_state_check;
alter table public.v10_activation_state
  add constraint v10_activation_state_owner_state_check
  check (owner_state in ('assigned', 'unassigned', 'stale'));

alter table public.v10_work_items
  drop constraint if exists v10_work_items_type_check;
alter table public.v10_work_items
  add constraint v10_work_items_type_check
  check (type in ('field_review', 'contract_task', 'obligation', 'approval', 'renewal_checkpoint', 'exception', 'evidence_request', 'report_failure', 'export_failure', 'import_failure', 'extraction_failure', 'automation_approval', 'unassigned_work'));

alter table public.v10_work_items
  drop constraint if exists v10_work_items_status_check;
alter table public.v10_work_items
  add constraint v10_work_items_status_check
  check (status in ('open', 'in_progress', 'blocked', 'waiting', 'done', 'canceled'));

alter table public.v10_work_items
  drop constraint if exists v10_work_items_owner_due_priority_severity_check;
alter table public.v10_work_items
  add constraint v10_work_items_owner_due_priority_severity_check
  check (
    owner_state in ('assigned', 'unassigned', 'stale')
    and due_state in ('none', 'due_today', 'due_soon', 'overdue')
    and priority in ('none', 'low', 'normal', 'high', 'urgent')
    and severity in ('none', 'low', 'medium', 'high', 'critical')
  );

alter table public.v10_contract_health_snapshots
  drop constraint if exists v10_contract_health_band_check;
alter table public.v10_contract_health_snapshots
  add constraint v10_contract_health_band_check
  check (band in ('healthy', 'watch', 'at_risk', 'critical'));

alter table public.v10_job_run_visibility
  drop constraint if exists v10_job_run_visibility_enum_check;
alter table public.v10_job_run_visibility
  add constraint v10_job_run_visibility_enum_check
  check (
    job_class in ('contract_import', 'file_upload', 'extraction', 'export', 'report_generation', 'report_delivery', 'reminder_generation', 'notification_delivery', 'automation_execution', 'billing_sync')
    and status in ('queued', 'running', 'succeeded', 'partial', 'failed_retryable', 'failed_terminal', 'retrying', 'canceled')
    and cancellation_state in ('cancelable', 'not_cancelable', 'cancel_requested', 'canceled')
  );

alter table public.v10_report_run_visibility
  drop constraint if exists v10_report_run_visibility_enum_check;
alter table public.v10_report_run_visibility
  add constraint v10_report_run_visibility_enum_check
  check (
    report_family in ('contract_portfolio_summary', 'renewal_horizon_report', 'overdue_work_report', 'exception_report', 'evidence_status_report', 'approval_sla_report', 'data_quality_report', 'audit_activity_report', 'import_extraction_reliability_report', 'workspace_health_report')
    and status in ('queued', 'running', 'succeeded', 'partial', 'failed_retryable', 'failed_terminal', 'retrying', 'canceled')
  );

alter table public.v10_renewal_posture_snapshots
  drop constraint if exists v10_renewal_posture_snapshots_posture_check;
alter table public.v10_renewal_posture_snapshots
  add constraint v10_renewal_posture_snapshots_posture_check
  check (posture in ('no_approved_renewal_data', 'blocked_missing_approved_dates', 'no_renewal_action_required', 'monitor', 'plan', 'negotiate', 'notice_deadline_approaching', 'notice_overdue', 'renewal_overdue', 'completed'));

alter table public.v10_renewal_posture_snapshots
  drop constraint if exists v10_renewal_posture_snapshots_horizon_check;
alter table public.v10_renewal_posture_snapshots
  add constraint v10_renewal_posture_snapshots_horizon_check
  check (horizon is null or horizon in ('365_days', '180_days', '90_days', '60_days', '30_days', '14_days', '7_days', '1_day', 'overdue'));

alter table public.v10_field_provenance_records
  drop constraint if exists v10_field_provenance_records_enum_check;
alter table public.v10_field_provenance_records
  add constraint v10_field_provenance_records_enum_check
  check (
    state in ('extracted', 'approved', 'rejected', 'missing', 'ambiguous', 'user_supplied', 'stale_source')
    and confidence_state in ('none', 'low', 'medium', 'high')
  );

alter table public.v10_notification_deliveries
  drop constraint if exists v10_notification_deliveries_class_check;
alter table public.v10_notification_deliveries
  add constraint v10_notification_deliveries_class_check
  check (notification_class in ('due_work', 'overdue_work', 'pending_approval', 'renewal_horizon', 'notice_deadline', 'evidence_request', 'evidence_rejected', 'exception_assignment', 'review_backlog', 'failed_import', 'failed_extraction', 'failed_report', 'failed_export', 'automation_approval_required'));

alter table public.v10_command_search_index
  drop constraint if exists v10_command_search_index_plan_mode_check;
alter table public.v10_command_search_index
  add constraint v10_command_search_index_plan_mode_check
  check (
    workspace_mode_minimum in ('core', 'advanced', 'assurance')
    and plan_minimum in ('trial', 'core', 'advanced', 'assurance', 'enterprise')
  );

alter table public.v10_audit_events
  add column if not exists workspace_mode text not null default 'core',
  add column if not exists required_role_minimum text not null default 'viewer',
  add column if not exists feature_family text not null default 'audit',
  add column if not exists visibility_state text not null default 'visible';

alter table public.v10_audit_events
  drop constraint if exists v10_audit_events_outcome_check;
alter table public.v10_audit_events
  add constraint v10_audit_events_outcome_check
  check (outcome in ('success', 'validation_failed', 'unauthorized', 'forbidden', 'not_found', 'conflict', 'stale_version', 'plan_required', 'mode_required', 'hidden_module', 'rate_limited', 'dependency_blocked', 'job_not_retryable', 'external_link_expired', 'external_link_revoked', 'audit_write_failed', 'no_action', 'server_error'));

alter table public.v10_audit_events
  drop constraint if exists v10_audit_events_visibility_check;
alter table public.v10_audit_events
  add constraint v10_audit_events_visibility_check
  check (visibility_state in ('visible', 'hidden_by_mode', 'hidden_by_role', 'hidden_by_plan', 'hidden_by_module', 'deleted', 'archived'));

alter table public.v10_work_items
  drop constraint if exists v10_work_items_source_type_check;
alter table public.v10_work_items
  add constraint v10_work_items_source_type_check
  check (source_type in ('contract', 'work_item', 'field', 'obligation', 'approval', 'exception', 'evidence_request', 'external_evidence_submission', 'report_run', 'export_job', 'import_job', 'extraction_job', 'file_upload', 'automation_run', 'audit_event', 'notification_delivery', 'reminder', 'renewal_checkpoint', 'finding', 'control', 'campaign', 'decision', 'simulation', 'program', 'scorecard', 'playbook', 'review_board', 'health_graph', 'segment', 'program_evolution', 'account', 'counterparty', 'relationship', 'saved_view', 'setting', 'setting_destination', 'workspace_health_diagnostic', 'billing_sync', 'runtime_artifact'));

alter table public.v10_contract_activity_events
  drop constraint if exists v10_contract_activity_events_target_type_check;
alter table public.v10_contract_activity_events
  add constraint v10_contract_activity_events_target_type_check
  check (target_type in ('contract', 'work_item', 'field', 'obligation', 'approval', 'exception', 'evidence_request', 'external_evidence_submission', 'report_run', 'export_job', 'import_job', 'extraction_job', 'file_upload', 'automation_run', 'audit_event', 'notification_delivery', 'reminder', 'renewal_checkpoint', 'finding', 'control', 'campaign', 'decision', 'simulation', 'program', 'scorecard', 'playbook', 'review_board', 'health_graph', 'segment', 'program_evolution', 'account', 'counterparty', 'relationship', 'saved_view', 'setting', 'setting_destination', 'workspace_health_diagnostic', 'billing_sync', 'runtime_artifact'));

alter table public.v10_job_run_visibility
  drop constraint if exists v10_job_run_visibility_source_type_check;
alter table public.v10_job_run_visibility
  add constraint v10_job_run_visibility_source_type_check
  check (source_type in ('contract', 'work_item', 'field', 'obligation', 'approval', 'exception', 'evidence_request', 'external_evidence_submission', 'report_run', 'export_job', 'import_job', 'extraction_job', 'file_upload', 'automation_run', 'audit_event', 'notification_delivery', 'reminder', 'renewal_checkpoint', 'finding', 'control', 'campaign', 'decision', 'simulation', 'program', 'scorecard', 'playbook', 'review_board', 'health_graph', 'segment', 'program_evolution', 'account', 'counterparty', 'relationship', 'saved_view', 'setting', 'setting_destination', 'workspace_health_diagnostic', 'billing_sync', 'runtime_artifact'));

alter table public.v10_exception_records
  drop constraint if exists v10_exception_records_source_type_check;
alter table public.v10_exception_records
  add constraint v10_exception_records_source_type_check
  check (source_type in ('contract', 'work_item', 'field', 'obligation', 'approval', 'exception', 'evidence_request', 'external_evidence_submission', 'report_run', 'export_job', 'import_job', 'extraction_job', 'file_upload', 'automation_run', 'audit_event', 'notification_delivery', 'reminder', 'renewal_checkpoint', 'finding', 'control', 'campaign', 'decision', 'simulation', 'program', 'scorecard', 'playbook', 'review_board', 'health_graph', 'segment', 'program_evolution', 'account', 'counterparty', 'relationship', 'saved_view', 'setting', 'setting_destination', 'workspace_health_diagnostic', 'billing_sync', 'runtime_artifact'));

alter table public.v10_notification_deliveries
  drop constraint if exists v10_notification_deliveries_source_type_check;
alter table public.v10_notification_deliveries
  add constraint v10_notification_deliveries_source_type_check
  check (source_type in ('contract', 'work_item', 'field', 'obligation', 'approval', 'exception', 'evidence_request', 'external_evidence_submission', 'report_run', 'export_job', 'import_job', 'extraction_job', 'file_upload', 'automation_run', 'audit_event', 'notification_delivery', 'reminder', 'renewal_checkpoint', 'finding', 'control', 'campaign', 'decision', 'simulation', 'program', 'scorecard', 'playbook', 'review_board', 'health_graph', 'segment', 'program_evolution', 'account', 'counterparty', 'relationship', 'saved_view', 'setting', 'setting_destination', 'workspace_health_diagnostic', 'billing_sync', 'runtime_artifact'));

alter table public.v10_audit_events
  drop constraint if exists v10_audit_events_target_type_check;
alter table public.v10_audit_events
  add constraint v10_audit_events_target_type_check
  check (target_type in ('contract', 'work_item', 'field', 'obligation', 'approval', 'exception', 'evidence_request', 'external_evidence_submission', 'report_run', 'export_job', 'import_job', 'extraction_job', 'file_upload', 'automation_run', 'audit_event', 'notification_delivery', 'reminder', 'renewal_checkpoint', 'finding', 'control', 'campaign', 'decision', 'simulation', 'program', 'scorecard', 'playbook', 'review_board', 'health_graph', 'segment', 'program_evolution', 'account', 'counterparty', 'relationship', 'saved_view', 'setting', 'setting_destination', 'workspace_health_diagnostic', 'billing_sync', 'runtime_artifact'));

alter table public.v10_job_run_visibility
  drop constraint if exists v10_job_run_visibility_count_timing_diagnostic_check;
alter table public.v10_job_run_visibility
  add constraint v10_job_run_visibility_count_timing_diagnostic_check
  check (
    completed_count >= 0
    and failed_count >= 0
    and skipped_count >= 0
    and retryable_count >= 0
    and (started_at is null or completed_at is null or completed_at >= started_at)
    and (
      status not in ('partial', 'failed_retryable', 'failed_terminal')
      or diagnostic_id is not null
    )
  );

alter table public.v10_report_run_visibility
  drop constraint if exists v10_report_run_visibility_count_timing_diagnostic_check;
alter table public.v10_report_run_visibility
  add constraint v10_report_run_visibility_count_timing_diagnostic_check
  check (
    coalesce(selected_row_count, 0) >= 0
    and coalesce(generated_row_count, 0) >= 0
    and (started_at is null or completed_at is null or completed_at >= started_at)
    and (
      status not in ('partial', 'failed_retryable', 'failed_terminal')
      or diagnostic_id is not null
    )
  );

alter table public.v10_read_model_refresh_jobs
  drop constraint if exists v10_refresh_jobs_count_timing_check;
alter table public.v10_read_model_refresh_jobs
  add constraint v10_refresh_jobs_count_timing_check
  check (
    failure_count >= 0
    and (completed_at is null or completed_at >= started_at)
    and (
      status not in ('partial', 'failed_retryable', 'failed_terminal')
      or diagnostic_id is not null
    )
  );

alter table public.v10_read_model_refresh_jobs
  drop constraint if exists v10_read_model_refresh_jobs_scope_check;
alter table public.v10_read_model_refresh_jobs
  add constraint v10_read_model_refresh_jobs_scope_check
  check (
    refresh_scope in ('full', 'incremental', 'repair', 'dry_run', 'one_contract', 'one_model')
    and repair_mode in ('replace_visible', 'incremental_upsert', 'dry_run')
  );

alter table public.v10_read_model_refresh_jobs
  drop constraint if exists v10_read_model_refresh_jobs_drift_check;
alter table public.v10_read_model_refresh_jobs
  add constraint v10_read_model_refresh_jobs_drift_check
  check (
    drift_state in ('fresh', 'stale', 'partial', 'failed', 'missing')
    and (
      drift_state = 'fresh'
      or failure_count > 0
      or cardinality(failed_source_tables) > 0
      or cardinality(stale_source_tables) > 0
      or diagnostic_id is not null
    )
  );

alter table public.v10_mutation_idempotency enable row level security;
alter table public.v10_audit_events enable row level security;
alter table public.v10_read_model_rows enable row level security;
alter table public.v10_activation_state enable row level security;
alter table public.v10_work_items enable row level security;
alter table public.v10_contract_health_snapshots enable row level security;
alter table public.v10_contract_activity_events enable row level security;
alter table public.v10_field_provenance_records enable row level security;
alter table public.v10_renewal_posture_snapshots enable row level security;
alter table public.v10_evidence_request_statuses enable row level security;
alter table public.v10_obligation_records enable row level security;
alter table public.v10_approval_records enable row level security;
alter table public.v10_exception_records enable row level security;
alter table public.v10_notification_deliveries enable row level security;
alter table public.v10_renewal_checkpoint_records enable row level security;
alter table public.v10_external_evidence_submissions enable row level security;
alter table public.v10_job_run_visibility enable row level security;
alter table public.v10_report_run_visibility enable row level security;
alter table public.v10_command_search_index enable row level security;
alter table public.v10_release_evidence_records enable row level security;
alter table public.v10_fixture_manifests enable row level security;
alter table public.v10_denominator_locks enable row level security;
alter table public.v10_metric_runs enable row level security;
alter table public.v10_promotion_decisions enable row level security;
alter table public.v10_release_waivers enable row level security;
alter table public.v10_verification_command_results enable row level security;
alter table public.v10_external_blocker_records enable row level security;
alter table public.v10_fixture_teardown_records enable row level security;
alter table public.v10_read_model_refresh_jobs enable row level security;
alter table public.v10_read_model_lineage enable row level security;
alter table public.v10_runtime_artifacts enable row level security;
alter table public.v10_runtime_coverage_ledger enable row level security;
alter table public.v10_advanced_assurance_linked_records enable row level security;

drop policy if exists "No direct member access V10 mutation idempotency" on public.v10_mutation_idempotency;
drop policy if exists "Members can read V10 read models" on public.v10_read_model_rows;
drop policy if exists "Members can read V10 work items" on public.v10_work_items;
drop policy if exists "Members can read V10 command search" on public.v10_command_search_index;
drop policy if exists "Members can read V10 health" on public.v10_contract_health_snapshots;
drop policy if exists "Members can read V10 contract activity" on public.v10_contract_activity_events;
drop policy if exists "Members can read V10 field provenance" on public.v10_field_provenance_records;
drop policy if exists "Members can read V10 renewal posture" on public.v10_renewal_posture_snapshots;
drop policy if exists "Members can read V10 evidence statuses" on public.v10_evidence_request_statuses;
drop policy if exists "Members can read V10 obligation records" on public.v10_obligation_records;
drop policy if exists "Members can read V10 approval records" on public.v10_approval_records;
drop policy if exists "Members can read V10 exception records" on public.v10_exception_records;
drop policy if exists "Members can read V10 notification deliveries" on public.v10_notification_deliveries;
drop policy if exists "Members can read V10 renewal checkpoints" on public.v10_renewal_checkpoint_records;
drop policy if exists "Members can read V10 external evidence submissions" on public.v10_external_evidence_submissions;
drop policy if exists "Members can read V10 activation" on public.v10_activation_state;
drop policy if exists "Members can read V10 jobs" on public.v10_job_run_visibility;
drop policy if exists "Members can read V10 report runs" on public.v10_report_run_visibility;
drop policy if exists "Members can read V10 audit" on public.v10_audit_events;
drop policy if exists "Members can read V10 release evidence records" on public.v10_release_evidence_records;
drop policy if exists "Members can read V10 fixture manifests" on public.v10_fixture_manifests;
drop policy if exists "Members can read V10 denominator locks" on public.v10_denominator_locks;
drop policy if exists "Members can read V10 metric runs" on public.v10_metric_runs;
drop policy if exists "Members can read V10 promotion decisions" on public.v10_promotion_decisions;
drop policy if exists "Members can read V10 release waivers" on public.v10_release_waivers;
drop policy if exists "Members can read V10 verification command results" on public.v10_verification_command_results;
drop policy if exists "Members can read V10 external blocker records" on public.v10_external_blocker_records;
drop policy if exists "Members can read V10 fixture teardown records" on public.v10_fixture_teardown_records;
drop policy if exists "Members can read V10 refresh jobs" on public.v10_read_model_refresh_jobs;
drop policy if exists "Members can read V10 read model lineage" on public.v10_read_model_lineage;
drop policy if exists "Members can read V10 runtime artifacts" on public.v10_runtime_artifacts;
drop policy if exists "Members can read V10 runtime coverage ledger" on public.v10_runtime_coverage_ledger;
drop policy if exists "Members can read V10 advanced assurance linked records" on public.v10_advanced_assurance_linked_records;

create policy "No direct member access V10 mutation idempotency"
  on public.v10_mutation_idempotency for all
  using (false)
  with check (false);

create policy "Members can read V10 read models"
  on public.v10_read_model_rows for select
  using (public.v10_member_can_read(organization_id, required_role_minimum, visibility_state));

create policy "Members can read V10 work items"
  on public.v10_work_items for select
  using (public.v10_member_can_read(organization_id, required_role_minimum, visibility_state));

create policy "Members can read V10 command search"
  on public.v10_command_search_index for select
  using (public.v10_member_can_read(organization_id, required_role_minimum, visibility_state));

create policy "Members can read V10 health"
  on public.v10_contract_health_snapshots for select
  using (public.v10_member_can_read(organization_id, required_role_minimum, visibility_state));

create policy "Members can read V10 contract activity"
  on public.v10_contract_activity_events for select
  using (public.v10_member_can_read(organization_id, required_role_minimum, visibility_state));

create policy "Members can read V10 field provenance"
  on public.v10_field_provenance_records for select
  using (public.v10_member_can_read(organization_id, required_role_minimum, visibility_state));

create policy "Members can read V10 renewal posture"
  on public.v10_renewal_posture_snapshots for select
  using (public.v10_member_can_read(organization_id, required_role_minimum, visibility_state));

create policy "Members can read V10 evidence statuses"
  on public.v10_evidence_request_statuses for select
  using (public.v10_member_can_read(organization_id, required_role_minimum, visibility_state));

create policy "Members can read V10 obligation records"
  on public.v10_obligation_records for select
  using (public.v10_member_can_read(organization_id, required_role_minimum, visibility_state));

create policy "Members can read V10 approval records"
  on public.v10_approval_records for select
  using (public.v10_member_can_read(organization_id, required_role_minimum, visibility_state));

create policy "Members can read V10 exception records"
  on public.v10_exception_records for select
  using (public.v10_member_can_read(organization_id, required_role_minimum, visibility_state));

create policy "Members can read V10 notification deliveries"
  on public.v10_notification_deliveries for select
  using (public.v10_member_can_read(organization_id, required_role_minimum, visibility_state));

create policy "Members can read V10 renewal checkpoints"
  on public.v10_renewal_checkpoint_records for select
  using (public.v10_member_can_read(organization_id, required_role_minimum, visibility_state));

create policy "Members can read V10 external evidence submissions"
  on public.v10_external_evidence_submissions for select
  using (public.v10_member_can_read(organization_id, required_role_minimum, visibility_state));

create policy "Members can read V10 activation"
  on public.v10_activation_state for select
  using (public.v10_member_can_read(organization_id, required_role_minimum, visibility_state));

create policy "Members can read V10 jobs"
  on public.v10_job_run_visibility for select
  using (public.v10_member_can_read(organization_id, required_role_minimum, visibility_state));

create policy "Members can read V10 report runs"
  on public.v10_report_run_visibility for select
  using (public.v10_member_can_read(organization_id, required_role_minimum, visibility_state));

create policy "Members can read V10 audit"
  on public.v10_audit_events for select
  using (public.v10_member_can_read(organization_id, required_role_minimum, visibility_state));

create policy "Members can read V10 release evidence records"
  on public.v10_release_evidence_records for select
  using (exists (
    select 1 from public.organization_members om
    where om.organization_id = v10_release_evidence_records.organization_id
      and om.user_id = auth.uid()
  ));

create policy "Members can read V10 fixture manifests"
  on public.v10_fixture_manifests for select
  using (exists (
    select 1 from public.organization_members om
    where om.organization_id = v10_fixture_manifests.organization_id
      and om.user_id = auth.uid()
  ));

create policy "Members can read V10 denominator locks"
  on public.v10_denominator_locks for select
  using (exists (
    select 1 from public.organization_members om
    where om.organization_id = v10_denominator_locks.organization_id
      and om.user_id = auth.uid()
  ));

create policy "Members can read V10 metric runs"
  on public.v10_metric_runs for select
  using (exists (
    select 1 from public.organization_members om
    where om.organization_id = v10_metric_runs.organization_id
      and om.user_id = auth.uid()
  ));

create policy "Members can read V10 promotion decisions"
  on public.v10_promotion_decisions for select
  using (exists (
    select 1 from public.organization_members om
    where om.organization_id = v10_promotion_decisions.organization_id
      and om.user_id = auth.uid()
  ));

create policy "Members can read V10 release waivers"
  on public.v10_release_waivers for select
  using (exists (
    select 1 from public.organization_members om
    where om.organization_id = v10_release_waivers.organization_id
      and om.user_id = auth.uid()
  ));

create policy "Members can read V10 verification command results"
  on public.v10_verification_command_results for select
  using (exists (
    select 1 from public.organization_members om
    where om.organization_id = v10_verification_command_results.organization_id
      and om.user_id = auth.uid()
  ));

create policy "Members can read V10 external blocker records"
  on public.v10_external_blocker_records for select
  using (exists (
    select 1 from public.organization_members om
    where om.organization_id = v10_external_blocker_records.organization_id
      and om.user_id = auth.uid()
  ));

create policy "Members can read V10 fixture teardown records"
  on public.v10_fixture_teardown_records for select
  using (exists (
    select 1 from public.organization_members om
    where om.organization_id = v10_fixture_teardown_records.organization_id
      and om.user_id = auth.uid()
  ));

create policy "Members can read V10 refresh jobs"
  on public.v10_read_model_refresh_jobs for select
  using (exists (
    select 1 from public.organization_members om
    where om.organization_id = v10_read_model_refresh_jobs.organization_id
      and om.user_id = auth.uid()
  ));

create policy "Members can read V10 read model lineage"
  on public.v10_read_model_lineage for select
  using (public.v10_member_can_read(organization_id, required_role_minimum, visibility_state));

create policy "Members can read V10 runtime artifacts"
  on public.v10_runtime_artifacts for select
  using (
    classification <> 'prohibited'
    and revoked_at is null
    and public.v10_member_can_read(organization_id, required_role_minimum, visibility_state)
  );

create policy "Members can read V10 runtime coverage ledger"
  on public.v10_runtime_coverage_ledger for select
  using (
    organization_id is null
    or exists (
      select 1 from public.organization_members om
      where om.organization_id = v10_runtime_coverage_ledger.organization_id
        and om.user_id = auth.uid()
    )
  );

create policy "Members can read V10 advanced assurance linked records"
  on public.v10_advanced_assurance_linked_records for select
  using (public.v10_member_can_read(organization_id, required_role_minimum, visibility_state));
