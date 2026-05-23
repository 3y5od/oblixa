-- Harden direct execution of active SECURITY DEFINER functions.
-- Default posture is no PUBLIC execute; only authenticated RLS helpers and
-- service-role RPCs receive explicit execute grants.

revoke all on function public.handle_new_user() from public;

revoke all on function public.create_user_org(uuid, text) from public;
grant execute on function public.create_user_org(uuid, text) to authenticated;
grant execute on function public.create_user_org(uuid, text) to service_role;

revoke all on function public.is_org_member(uuid) from public;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_member(uuid) to service_role;

revoke all on function public.dashboard_org_metrics(uuid) from public;
grant execute on function public.dashboard_org_metrics(uuid) to service_role;

revoke all on function public.org_nav_badge_counts(uuid, uuid) from public;
grant execute on function public.org_nav_badge_counts(uuid, uuid) to service_role;

revoke all on function public.contracts_page_snapshot(uuid, integer, integer, text, text, uuid, text, text) from public;
grant execute on function public.contracts_page_snapshot(uuid, integer, integer, text, text, uuid, text, text) to service_role;

revoke all on function public.work_hub_snapshot(uuid, uuid, integer) from public;
grant execute on function public.work_hub_snapshot(uuid, uuid, integer) to service_role;

revoke all on function public.dashboard_home_snapshot(uuid, uuid) from public;
grant execute on function public.dashboard_home_snapshot(uuid, uuid) to service_role;

revoke all on function public.reports_control_room_snapshot(uuid) from public;
grant execute on function public.reports_control_room_snapshot(uuid) to service_role;

revoke all on function public.assurance_hub_snapshot(uuid) from public;
grant execute on function public.assurance_hub_snapshot(uuid) to service_role;

revoke all on function public.cleanup_expired_v10_mutation_idempotency(timestamptz) from public;
grant execute on function public.cleanup_expired_v10_mutation_idempotency(timestamptz) to service_role;

revoke all on function public.claim_v10_mutation_idempotency(uuid, uuid, text, text, text, text, text, text, jsonb, timestamptz) from public;
grant execute on function public.claim_v10_mutation_idempotency(uuid, uuid, text, text, text, text, text, text, jsonb, timestamptz) to service_role;

revoke all on function public.complete_v10_mutation_idempotency(uuid, uuid, text, text, text, text, text, jsonb) from public;
grant execute on function public.complete_v10_mutation_idempotency(uuid, uuid, text, text, text, text, text, jsonb) to service_role;

revoke all on function public.v10_role_rank(text) from public;
grant execute on function public.v10_role_rank(text) to authenticated;
grant execute on function public.v10_role_rank(text) to service_role;

revoke all on function public.v10_member_can_read(uuid, text, text) from public;
grant execute on function public.v10_member_can_read(uuid, text, text) to authenticated;
grant execute on function public.v10_member_can_read(uuid, text, text) to service_role;

revoke all on function public.cleanup_old_v10_read_model_refresh_jobs(timestamptz) from public;
grant execute on function public.cleanup_old_v10_read_model_refresh_jobs(timestamptz) to service_role;

revoke all on function public.cleanup_expired_v10_runtime_artifacts(timestamptz) from public;
grant execute on function public.cleanup_expired_v10_runtime_artifacts(timestamptz) to service_role;

revoke all on function public.replace_v10_read_model_rows(text, uuid, jsonb, text[], timestamptz) from public;
grant execute on function public.replace_v10_read_model_rows(text, uuid, jsonb, text[], timestamptz) to service_role;
