-- Forward-only neutral function aliases for versioned SQL helpers.
-- Legacy functions remain the implementation source until linked catalog
-- verification and application cutover evidence approve removal.

create or replace function public.cleanup_expired_mutation_idempotency(retention_cutoff timestamptz default now())
returns integer
language sql
security definer
set search_path = public
as $$
  select public.cleanup_expired_v10_mutation_idempotency(retention_cutoff)
$$;

revoke all on function public.cleanup_expired_mutation_idempotency(timestamptz) from public;
grant execute on function public.cleanup_expired_mutation_idempotency(timestamptz) to service_role;

create or replace function public.claim_mutation_idempotency(
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
language sql
security definer
set search_path = public
as $$
  select *
  from public.claim_v10_mutation_idempotency(
    p_organization_id,
    p_actor_user_id,
    p_mutation_name,
    p_target_type,
    p_target_id,
    p_idempotency_key,
    p_client_request_id,
    p_request_hash,
    p_pending_response_json,
    p_claim_expires_at
  )
$$;

revoke all on function public.claim_mutation_idempotency(uuid, uuid, text, text, text, text, text, text, jsonb, timestamptz) from public;
grant execute on function public.claim_mutation_idempotency(uuid, uuid, text, text, text, text, text, text, jsonb, timestamptz) to service_role;

create or replace function public.complete_mutation_idempotency(
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
language sql
security definer
set search_path = public
as $$
  select public.complete_v10_mutation_idempotency(
    p_organization_id,
    p_actor_user_id,
    p_mutation_name,
    p_target_type,
    p_target_id,
    p_idempotency_key,
    p_request_hash,
    p_response_json
  )
$$;

revoke all on function public.complete_mutation_idempotency(uuid, uuid, text, text, text, text, text, jsonb) from public;
grant execute on function public.complete_mutation_idempotency(uuid, uuid, text, text, text, text, text, jsonb) to service_role;

create or replace function public.role_rank(role_name text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select public.v10_role_rank(role_name)
$$;

revoke all on function public.role_rank(text) from public;
grant execute on function public.role_rank(text) to authenticated;
grant execute on function public.role_rank(text) to service_role;

create or replace function public.member_can_read(
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
  select public.v10_member_can_read(row_organization_id, row_required_role_minimum, row_visibility_state)
$$;

revoke all on function public.member_can_read(uuid, text, text) from public;
grant execute on function public.member_can_read(uuid, text, text) to authenticated;
grant execute on function public.member_can_read(uuid, text, text) to service_role;

create or replace function public.cleanup_old_read_model_refresh_jobs(retention_cutoff timestamptz default now() - interval '30 days')
returns integer
language sql
security definer
set search_path = public
as $$
  select public.cleanup_old_v10_read_model_refresh_jobs(retention_cutoff)
$$;

revoke all on function public.cleanup_old_read_model_refresh_jobs(timestamptz) from public;
grant execute on function public.cleanup_old_read_model_refresh_jobs(timestamptz) to service_role;

create or replace function public.cleanup_expired_runtime_artifacts(retention_cutoff timestamptz default now())
returns integer
language sql
security definer
set search_path = public
as $$
  select public.cleanup_expired_v10_runtime_artifacts(retention_cutoff)
$$;

revoke all on function public.cleanup_expired_runtime_artifacts(timestamptz) from public;
grant execute on function public.cleanup_expired_runtime_artifacts(timestamptz) to service_role;

create or replace function public.replace_read_model_rows(
  p_table_name text,
  p_organization_id uuid,
  p_rows jsonb,
  p_identity_columns text[],
  p_archived_at timestamptz default now()
)
returns table (upserted_count integer, archived_count integer)
language sql
security definer
set search_path = public
as $$
  select *
  from public.replace_v10_read_model_rows(
    p_table_name,
    p_organization_id,
    p_rows,
    p_identity_columns,
    p_archived_at
  )
$$;

revoke all on function public.replace_read_model_rows(text, uuid, jsonb, text[], timestamptz) from public;
grant execute on function public.replace_read_model_rows(text, uuid, jsonb, text[], timestamptz) to service_role;

create or replace function public.apply_updated_at_trigger(table_name text)
returns void
language plpgsql
as $$
begin
  perform public.v6_apply_updated_at_trigger(table_name);
end;
$$;

revoke all on function public.apply_updated_at_trigger(text) from public;
grant execute on function public.apply_updated_at_trigger(text) to service_role;
