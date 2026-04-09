-- V4 feature surface: evidence templates, renewal workspace payload, policy registry,
-- report pack annotations/subscriptions, maintenance preview/rollback metadata.

-- Evidence requirement templates (org-wide reusable definitions)
create table if not exists public.evidence_requirement_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  requirement_type text not null
    check (
      requirement_type in (
        'document',
        'structured_form',
        'comment',
        'external_reference',
        'manager_approval',
        'attestation'
      )
    ),
  template_json jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_evidence_requirement_templates_org
  on public.evidence_requirement_templates (organization_id, created_at desc);

drop trigger if exists update_evidence_requirement_templates_updated_at on public.evidence_requirement_templates;
create trigger update_evidence_requirement_templates_updated_at
  before update on public.evidence_requirement_templates
  for each row execute function public.update_updated_at();

alter table public.evidence_requirement_templates enable row level security;

drop policy if exists "Members can view evidence requirement templates in their org" on public.evidence_requirement_templates;
create policy "Members can view evidence requirement templates in their org"
  on public.evidence_requirement_templates for select
  using (public.is_org_member(organization_id));

drop policy if exists "Editors can manage evidence requirement templates in their org" on public.evidence_requirement_templates;
create policy "Editors can manage evidence requirement templates in their org"
  on public.evidence_requirement_templates for all
  using (
    exists (
      select 1 from public.organization_members
      where organization_id = evidence_requirement_templates.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager', 'legal_reviewer', 'finance_reviewer')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members
      where organization_id = evidence_requirement_templates.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager', 'legal_reviewer', 'finance_reviewer')
    )
  );

-- Renewal checkpoint structured workspace (checklist, scenarios notes, agenda)
alter table public.contract_renewal_checkpoints
  add column if not exists workspace_json jsonb not null default '{}'::jsonb;

-- Org-level policy registry + simulation inputs (JSON document)
alter table public.organization_workflow_settings
  add column if not exists v4_policy_registry_json jsonb not null default '[]'::jsonb;

-- Report pack presentation + subscriptions
alter table public.report_packs
  add column if not exists annotations_json jsonb not null default '[]'::jsonb;

create table if not exists public.report_pack_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  report_pack_id uuid not null references public.report_packs(id) on delete cascade,
  audience_label text,
  schedule_cron text,
  recipient_emails text[] not null default '{}',
  active boolean not null default true,
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_report_pack_subscriptions_pack
  on public.report_pack_subscriptions (organization_id, report_pack_id, active);

drop trigger if exists update_report_pack_subscriptions_updated_at on public.report_pack_subscriptions;
create trigger update_report_pack_subscriptions_updated_at
  before update on public.report_pack_subscriptions
  for each row execute function public.update_updated_at();

alter table public.report_pack_subscriptions enable row level security;

drop policy if exists "Members can view report pack subscriptions in their org" on public.report_pack_subscriptions;
create policy "Members can view report pack subscriptions in their org"
  on public.report_pack_subscriptions for select
  using (public.is_org_member(organization_id));

drop policy if exists "Editors can manage report pack subscriptions in their org" on public.report_pack_subscriptions;
create policy "Editors can manage report pack subscriptions in their org"
  on public.report_pack_subscriptions for all
  using (
    exists (
      select 1 from public.organization_members
      where organization_id = report_pack_subscriptions.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members
      where organization_id = report_pack_subscriptions.organization_id
        and user_id = auth.uid()
        and role in ('admin', 'editor', 'ops_manager', 'manager')
    )
  );

-- Maintenance: preview counts / rollback marker
alter table public.maintenance_campaigns
  add column if not exists preview_summary_json jsonb not null default '{}'::jsonb,
  add column if not exists last_preview_at timestamptz,
  add column if not exists rolled_back_at timestamptz;

-- Optional: parallel approval paths metadata on SLA rows
alter table public.approval_slas
  add column if not exists path_mode text not null default 'sequential'
    check (path_mode in ('sequential', 'parallel'));
