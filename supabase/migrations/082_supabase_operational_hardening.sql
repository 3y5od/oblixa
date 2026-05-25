-- Durable Supabase operational hardening.
-- This migration is intentionally narrow: it makes production advisor fixes
-- explicit without changing application RPC call paths.

alter function public.enforce_task_dependency_scope() set search_path = public;
alter function public.storage_object_org_id(text) set search_path = public;
alter function public.update_updated_at() set search_path = public;

-- Service-only SECURITY DEFINER functions. Revoking PUBLIC is not enough when
-- roles have explicit grants, so strip anon/authenticated grants as well.
revoke all on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;

revoke all on function public.dashboard_org_metrics(uuid) from public;
revoke execute on function public.dashboard_org_metrics(uuid) from anon;
revoke execute on function public.dashboard_org_metrics(uuid) from authenticated;
grant execute on function public.dashboard_org_metrics(uuid) to service_role;

revoke all on function public.org_nav_badge_counts(uuid, uuid) from public;
revoke execute on function public.org_nav_badge_counts(uuid, uuid) from anon;
revoke execute on function public.org_nav_badge_counts(uuid, uuid) from authenticated;
grant execute on function public.org_nav_badge_counts(uuid, uuid) to service_role;

revoke all on function public.contracts_page_snapshot(uuid, integer, integer, text, text, uuid, text, text) from public;
revoke execute on function public.contracts_page_snapshot(uuid, integer, integer, text, text, uuid, text, text) from anon;
revoke execute on function public.contracts_page_snapshot(uuid, integer, integer, text, text, uuid, text, text) from authenticated;
grant execute on function public.contracts_page_snapshot(uuid, integer, integer, text, text, uuid, text, text) to service_role;

revoke all on function public.work_hub_snapshot(uuid, uuid, integer) from public;
revoke execute on function public.work_hub_snapshot(uuid, uuid, integer) from anon;
revoke execute on function public.work_hub_snapshot(uuid, uuid, integer) from authenticated;
grant execute on function public.work_hub_snapshot(uuid, uuid, integer) to service_role;

revoke all on function public.dashboard_home_snapshot(uuid, uuid) from public;
revoke execute on function public.dashboard_home_snapshot(uuid, uuid) from anon;
revoke execute on function public.dashboard_home_snapshot(uuid, uuid) from authenticated;
grant execute on function public.dashboard_home_snapshot(uuid, uuid) to service_role;

revoke all on function public.reports_control_room_snapshot(uuid) from public;
revoke execute on function public.reports_control_room_snapshot(uuid) from anon;
revoke execute on function public.reports_control_room_snapshot(uuid) from authenticated;
grant execute on function public.reports_control_room_snapshot(uuid) to service_role;

revoke all on function public.assurance_hub_snapshot(uuid) from public;
revoke execute on function public.assurance_hub_snapshot(uuid) from anon;
revoke execute on function public.assurance_hub_snapshot(uuid) from authenticated;
grant execute on function public.assurance_hub_snapshot(uuid) to service_role;

revoke all on function public.cleanup_code_owned_transient_data(timestamptz) from public;
revoke execute on function public.cleanup_code_owned_transient_data(timestamptz) from anon;
revoke execute on function public.cleanup_code_owned_transient_data(timestamptz) from authenticated;
grant execute on function public.cleanup_code_owned_transient_data(timestamptz) to service_role;

revoke all on function public.cleanup_expired_v10_mutation_idempotency(timestamptz) from public;
revoke execute on function public.cleanup_expired_v10_mutation_idempotency(timestamptz) from anon;
revoke execute on function public.cleanup_expired_v10_mutation_idempotency(timestamptz) from authenticated;
grant execute on function public.cleanup_expired_v10_mutation_idempotency(timestamptz) to service_role;

revoke all on function public.claim_v10_mutation_idempotency(uuid, uuid, text, text, text, text, text, text, jsonb, timestamptz) from public;
revoke execute on function public.claim_v10_mutation_idempotency(uuid, uuid, text, text, text, text, text, text, jsonb, timestamptz) from anon;
revoke execute on function public.claim_v10_mutation_idempotency(uuid, uuid, text, text, text, text, text, text, jsonb, timestamptz) from authenticated;
grant execute on function public.claim_v10_mutation_idempotency(uuid, uuid, text, text, text, text, text, text, jsonb, timestamptz) to service_role;

revoke all on function public.complete_v10_mutation_idempotency(uuid, uuid, text, text, text, text, text, jsonb) from public;
revoke execute on function public.complete_v10_mutation_idempotency(uuid, uuid, text, text, text, text, text, jsonb) from anon;
revoke execute on function public.complete_v10_mutation_idempotency(uuid, uuid, text, text, text, text, text, jsonb) from authenticated;
grant execute on function public.complete_v10_mutation_idempotency(uuid, uuid, text, text, text, text, text, jsonb) to service_role;

revoke all on function public.cleanup_old_v10_read_model_refresh_jobs(timestamptz) from public;
revoke execute on function public.cleanup_old_v10_read_model_refresh_jobs(timestamptz) from anon;
revoke execute on function public.cleanup_old_v10_read_model_refresh_jobs(timestamptz) from authenticated;
grant execute on function public.cleanup_old_v10_read_model_refresh_jobs(timestamptz) to service_role;

revoke all on function public.cleanup_expired_v10_runtime_artifacts(timestamptz) from public;
revoke execute on function public.cleanup_expired_v10_runtime_artifacts(timestamptz) from anon;
revoke execute on function public.cleanup_expired_v10_runtime_artifacts(timestamptz) from authenticated;
grant execute on function public.cleanup_expired_v10_runtime_artifacts(timestamptz) to service_role;

revoke all on function public.replace_v10_read_model_rows(text, uuid, jsonb, text[], timestamptz) from public;
revoke execute on function public.replace_v10_read_model_rows(text, uuid, jsonb, text[], timestamptz) from anon;
revoke execute on function public.replace_v10_read_model_rows(text, uuid, jsonb, text[], timestamptz) from authenticated;
grant execute on function public.replace_v10_read_model_rows(text, uuid, jsonb, text[], timestamptz) to service_role;

-- Intentionally authenticated-callable helpers. These are used by app/RLS
-- flows and remain constrained by auth.uid() or pure deterministic behavior.
revoke all on function public.create_user_org(uuid, text) from public;
revoke execute on function public.create_user_org(uuid, text) from anon;
grant execute on function public.create_user_org(uuid, text) to authenticated;
grant execute on function public.create_user_org(uuid, text) to service_role;

revoke all on function public.is_org_member(uuid) from public;
revoke execute on function public.is_org_member(uuid) from anon;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_member(uuid) to service_role;

revoke all on function public.v10_role_rank(text) from public;
revoke execute on function public.v10_role_rank(text) from anon;
grant execute on function public.v10_role_rank(text) to authenticated;
grant execute on function public.v10_role_rank(text) to service_role;

revoke all on function public.v10_member_can_read(uuid, text, text) from public;
revoke execute on function public.v10_member_can_read(uuid, text, text) from anon;
grant execute on function public.v10_member_can_read(uuid, text, text) to authenticated;
grant execute on function public.v10_member_can_read(uuid, text, text) to service_role;
