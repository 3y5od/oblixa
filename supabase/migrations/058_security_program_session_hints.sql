-- Security program marker: prefer bounded statement timeouts at the pooler for
-- long-running reports. Managed Supabase: configure via dashboard / support.
-- No DDL here to avoid privilege failures on hosted roles.
select 1 as oblixa_security_program_session_hints_ok;

-- V10 core workflow alignment. Kept in the 058 migration file so Supabase CLI
-- sees a single schema_migrations version for this rollout slot.

alter table public.contract_approvals
  drop constraint if exists contract_approvals_status_check;

alter table public.contract_approvals
  add constraint contract_approvals_status_check
  check (status in ('pending', 'approved', 'rejected', 'changes_requested'));

alter table public.exceptions
  add column if not exists resolution_action text;

alter table public.exceptions
  drop constraint if exists exceptions_resolution_action_check;

alter table public.exceptions
  add constraint exceptions_resolution_action_check
  check (
    resolution_action is null
    or resolution_action in (
      'accepted_risk',
      'fixed',
      'converted_to_task',
      'evidence_requested',
      'escalated_to_approval',
      'campaign_created',
      'finding_linked'
    )
  );
