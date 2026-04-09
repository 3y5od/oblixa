-- V3 policy and capability layer:
-- - org notification suppression policy
-- - role capability policy overrides
-- Apply after 031_v3_remaining_depth.sql

alter table public.organization_workflow_settings
  add column if not exists notification_policy_json jsonb not null default '{}'::jsonb,
  add column if not exists role_policy_json jsonb not null default '{}'::jsonb,
  add column if not exists dashboard_tracking_enabled boolean not null default true;

comment on column public.organization_workflow_settings.notification_policy_json
  is 'Per-channel suppression and digest policy, e.g. {"email":{"digest_enabled":true},"slack":{"automation_enabled":true}}';

comment on column public.organization_workflow_settings.role_policy_json
  is 'Capability override map by role, e.g. {"ops_manager":{"approvals_manage":true}}';
