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