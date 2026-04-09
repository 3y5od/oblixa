-- Align decision_workspaces.decision_type CHECK with src/lib/v5/decision-types.ts (API + UI).

update public.decision_workspaces
set decision_type = 'waiver_exception'
where decision_type = 'waiver_or_exception_disposition';

update public.decision_workspaces
set decision_type = 'ownership_transfer'
where decision_type = 'ownership_transfer_decision';

update public.decision_workspaces
set decision_type = 'policy_exception'
where decision_type = 'policy_exception_decision';

update public.decision_workspaces
set decision_type = 'termination'
where decision_type = 'termination_recommendation';

update public.decision_workspaces
set decision_type = 'remediation_acceptance'
where decision_type = 'remediation_acceptance_decision';

alter table public.decision_workspaces
  drop constraint if exists decision_workspaces_decision_type_check;

alter table public.decision_workspaces
  add constraint decision_workspaces_decision_type_check check (
    decision_type in (
      'renewal',
      'renewal_recommendation',
      'amendment_request',
      'waiver_exception',
      'obligation_extension',
      'ownership_transfer',
      'policy_exception',
      'termination',
      'remediation_acceptance'
    )
  );
