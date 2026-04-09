-- V4 execution platform foundation schema.
-- Adds Contract Programs, execution graph, exceptions, evidence/attestation,
-- SLA/escalation policy, renewal decision packet, casefile, maintenance campaigns,
-- role command center preferences, and report packs.

-- 1) Contract programs
create table if not exists public.contract_programs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  state text not null check (state in ('draft', 'published', 'archived')) default 'draft',
  current_version_id uuid,
  auto_assignment_rules jsonb not null default '[]'::jsonb,
  default_routing_json jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contract_program_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  program_id uuid not null references public.contract_programs(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  state text not null check (state in ('draft', 'published', 'superseded')) default 'draft',
  definition_json jsonb not null default '{}'::jsonb,
  changelog text,
  published_at timestamptz,
  published_by uuid references auth.users(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, version_number)
);

create table if not exists public.contract_program_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  program_id uuid not null references public.contract_programs(id) on delete cascade,
  program_version_id uuid references public.contract_program_versions(id) on delete set null,
  assignment_mode text not null check (assignment_mode in ('auto', 'manual', 'policy')) default 'auto',
  status text not null check (status in ('active', 'inactive')) default 'active',
  override_json jsonb not null default '{}'::jsonb,
  assigned_by uuid references auth.users(id),
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contract_id, program_id, status)
);

alter table public.contract_programs
  add constraint contract_programs_current_version_fkey
  foreign key (current_version_id) references public.contract_program_versions(id)
  on delete set null;

-- 2) Execution graph
create table if not exists public.execution_graph_edges (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  from_entity_type text not null,
  from_entity_id uuid not null,
  to_entity_type text not null,
  to_entity_id uuid not null,
  relation_type text not null check (relation_type in ('depends_on', 'blocks', 'requires', 'related_to')) default 'depends_on',
  status text not null check (status in ('active', 'satisfied', 'broken')) default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, contract_id, from_entity_type, from_entity_id, to_entity_type, to_entity_id, relation_type)
);

-- 3) Exceptions
create table if not exists public.exceptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid references public.contracts(id) on delete set null,
  program_id uuid references public.contract_programs(id) on delete set null,
  linked_entity_type text,
  linked_entity_id uuid,
  exception_type text not null,
  title text not null,
  details text,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')) default 'medium',
  status text not null check (status in ('open', 'in_progress', 'resolved', 'closed')) default 'open',
  owner_id uuid references auth.users(id),
  due_date date,
  root_cause text,
  resolution_note text,
  escalation_json jsonb not null default '{}'::jsonb,
  last_escalated_at timestamptz,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id),
  reopen_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exception_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  exception_id uuid not null references public.exceptions(id) on delete cascade,
  event_type text not null,
  actor_user_id uuid references auth.users(id),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 4) Evidence and attestations
create table if not exists public.evidence_requirements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid references public.contracts(id) on delete set null,
  program_id uuid references public.contract_programs(id) on delete set null,
  work_item_type text not null,
  work_item_id uuid not null,
  requirement_type text not null check (
    requirement_type in ('document', 'structured_form', 'comment', 'external_reference', 'manager_approval', 'attestation')
  ),
  title text not null,
  required boolean not null default true,
  due_at timestamptz,
  review_due_at timestamptz,
  reviewer_id uuid references auth.users(id),
  status text not null check (status in ('required', 'submitted', 'approved', 'rejected', 'waived')) default 'required',
  config_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.evidence_submissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requirement_id uuid not null references public.evidence_requirements(id) on delete cascade,
  submitted_by uuid references auth.users(id),
  submitted_at timestamptz not null default now(),
  status text not null check (status in ('submitted', 'approved', 'rejected')) default 'submitted',
  payload_json jsonb not null default '{}'::jsonb,
  reviewer_id uuid references auth.users(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.attestation_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid references public.contracts(id) on delete set null,
  program_id uuid references public.contract_programs(id) on delete set null,
  request_type text not null,
  title text not null,
  details text,
  status text not null check (status in ('open', 'responded', 'approved', 'rejected', 'overdue', 'closed')) default 'open',
  owner_id uuid references auth.users(id),
  reviewer_id uuid references auth.users(id),
  due_at timestamptz,
  cadence_days integer check (cadence_days is null or cadence_days > 0),
  last_issued_at timestamptz,
  last_reminded_at timestamptz,
  next_issue_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attestation_responses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  request_id uuid not null references public.attestation_requests(id) on delete cascade,
  responder_id uuid references auth.users(id),
  response_type text not null check (response_type in ('confirm', 'reject', 'needs_follow_up')) default 'confirm',
  response_note text,
  payload_json jsonb not null default '{}'::jsonb,
  responded_at timestamptz not null default now()
);

-- 5) Approval SLA and escalation policies
create table if not exists public.approval_slas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  approval_type text not null,
  contract_type text,
  sla_hours integer not null check (sla_hours > 0),
  breach_hours integer check (breach_hours is null or breach_hours > 0),
  reminder_hours integer[] not null default '{}',
  escalation_policy_id uuid,
  active boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.escalation_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  policy_type text not null,
  severity text check (severity is null or severity in ('low', 'medium', 'high', 'critical')),
  trigger_json jsonb not null default '{}'::jsonb,
  route_json jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.approval_slas
  add constraint approval_slas_escalation_policy_fkey
  foreign key (escalation_policy_id) references public.escalation_policies(id)
  on delete set null;

-- 6) Renewal decision packets
create table if not exists public.renewal_decision_packets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  checkpoint_id uuid references public.contract_renewal_checkpoints(id) on delete set null,
  status text not null check (status in ('draft', 'recommended', 'approved', 'rejected', 'archived')) default 'draft',
  recommendation text check (recommendation is null or recommendation in ('renew', 'amend', 'terminate')),
  summary text,
  assumptions_json jsonb not null default '{}'::jsonb,
  packet_json jsonb not null default '{}'::jsonb,
  generated_by uuid references auth.users(id),
  generated_at timestamptz,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 7) Casefile timeline events
create table if not exists public.operational_casefile_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  event_type text not null,
  entity_type text,
  entity_id uuid,
  actor_user_id uuid references auth.users(id),
  details_json jsonb not null default '{}'::jsonb,
  source text not null default 'system',
  created_at timestamptz not null default now()
);

-- 8) Maintenance campaigns
create table if not exists public.maintenance_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  campaign_type text not null,
  status text not null check (status in ('draft', 'running', 'paused', 'completed', 'failed', 'canceled')) default 'draft',
  filter_json jsonb not null default '{}'::jsonb,
  summary_json jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.maintenance_campaign_rows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.maintenance_campaigns(id) on delete cascade,
  contract_id uuid references public.contracts(id) on delete set null,
  row_key text,
  status text not null check (status in ('pending', 'processed', 'failed', 'skipped')) default 'pending',
  before_json jsonb not null default '{}'::jsonb,
  after_json jsonb not null default '{}'::jsonb,
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

-- 9) Role command center preferences
create table if not exists public.role_command_center_preferences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  preferences_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id, role)
);

-- 10) Report packs
create table if not exists public.report_packs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  report_type text not null,
  schedule text,
  config_json jsonb not null default '{}'::jsonb,
  delivery_json jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.report_pack_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  report_pack_id uuid not null references public.report_packs(id) on delete cascade,
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed')) default 'queued',
  started_at timestamptz,
  completed_at timestamptz,
  metrics_json jsonb not null default '{}'::jsonb,
  output_refs_json jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now()
);

-- 11) Extend existing execution entities for V4 linkage
alter table public.contract_tasks
  add column if not exists program_assignment_id uuid references public.contract_program_assignments(id) on delete set null,
  add column if not exists evidence_requirement_id uuid references public.evidence_requirements(id) on delete set null,
  add column if not exists execution_status text check (execution_status in ('ready', 'blocked', 'in_progress', 'done')) default 'ready';

alter table public.contract_obligations
  add column if not exists program_assignment_id uuid references public.contract_program_assignments(id) on delete set null,
  add column if not exists evidence_requirement_id uuid references public.evidence_requirements(id) on delete set null,
  add column if not exists attestation_request_id uuid references public.attestation_requests(id) on delete set null;

alter table public.contract_approvals
  add column if not exists sla_id uuid references public.approval_slas(id) on delete set null,
  add column if not exists escalated_at timestamptz;

alter table public.contract_renewal_checkpoints
  add column if not exists decision_packet_id uuid references public.renewal_decision_packets(id) on delete set null,
  add column if not exists renewal_state text check (
    renewal_state in ('not_started', 'gathering_inputs', 'under_review', 'decision_pending', 'approved_to_renew', 'approved_to_amend', 'approved_to_terminate', 'completed', 'slipped')
  ) default 'not_started';

alter table public.organization_workflow_settings
  add column if not exists v4_compatibility_mode boolean not null default true;

-- 12) Safe backfills
update public.contract_program_versions v
set organization_id = p.organization_id
from public.contract_programs p
where v.program_id = p.id
  and v.organization_id is distinct from p.organization_id;

update public.contract_program_assignments a
set organization_id = c.organization_id
from public.contracts c
where a.contract_id = c.id
  and a.organization_id is distinct from c.organization_id;

update public.exceptions e
set organization_id = c.organization_id
from public.contracts c
where e.contract_id = c.id
  and e.organization_id is distinct from c.organization_id;

-- 13) Indexes
create index if not exists idx_contract_programs_org on public.contract_programs(organization_id);
create index if not exists idx_contract_program_versions_program on public.contract_program_versions(program_id, version_number desc);
create index if not exists idx_contract_program_assignments_contract on public.contract_program_assignments(contract_id, status);
create index if not exists idx_execution_graph_edges_contract on public.execution_graph_edges(organization_id, contract_id, status);
create index if not exists idx_exceptions_org_status on public.exceptions(organization_id, status, severity);
create index if not exists idx_exceptions_owner_due on public.exceptions(organization_id, owner_id, due_date);
create index if not exists idx_exception_events_exception on public.exception_events(exception_id, created_at desc);
create index if not exists idx_evidence_requirements_work on public.evidence_requirements(organization_id, work_item_type, work_item_id);
create index if not exists idx_evidence_submissions_requirement on public.evidence_submissions(requirement_id, submitted_at desc);
create index if not exists idx_attestation_requests_org_status on public.attestation_requests(organization_id, status, due_at);
create index if not exists idx_attestation_responses_request on public.attestation_responses(request_id, responded_at desc);
create index if not exists idx_approval_slas_org_type on public.approval_slas(organization_id, approval_type, contract_type);
create index if not exists idx_escalation_policies_org_type on public.escalation_policies(organization_id, policy_type, active);
create index if not exists idx_renewal_decision_packets_contract on public.renewal_decision_packets(organization_id, contract_id, status);
create index if not exists idx_operational_casefile_events_contract on public.operational_casefile_events(organization_id, contract_id, occurred_at desc);
create index if not exists idx_maintenance_campaigns_org_status on public.maintenance_campaigns(organization_id, status, created_at desc);
create index if not exists idx_maintenance_campaign_rows_campaign on public.maintenance_campaign_rows(campaign_id, status);
create index if not exists idx_role_command_center_preferences_user on public.role_command_center_preferences(organization_id, user_id, role);
create index if not exists idx_report_packs_org_active on public.report_packs(organization_id, active, report_type);
create index if not exists idx_report_pack_runs_pack on public.report_pack_runs(report_pack_id, created_at desc);

-- 14) updated_at triggers
drop trigger if exists update_contract_programs_updated_at on public.contract_programs;
create trigger update_contract_programs_updated_at
  before update on public.contract_programs
  for each row execute function public.update_updated_at();

drop trigger if exists update_contract_program_versions_updated_at on public.contract_program_versions;
create trigger update_contract_program_versions_updated_at
  before update on public.contract_program_versions
  for each row execute function public.update_updated_at();

drop trigger if exists update_contract_program_assignments_updated_at on public.contract_program_assignments;
create trigger update_contract_program_assignments_updated_at
  before update on public.contract_program_assignments
  for each row execute function public.update_updated_at();

drop trigger if exists update_exceptions_updated_at on public.exceptions;
create trigger update_exceptions_updated_at
  before update on public.exceptions
  for each row execute function public.update_updated_at();

drop trigger if exists update_evidence_requirements_updated_at on public.evidence_requirements;
create trigger update_evidence_requirements_updated_at
  before update on public.evidence_requirements
  for each row execute function public.update_updated_at();

drop trigger if exists update_attestation_requests_updated_at on public.attestation_requests;
create trigger update_attestation_requests_updated_at
  before update on public.attestation_requests
  for each row execute function public.update_updated_at();

drop trigger if exists update_approval_slas_updated_at on public.approval_slas;
create trigger update_approval_slas_updated_at
  before update on public.approval_slas
  for each row execute function public.update_updated_at();

drop trigger if exists update_escalation_policies_updated_at on public.escalation_policies;
create trigger update_escalation_policies_updated_at
  before update on public.escalation_policies
  for each row execute function public.update_updated_at();

drop trigger if exists update_renewal_decision_packets_updated_at on public.renewal_decision_packets;
create trigger update_renewal_decision_packets_updated_at
  before update on public.renewal_decision_packets
  for each row execute function public.update_updated_at();

drop trigger if exists update_maintenance_campaigns_updated_at on public.maintenance_campaigns;
create trigger update_maintenance_campaigns_updated_at
  before update on public.maintenance_campaigns
  for each row execute function public.update_updated_at();

drop trigger if exists update_role_command_center_preferences_updated_at on public.role_command_center_preferences;
create trigger update_role_command_center_preferences_updated_at
  before update on public.role_command_center_preferences
  for each row execute function public.update_updated_at();

drop trigger if exists update_report_packs_updated_at on public.report_packs;
create trigger update_report_packs_updated_at
  before update on public.report_packs
  for each row execute function public.update_updated_at();

-- 15) RLS
alter table public.contract_programs enable row level security;
alter table public.contract_program_versions enable row level security;
alter table public.contract_program_assignments enable row level security;
alter table public.execution_graph_edges enable row level security;
alter table public.exceptions enable row level security;
alter table public.exception_events enable row level security;
alter table public.evidence_requirements enable row level security;
alter table public.evidence_submissions enable row level security;
alter table public.attestation_requests enable row level security;
alter table public.attestation_responses enable row level security;
alter table public.approval_slas enable row level security;
alter table public.escalation_policies enable row level security;
alter table public.renewal_decision_packets enable row level security;
alter table public.operational_casefile_events enable row level security;
alter table public.maintenance_campaigns enable row level security;
alter table public.maintenance_campaign_rows enable row level security;
alter table public.role_command_center_preferences enable row level security;
alter table public.report_packs enable row level security;
alter table public.report_pack_runs enable row level security;

-- Members can read org scoped rows.
drop policy if exists "Members can view contract programs in their org" on public.contract_programs;
create policy "Members can view contract programs in their org"
  on public.contract_programs for select
  using (public.is_org_member(organization_id));

drop policy if exists "Editors can manage contract programs in their org" on public.contract_programs;
create policy "Editors can manage contract programs in their org"
  on public.contract_programs for all
  using (
    exists (
      select 1 from public.organization_members
      where organization_id = contract_programs.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members
      where organization_id = contract_programs.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  );

drop policy if exists "Members can view contract program versions in their org" on public.contract_program_versions;
create policy "Members can view contract program versions in their org"
  on public.contract_program_versions for select
  using (public.is_org_member(organization_id));

drop policy if exists "Editors can manage contract program versions in their org" on public.contract_program_versions;
create policy "Editors can manage contract program versions in their org"
  on public.contract_program_versions for all
  using (
    exists (
      select 1 from public.organization_members
      where organization_id = contract_program_versions.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members
      where organization_id = contract_program_versions.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  );

drop policy if exists "Members can view program assignments in their org" on public.contract_program_assignments;
create policy "Members can view program assignments in their org"
  on public.contract_program_assignments for select
  using (public.is_org_member(organization_id));

drop policy if exists "Editors can manage program assignments in their org" on public.contract_program_assignments;
create policy "Editors can manage program assignments in their org"
  on public.contract_program_assignments for all
  using (
    exists (
      select 1 from public.organization_members
      where organization_id = contract_program_assignments.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members
      where organization_id = contract_program_assignments.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  );

drop policy if exists "Members can view execution graph edges in their org" on public.execution_graph_edges;
create policy "Members can view execution graph edges in their org"
  on public.execution_graph_edges for select
  using (public.is_org_member(organization_id));

drop policy if exists "Editors can manage execution graph edges in their org" on public.execution_graph_edges;
create policy "Editors can manage execution graph edges in their org"
  on public.execution_graph_edges for all
  using (
    exists (
      select 1 from public.organization_members
      where organization_id = execution_graph_edges.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members
      where organization_id = execution_graph_edges.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  );

drop policy if exists "Members can view exceptions in their org" on public.exceptions;
create policy "Members can view exceptions in their org"
  on public.exceptions for select
  using (public.is_org_member(organization_id));

drop policy if exists "Editors can manage exceptions in their org" on public.exceptions;
create policy "Editors can manage exceptions in their org"
  on public.exceptions for all
  using (
    exists (
      select 1 from public.organization_members
      where organization_id = exceptions.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager', 'legal_reviewer', 'finance_reviewer')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members
      where organization_id = exceptions.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager', 'legal_reviewer', 'finance_reviewer')
    )
  );

drop policy if exists "Members can view exception events in their org" on public.exception_events;
create policy "Members can view exception events in their org"
  on public.exception_events for select
  using (public.is_org_member(organization_id));

drop policy if exists "Editors can manage exception events in their org" on public.exception_events;
create policy "Editors can manage exception events in their org"
  on public.exception_events for all
  using (
    exists (
      select 1 from public.organization_members
      where organization_id = exception_events.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members
      where organization_id = exception_events.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  );

drop policy if exists "Members can view evidence requirements in their org" on public.evidence_requirements;
create policy "Members can view evidence requirements in their org"
  on public.evidence_requirements for select
  using (public.is_org_member(organization_id));

drop policy if exists "Editors can manage evidence requirements in their org" on public.evidence_requirements;
create policy "Editors can manage evidence requirements in their org"
  on public.evidence_requirements for all
  using (
    exists (
      select 1 from public.organization_members
      where organization_id = evidence_requirements.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager', 'legal_reviewer', 'finance_reviewer')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members
      where organization_id = evidence_requirements.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager', 'legal_reviewer', 'finance_reviewer')
    )
  );

drop policy if exists "Members can view evidence submissions in their org" on public.evidence_submissions;
create policy "Members can view evidence submissions in their org"
  on public.evidence_submissions for select
  using (public.is_org_member(organization_id));

drop policy if exists "Editors can manage evidence submissions in their org" on public.evidence_submissions;
create policy "Editors can manage evidence submissions in their org"
  on public.evidence_submissions for all
  using (
    exists (
      select 1 from public.organization_members
      where organization_id = evidence_submissions.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager', 'legal_reviewer', 'finance_reviewer')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members
      where organization_id = evidence_submissions.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager', 'legal_reviewer', 'finance_reviewer')
    )
  );

drop policy if exists "Members can view attestation requests in their org" on public.attestation_requests;
create policy "Members can view attestation requests in their org"
  on public.attestation_requests for select
  using (public.is_org_member(organization_id));

drop policy if exists "Editors can manage attestation requests in their org" on public.attestation_requests;
create policy "Editors can manage attestation requests in their org"
  on public.attestation_requests for all
  using (
    exists (
      select 1 from public.organization_members
      where organization_id = attestation_requests.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members
      where organization_id = attestation_requests.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  );

drop policy if exists "Members can view attestation responses in their org" on public.attestation_responses;
create policy "Members can view attestation responses in their org"
  on public.attestation_responses for select
  using (public.is_org_member(organization_id));

drop policy if exists "Editors can manage attestation responses in their org" on public.attestation_responses;
create policy "Editors can manage attestation responses in their org"
  on public.attestation_responses for all
  using (
    exists (
      select 1 from public.organization_members
      where organization_id = attestation_responses.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members
      where organization_id = attestation_responses.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  );

drop policy if exists "Members can view approval slas in their org" on public.approval_slas;
create policy "Members can view approval slas in their org"
  on public.approval_slas for select
  using (public.is_org_member(organization_id));

drop policy if exists "Admins can manage approval slas in their org" on public.approval_slas;
create policy "Admins can manage approval slas in their org"
  on public.approval_slas for all
  using (
    exists (
      select 1 from public.organization_members
      where organization_id = approval_slas.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'ops_manager', 'manager')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members
      where organization_id = approval_slas.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'ops_manager', 'manager')
    )
  );

drop policy if exists "Members can view escalation policies in their org" on public.escalation_policies;
create policy "Members can view escalation policies in their org"
  on public.escalation_policies for select
  using (public.is_org_member(organization_id));

drop policy if exists "Admins can manage escalation policies in their org" on public.escalation_policies;
create policy "Admins can manage escalation policies in their org"
  on public.escalation_policies for all
  using (
    exists (
      select 1 from public.organization_members
      where organization_id = escalation_policies.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'ops_manager', 'manager')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members
      where organization_id = escalation_policies.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'ops_manager', 'manager')
    )
  );

drop policy if exists "Members can view renewal decision packets in their org" on public.renewal_decision_packets;
create policy "Members can view renewal decision packets in their org"
  on public.renewal_decision_packets for select
  using (public.is_org_member(organization_id));

drop policy if exists "Editors can manage renewal decision packets in their org" on public.renewal_decision_packets;
create policy "Editors can manage renewal decision packets in their org"
  on public.renewal_decision_packets for all
  using (
    exists (
      select 1 from public.organization_members
      where organization_id = renewal_decision_packets.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager', 'finance_reviewer')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members
      where organization_id = renewal_decision_packets.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager', 'finance_reviewer')
    )
  );

drop policy if exists "Members can view casefile events in their org" on public.operational_casefile_events;
create policy "Members can view casefile events in their org"
  on public.operational_casefile_events for select
  using (public.is_org_member(organization_id));

drop policy if exists "Editors can insert casefile events in their org" on public.operational_casefile_events;
create policy "Editors can insert casefile events in their org"
  on public.operational_casefile_events for insert
  with check (
    exists (
      select 1 from public.organization_members
      where organization_id = operational_casefile_events.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager', 'legal_reviewer', 'finance_reviewer')
    )
  );

drop policy if exists "Members can view maintenance campaigns in their org" on public.maintenance_campaigns;
create policy "Members can view maintenance campaigns in their org"
  on public.maintenance_campaigns for select
  using (public.is_org_member(organization_id));

drop policy if exists "Editors can manage maintenance campaigns in their org" on public.maintenance_campaigns;
create policy "Editors can manage maintenance campaigns in their org"
  on public.maintenance_campaigns for all
  using (
    exists (
      select 1 from public.organization_members
      where organization_id = maintenance_campaigns.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members
      where organization_id = maintenance_campaigns.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  );

drop policy if exists "Members can view maintenance campaign rows in their org" on public.maintenance_campaign_rows;
create policy "Members can view maintenance campaign rows in their org"
  on public.maintenance_campaign_rows for select
  using (public.is_org_member(organization_id));

drop policy if exists "Editors can manage maintenance campaign rows in their org" on public.maintenance_campaign_rows;
create policy "Editors can manage maintenance campaign rows in their org"
  on public.maintenance_campaign_rows for all
  using (
    exists (
      select 1 from public.organization_members
      where organization_id = maintenance_campaign_rows.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members
      where organization_id = maintenance_campaign_rows.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  );

drop policy if exists "Users can view own role command center preferences" on public.role_command_center_preferences;
create policy "Users can view own role command center preferences"
  on public.role_command_center_preferences for select
  using (user_id = auth.uid() and public.is_org_member(organization_id));

drop policy if exists "Users can manage own role command center preferences" on public.role_command_center_preferences;
create policy "Users can manage own role command center preferences"
  on public.role_command_center_preferences for all
  using (user_id = auth.uid() and public.is_org_member(organization_id))
  with check (user_id = auth.uid() and public.is_org_member(organization_id));

drop policy if exists "Members can view report packs in their org" on public.report_packs;
create policy "Members can view report packs in their org"
  on public.report_packs for select
  using (public.is_org_member(organization_id));

drop policy if exists "Editors can manage report packs in their org" on public.report_packs;
create policy "Editors can manage report packs in their org"
  on public.report_packs for all
  using (
    exists (
      select 1 from public.organization_members
      where organization_id = report_packs.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members
      where organization_id = report_packs.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  );

drop policy if exists "Members can view report pack runs in their org" on public.report_pack_runs;
create policy "Members can view report pack runs in their org"
  on public.report_pack_runs for select
  using (public.is_org_member(organization_id));

drop policy if exists "Editors can manage report pack runs in their org" on public.report_pack_runs;
create policy "Editors can manage report pack runs in their org"
  on public.report_pack_runs for all
  using (
    exists (
      select 1 from public.organization_members
      where organization_id = report_pack_runs.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members
      where organization_id = report_pack_runs.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  );
